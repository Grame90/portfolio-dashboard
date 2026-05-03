import { NextResponse } from "next/server";

const KEYS = [
  process.env.TWELVEDATA_API_KEY_1,
  process.env.TWELVEDATA_API_KEY_2,
  process.env.TWELVEDATA_API_KEY_3,
].filter(Boolean) as string[];

// Each key fires every (SLOT * KEYS.length) seconds → 800 calls / 16h per key
const SLOT = 25; // seconds per slot → effective refresh = 25s, each key every 75s

function getKey(offset = 0): string {
  const idx = (Math.floor(Date.now() / (SLOT * 1000)) + offset) % KEYS.length;
  return KEYS[idx] ?? KEYS[0];
}

const SKIP = new Set(["КЭШ (USD)", "USD", "CASH"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers");
  if (!tickersParam) {
    return NextResponse.json({ error: "tickers param required" }, { status: 400 });
  }

  const tickers = tickersParam.split(",").filter(t => t && !SKIP.has(t));
  if (!tickers.length) return NextResponse.json({});

  const res = await fetch(
    `https://api.twelvedata.com/quote?symbol=${tickers.join(",")}&apikey=${getKey()}`,
    { next: { revalidate: 0 } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: `Twelve Data error ${res.status}` }, { status: 502 });
  }

  const data = await res.json();
  const isMulti = tickers.length > 1;

  const quotes: Record<string, {
    current: number; previousClose: number;
    open: number; high: number; low: number; t: number;
  }> = {};

  for (const ticker of tickers) {
    const q = isMulti ? data[ticker] : data;
    if (!q || q.code || !q.close) continue;
    quotes[ticker] = {
      current:       parseFloat(q.close)          || 0,
      previousClose: parseFloat(q.previous_close) || 0,
      open:          parseFloat(q.open)            || 0,
      high:          parseFloat(q.high)            || 0,
      low:           parseFloat(q.low)             || 0,
      t:             q.last_quote_at ?? q.timestamp ?? 0,
    };
  }

  return NextResponse.json(quotes);
}
