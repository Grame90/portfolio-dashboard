import { NextRequest, NextResponse } from "next/server";
const API_KEY = process.env.FINNHUB_API_KEY!;

export async function GET(req: NextRequest) {
  const tickers = (req.nextUrl.searchParams.get("tickers") ?? "").split(",").filter(Boolean);
  const days = parseInt(req.nextUrl.searchParams.get("days") ?? "60");
  if (!tickers.length) return NextResponse.json({});

  const to   = Math.floor(Date.now() / 1000);
  const from = to - days * 86400;

  const results = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const res = await fetch(
        `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${from}&to=${to}&token=${API_KEY}`,
        { next: { revalidate: 3600 } }
      );
      if (!res.ok) return null;
      const d = await res.json();
      if (d.s !== "ok" || !d.c?.length) return null;
      const closes: number[] = d.c;
      const dates: string[]  = d.t.map((ts: number) => new Date(ts * 1000).toISOString().slice(0, 10));
      const returns: number[] = closes.slice(1).map((c, i) => ((c - closes[i]) / closes[i]) * 100);
      return { ticker, dates, closes, returns };
    })
  );

  const out: Record<string, { dates: string[]; closes: number[]; returns: number[] }> = {};
  results.forEach(r => { if (r.status === "fulfilled" && r.value) { const { ticker, ...rest } = r.value; out[ticker] = rest; } });
  return NextResponse.json(out);
}
