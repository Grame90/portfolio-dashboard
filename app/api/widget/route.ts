// Lightweight portfolio summary endpoint for the iOS Scriptable widget.
//
// Auth: this route is excluded from the Supabase session middleware (see
// middleware.ts). It authenticates the caller via ?token=… matching the
// WIDGET_TOKEN environment variable. The token is generated once by the user
// and stored in their Scriptable script.
//
// Response shape (compact, suitable for a small Lock-screen widget):
//   {
//     total: 12345.67,        // current portfolio value, USD
//     dayUsd: 78.90,          // today's $ change (qty × (current − previousClose))
//     dayPct: 0.64,           // today's % change
//     asOf: "2026-05-29T14:32:00Z"
//   }

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Matches the SHARED_ID used by /api/shared-data — same single dataset.
const SHARED_ID = "e15a6730-6262-4921-b429-a66455c85dd7";

interface StoredPosition {
  ticker: string;
  qty: number;
  avgPrice: number;
  type: string;
}

interface Quote {
  current: number;
  previousClose: number;
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Convert "BRK.B" → "BRK-B" for Yahoo, which uses dash for share classes.
function toYahooTicker(t: string): string {
  return t.replace(/\.([A-Z])$/, "-$1");
}

async function fetchYahooQuote(ticker: string): Promise<Quote | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(toYahooTicker(ticker))}?range=5d&interval=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const r = json.chart?.result?.[0];
    const meta = r?.meta;
    if (!meta) return null;
    const current = Number(meta.regularMarketPrice);
    const previousClose = Number(meta.chartPreviousClose ?? meta.previousClose);
    if (!Number.isFinite(current) || current <= 0) return null;
    return { current, previousClose };
  } catch {
    return null;
  }
}

// CoinGecko ticker → coin id (subset covering common holdings).
const CG_IDS: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin",
  XRP: "ripple", ADA: "cardano", DOGE: "dogecoin", LTC: "litecoin",
  MATIC: "matic-network", LINK: "chainlink", AVAX: "avalanche-2",
  DOT: "polkadot", TRX: "tron", TON: "the-open-network",
  USDT: "tether", USDC: "usd-coin",
};

async function fetchCryptoQuotes(tickers: string[]): Promise<Record<string, Quote>> {
  const ids = tickers
    .map(t => CG_IDS[t.toUpperCase()])
    .filter(Boolean);
  if (ids.length === 0) return {};
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return {};
    const data = await res.json();
    const out: Record<string, Quote> = {};
    for (const t of tickers) {
      const id = CG_IDS[t.toUpperCase()];
      if (!id || !data[id]) continue;
      const current = Number(data[id].usd);
      const pct24h = Number(data[id].usd_24h_change ?? 0);
      const previousClose = pct24h !== 0 ? current / (1 + pct24h / 100) : current;
      if (Number.isFinite(current) && current > 0) {
        out[t] = { current, previousClose };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  // 1. Token check
  const expected = process.env.WIDGET_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "Widget not configured" }, { status: 500 });
  }
  const provided = req.nextUrl.searchParams.get("token");
  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Load positions from shared dataset
  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const { data: row, error } = await db
    .from("user_data")
    .select("positions")
    .eq("user_id", SHARED_ID)
    .single();
  if (error || !row?.positions) {
    return NextResponse.json({ error: "Portfolio data not found" }, { status: 404 });
  }
  const positions: StoredPosition[] = row.positions as StoredPosition[];

  // 3. Fetch quotes (in parallel)
  const stockTickers = positions
    .filter(p => p.type !== "Кэш" && p.type !== "Крипто")
    .map(p => p.ticker);
  const cryptoTickers = positions
    .filter(p => p.type === "Крипто")
    .map(p => p.ticker);

  const [stockResults, cryptoQuotes] = await Promise.all([
    Promise.allSettled(stockTickers.map(async (t) => [t, await fetchYahooQuote(t)] as const)),
    fetchCryptoQuotes(cryptoTickers),
  ]);

  const quotes: Record<string, Quote> = { ...cryptoQuotes };
  for (const r of stockResults) {
    if (r.status === "fulfilled" && r.value[1]) {
      quotes[r.value[0]] = r.value[1];
    }
  }

  // 4. Compute totals + per-position rows
  let total = 0;
  let dayUsd = 0;
  const rows: { ticker: string; avgPrice: number; value: number; dayUsd: number; dayPct: number; type: string }[] = [];

  for (const p of positions) {
    if (p.type === "Кэш") {
      const value = p.qty * p.avgPrice;
      total += value;
      rows.push({ ticker: p.ticker, avgPrice: p.avgPrice, value, dayUsd: 0, dayPct: 0, type: p.type });
      continue;
    }
    const q = quotes[p.ticker];
    if (!q) {
      const value = p.qty * p.avgPrice;
      total += value;
      rows.push({ ticker: p.ticker, avgPrice: p.avgPrice, value, dayUsd: 0, dayPct: 0, type: p.type });
      continue;
    }
    const value = p.qty * q.current;
    total += value;
    let posDayUsd = 0;
    let posDayPct = 0;
    if (q.previousClose > 0) {
      const rel = Math.abs(q.current - q.previousClose) / q.previousClose;
      if (rel <= 0.5) {
        posDayUsd = p.qty * (q.current - q.previousClose);
        posDayPct = ((q.current - q.previousClose) / q.previousClose) * 100;
        dayUsd += posDayUsd;
      }
    }
    rows.push({
      ticker: p.ticker,
      avgPrice: p.avgPrice,
      value,
      dayUsd: posDayUsd,
      dayPct: posDayPct,
      type: p.type,
    });
  }
  const prevTotal = total - dayUsd;
  const dayPct = prevTotal > 0 ? (dayUsd / prevTotal) * 100 : 0;

  const detail = req.nextUrl.searchParams.get("detail");
  const includeRows = detail === "1" || detail === "true";

  const body: Record<string, unknown> = {
    total: Math.round(total * 100) / 100,
    dayUsd: Math.round(dayUsd * 100) / 100,
    dayPct: Math.round(dayPct * 100) / 100,
    asOf: new Date().toISOString(),
  };

  if (includeRows) {
    body.positions = rows
      .map(r => ({
        ticker: r.ticker,
        avgPrice: Math.round(r.avgPrice * 100) / 100,
        sharePct: total > 0 ? Math.round((r.value / total) * 10000) / 100 : 0,
        dayUsd: Math.round(r.dayUsd),
        dayPct: Math.round(r.dayPct * 100) / 100,
        type: r.type,
      }))
      .sort((a, b) => b.sharePct - a.sharePct);
  }

  return NextResponse.json(body, {
    headers: {
      // Cache for 60s so the widget can refresh every minute without hammering
      "Cache-Control": "public, max-age=60, s-maxage=60",
    },
  });
}
