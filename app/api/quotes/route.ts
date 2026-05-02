import { NextResponse } from "next/server";

const API_KEY = process.env.FINNHUB_API_KEY!;
const BASE = "https://finnhub.io/api/v1/quote";

// Finnhub symbol mapping (some tickers differ)
const SYMBOL_MAP: Record<string, string> = {
  "КЭШ (USD)": "",
  "BRK.B": "BRK.B",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers");
  if (!tickersParam) {
    return NextResponse.json({ error: "tickers param required" }, { status: 400 });
  }

  const tickers = tickersParam.split(",").filter(Boolean);

  const results = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const symbol = SYMBOL_MAP[ticker] ?? ticker;
      if (!symbol) return { ticker, current: 0, previousClose: 0, skip: true };

      const res = await fetch(`${BASE}?symbol=${symbol}&token=${API_KEY}`, {
        next: { revalidate: 0 },
      });

      if (!res.ok) throw new Error(`Finnhub error ${res.status} for ${symbol}`);

      const data = await res.json();
      // Finnhub fields: c=current, pc=previous close, o=open, h=high, l=low, t=unix timestamp
      return {
        ticker,
        current: data.c ?? 0,
        previousClose: data.pc ?? 0,
        open: data.o ?? 0,
        high: data.h ?? 0,
        low: data.l ?? 0,
        t: data.t ?? 0,
      };
    })
  );

  const quotes: Record<string, { current: number; previousClose: number; open: number; high: number; low: number }> = {};
  results.forEach((r) => {
    if (r.status === "fulfilled" && !r.value.skip) {
      const { ticker, ...rest } = r.value as any;
      quotes[ticker] = rest;
    }
  });

  return NextResponse.json(quotes);
}
