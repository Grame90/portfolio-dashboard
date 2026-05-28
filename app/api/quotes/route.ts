import { NextResponse } from "next/server";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY ?? "";
const SKIP = new Set(["КЭШ (USD)", "USD", "CASH"]);

type Quote = {
  current: number;
  previousClose: number;
  open: number;
  high: number;
  low: number;
  t: number;
  // Market state from Yahoo: REGULAR | CLOSED | PRE | POST | PREPRE | POSTPOST | etc.
  // Useful so the UI can flag stale data when the underlying exchange is closed.
  marketState?: string;
  // For commodity ETFs (SLV/GLD/USO…) we also fetch the corresponding futures
  // and surface its % change vs ETF's prev close. Lets the UI show an
  // "after-hours estimate" when NYSE is closed but the commodity keeps moving.
  futureSymbol?: string;
  futurePct?: number;
};

// Map commodity ETFs → corresponding futures symbol. After NYSE close,
// the ETF price is frozen but the future keeps trading; we surface this
// delta as a hint.
const ETF_TO_FUTURE: Record<string, string> = {
  SLV: "SI=F",
  SIVR: "SI=F",
  PSLV: "SI=F",
  GLD: "GC=F",
  IAU: "GC=F",
  SGOL: "GC=F",
  USO: "CL=F",
  USL: "CL=F",
  BNO: "BZ=F",
  UNG: "NG=F",
};

function toYahooTicker(ticker: string): string {
  return ticker.replace(/\.([A-Z])$/, "-$1");
}

async function fetchFinnhubQuote(ticker: string): Promise<Quote | null> {
  if (!FINNHUB_KEY) return null;

  const res = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}`,
    { cache: "no-store", headers: { "X-Finnhub-Token": FINNHUB_KEY } },
  );
  if (!res.ok) return null;

  const q = await res.json();
  if (!q.c || q.c === 0) return null;

  return {
    current: q.c as number,
    previousClose: q.pc as number,
    open: q.o as number,
    high: q.h as number,
    low: q.l as number,
    t: q.t as number,
  };
}

async function fetchYahooQuote(ticker: string): Promise<Quote | null> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(toYahooTicker(ticker))}?range=5d&interval=1d`,
    {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; portfolio-dashboard/1.0)" },
      cache: "no-store",
    },
  );
  if (!res.ok) return null;

  const d = await res.json();
  const result = d?.chart?.result?.[0];
  if (!result) return null;

  const meta = result.meta ?? {};
  const timestamps: number[] = result.timestamp ?? [];
  const closes: Array<number | null> = result.indicators?.quote?.[0]?.close ?? [];
  const opens: Array<number | null> = result.indicators?.quote?.[0]?.open ?? [];
  const highs: Array<number | null> = result.indicators?.quote?.[0]?.high ?? [];
  const lows: Array<number | null> = result.indicators?.quote?.[0]?.low ?? [];

  const current = Number(meta.regularMarketPrice ?? closes.findLast((v) => typeof v === "number"));
  if (!Number.isFinite(current) || current <= 0) return null;

  // Previous close: prefer the day-before-last from the daily closes array.
  // Yahoo's `chartPreviousClose` is the close BEFORE the chart's range started
  // (e.g. range=5d → close from ~6 trading days ago, NOT yesterday's close) —
  // do not use it. `regularMarketPreviousClose` is reliable when present.
  const validCloses = closes.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const lastDailyClose = validCloses.at(-1);
  const secondLastClose = validCloses.at(-2);
  let previousClose: number;
  if (typeof meta.regularMarketPreviousClose === "number" && meta.regularMarketPreviousClose > 0) {
    previousClose = meta.regularMarketPreviousClose;
  } else if (lastDailyClose !== undefined && Math.abs(lastDailyClose - current) < 0.01 && secondLastClose !== undefined) {
    // `current` matches the last-day close → use the day before.
    previousClose = secondLastClose;
  } else if (lastDailyClose !== undefined) {
    // `current` is intraday / != lastClose → that lastClose IS yesterday.
    previousClose = lastDailyClose;
  } else {
    previousClose = current;
  }

  const lastIndex = closes.findLastIndex((v) => typeof v === "number");

  return {
    current,
    previousClose: Number.isFinite(previousClose) && previousClose > 0 ? previousClose : current,
    open: Number(meta.regularMarketOpen ?? opens[lastIndex] ?? current),
    high: Number(meta.regularMarketDayHigh ?? highs[lastIndex] ?? current),
    low: Number(meta.regularMarketDayLow ?? lows[lastIndex] ?? current),
    t: Number(meta.regularMarketTime ?? timestamps[lastIndex] ?? Math.floor(Date.now() / 1000)),
    marketState: typeof meta.marketState === "string" ? meta.marketState : undefined,
  };
}

const TICKER_RE = /^[A-Z0-9.\-^=]{1,14}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers");
  if (!tickersParam) return NextResponse.json({ error: "tickers param required" }, { status: 400 });

  const tickers = tickersParam
    .split(",")
    .filter(t => t && !SKIP.has(t) && TICKER_RE.test(t))
    .slice(0, 50);
  if (!tickers.length) return NextResponse.json({});

  const results = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const quote = (await fetchFinnhubQuote(ticker)) ?? (await fetchYahooQuote(ticker));
      return quote ? { ticker, ...quote } : null;
    }),
  );

  const quotes: Record<string, Quote> = {};
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      const { ticker, ...rest } = r.value;
      quotes[ticker] = rest;
    }
  }

  // For commodity ETFs with closed/post markets, attach futures-derived hint.
  // Fetches unique futures in parallel (deduplicated) and computes the
  // future's % change vs the ETF's previousClose so the UI can show
  // "after-hours estimate" badge.
  const futuresNeeded = new Set<string>();
  for (const t of tickers) {
    if (ETF_TO_FUTURE[t] && quotes[t] && quotes[t].marketState !== "REGULAR") {
      futuresNeeded.add(ETF_TO_FUTURE[t]);
    }
  }
  if (futuresNeeded.size > 0) {
    const futureSyms = Array.from(futuresNeeded);
    const futResults = await Promise.allSettled(futureSyms.map(fetchYahooQuote));
    const futMap = new Map<string, Quote>();
    futResults.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value) futMap.set(futureSyms[i], r.value);
    });
    for (const t of tickers) {
      const futSym = ETF_TO_FUTURE[t];
      const fut = futSym ? futMap.get(futSym) : null;
      if (fut && quotes[t]) {
        // Future's change since its previous close — what silver/gold/oil is
        // actually doing right now. (ETF's previousClose ≈ same date.)
        const futPct = fut.previousClose > 0
          ? ((fut.current - fut.previousClose) / fut.previousClose) * 100
          : 0;
        quotes[t].futureSymbol = futSym;
        quotes[t].futurePct = Math.round(futPct * 100) / 100;
      }
    }
  }

  return NextResponse.json(quotes);
}
