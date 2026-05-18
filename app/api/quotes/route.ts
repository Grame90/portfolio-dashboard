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
};

function toYahooTicker(ticker: string): string {
  return ticker.replace(/\./g, "-");
}

async function fetchFinnhubQuote(ticker: string): Promise<Quote | null> {
  if (!FINNHUB_KEY) return null;

  const res = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_KEY}`,
    { cache: "no-store" },
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
  const previousClose = Number(meta.chartPreviousClose ?? meta.previousClose ?? closes.filter((v): v is number => typeof v === "number").at(-2) ?? current);
  if (!Number.isFinite(current) || current <= 0) return null;

  const lastIndex = closes.findLastIndex((v) => typeof v === "number");

  return {
    current,
    previousClose: Number.isFinite(previousClose) && previousClose > 0 ? previousClose : current,
    open: Number(meta.regularMarketOpen ?? opens[lastIndex] ?? current),
    high: Number(meta.regularMarketDayHigh ?? highs[lastIndex] ?? current),
    low: Number(meta.regularMarketDayLow ?? lows[lastIndex] ?? current),
    t: Number(meta.regularMarketTime ?? timestamps[lastIndex] ?? Math.floor(Date.now() / 1000)),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers");
  if (!tickersParam) return NextResponse.json({ error: "tickers param required" }, { status: 400 });

  const tickers = tickersParam.split(",").filter(t => t && !SKIP.has(t));
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

  return NextResponse.json(quotes);
}
