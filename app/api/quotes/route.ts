import { NextResponse } from "next/server";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY ?? "";
const SKIP = new Set(["КЭШ (USD)", "USD", "CASH"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers");
  if (!tickersParam) return NextResponse.json({ error: "tickers param required" }, { status: 400 });

  const tickers = tickersParam.split(",").filter(t => t && !SKIP.has(t));
  if (!tickers.length) return NextResponse.json({});

  const results = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_KEY}`,
        { next: { revalidate: 0 } },
      );
      if (!res.ok) return null;
      const q = await res.json();
      if (!q.c || q.c === 0) return null;
      return {
        ticker,
        current:       q.c  as number,
        previousClose: q.pc as number,
        open:          q.o  as number,
        high:          q.h  as number,
        low:           q.l  as number,
        t:             q.t  as number,
      };
    }),
  );

  const quotes: Record<string, { current: number; previousClose: number; open: number; high: number; low: number; t: number }> = {};
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      const { ticker, ...rest } = r.value;
      quotes[ticker] = rest;
    }
  }

  return NextResponse.json(quotes, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
