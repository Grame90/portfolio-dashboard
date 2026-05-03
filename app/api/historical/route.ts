import { NextRequest, NextResponse } from "next/server";

const KEYS = [
  process.env.TWELVEDATA_API_KEY_1,
  process.env.TWELVEDATA_API_KEY_2,
  process.env.TWELVEDATA_API_KEY_3,
].filter(Boolean) as string[];

const SLOT = 25;

function getKey(offset = 0): string {
  const idx = (Math.floor(Date.now() / (SLOT * 1000)) + offset) % KEYS.length;
  return KEYS[idx] ?? KEYS[0];
}

export async function GET(req: NextRequest) {
  const tickers = (req.nextUrl.searchParams.get("tickers") ?? "").split(",").filter(Boolean);
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "60");
  if (!tickers.length) return NextResponse.json({});

  const outputsize = Math.min(Math.max(days, 1), 5000);

  const results = await Promise.allSettled(
    tickers.map(async (ticker, i) => {
      const res = await fetch(
        `https://api.twelvedata.com/time_series?symbol=${ticker}&interval=1day&outputsize=${outputsize}&apikey=${getKey(i)}`,
        { next: { revalidate: 3600 } }
      );
      if (!res.ok) return null;
      const d = await res.json();
      if (d.status !== "ok" || !d.values?.length) return null;

      const values: { datetime: string; close: string }[] = [...d.values].reverse();
      const closes: number[] = values.map(v => parseFloat(v.close));
      const dates: string[]  = values.map(v => v.datetime.slice(0, 10));
      const returns: number[] = closes.slice(1).map((c, i) => ((c - closes[i]) / closes[i]) * 100);

      return { ticker, dates, closes, returns };
    })
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
