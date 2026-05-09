import { NextRequest, NextResponse } from "next/server";

// Yahoo Finance ticker mapping — dots become hyphens
function toYahoo(ticker: string): string {
  return ticker.replace(/\./g, "-");
}

async function fetchYahoo(
  ticker: string,
  days: number,
): Promise<{ dates: string[]; closes: number[]; returns: number[] } | null> {
  const range = days > 365 ? "2y" : "1y";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${toYahoo(ticker)}?range=${range}&interval=1d`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; portfolio-dashboard/1.0)" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const d = await res.json();
    const result = d?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[] = result.timestamp ?? [];
    const rawCloses: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    if (!timestamps.length) return null;

    const pairs = timestamps
      .map((ts, i) => ({ date: new Date(ts * 1000).toISOString().slice(0, 10), close: rawCloses[i] }))
      .filter((p): p is { date: string; close: number } => p.close != null && isFinite(p.close));

    if (pairs.length < 2) return null;

    const dates  = pairs.map(p => p.date);
    const closes = pairs.map(p => Math.round(p.close * 10000) / 10000);
    const returns = closes.slice(1).map((c, i) => ((c - closes[i]) / closes[i]) * 100);

    return { dates, closes, returns };
  } catch {
    return null;
  }
}

// TwelveData fallback (used when Yahoo fails — e.g. unlisted tickers)
const TD_KEYS = [
  process.env.TWELVEDATA_API_KEY_1,
  process.env.TWELVEDATA_API_KEY_2,
  process.env.TWELVEDATA_API_KEY_3,
].filter(Boolean) as string[];

async function fetchTwelveData(
  ticker: string,
  days: number,
  keyIndex: number,
): Promise<{ dates: string[]; closes: number[]; returns: number[] } | null> {
  if (!TD_KEYS.length) return null;
  const key = TD_KEYS[keyIndex % TD_KEYS.length];
  try {
    const res = await fetch(
      `https://api.twelvedata.com/time_series?symbol=${ticker}&interval=1day&outputsize=${Math.min(days, 5000)}&apikey=${key}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    const d = await res.json();
    if (d.status !== "ok" || !d.values?.length) return null;

    const values: { datetime: string; close: string }[] = [...d.values].reverse();
    const closes  = values.map(v => parseFloat(v.close));
    const dates   = values.map(v => v.datetime.slice(0, 10));
    const returns = closes.slice(1).map((c, i) => ((c - closes[i]) / closes[i]) * 100);
    return { dates, closes, returns };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const tickers = (req.nextUrl.searchParams.get("tickers") ?? "").split(",").filter(Boolean);
  const days    = parseInt(req.nextUrl.searchParams.get("days") ?? "500");
  if (!tickers.length) return NextResponse.json({});

  const results = await Promise.allSettled(
    tickers.map(async (ticker, i) => {
      const data = (await fetchYahoo(ticker, days)) ?? (await fetchTwelveData(ticker, days, i));
      return data ? { ticker, ...data } : null;
    }),
  );

  const out: Record<string, { dates: string[]; closes: number[]; returns: number[] }> = {};
  results.forEach(r => {
    if (r.status === "fulfilled" && r.value) {
      const { ticker, ...rest } = r.value;
      out[ticker] = rest;
    }
  });

  return NextResponse.json(out);
}
