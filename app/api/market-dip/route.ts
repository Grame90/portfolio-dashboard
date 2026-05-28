// Market Dip Indicator — buy-the-dip signal for QQQ / SOXX / SMH.
//
// For each instrument we compute:
//   • Daily change vs previous close (dip trigger: QQQ −2%, SOXX/SMH −3%)
//   • RSI(14)  — <30 oversold, 30–40 DCA zone
//   • MA(200)  — price above → buy more aggressively; below → reduce size
// Plus the market-wide VIX level (<18 risk-on, 18–25 neutral, >25 risk-off).
//
// Signal per instrument:
//   buy      → dip reached AND VIX < 25 AND RSI < 40
//   weak     → dip reached BUT (VIX 25–30 OR price < MA200)
//   none     → VIX > 30 OR no dip
//
// Suggested entry size: QQQ 0.5% of capital, SOXX/SMH 1%.

import { NextResponse } from "next/server";

type Target = { ticker: string; dipThreshold: number; allocPct: number };
const TARGETS: Target[] = [
  { ticker: "QQQ", dipThreshold: -2, allocPct: 0.5 },
  { ticker: "SOXX", dipThreshold: -3, allocPct: 1 },
  { ticker: "SMH", dipThreshold: -3, allocPct: 1 },
];

type Signal = "buy" | "weak" | "none";

type DipInstrument = {
  ticker: string;
  price: number;
  previousClose: number;
  dailyChangePct: number;
  dipThreshold: number;
  dipReached: boolean;
  rsi14: number | null;
  ma200: number | null;
  aboveMa200: boolean | null;
  allocPct: number;
  signal: Signal;
  reason: string;
};

async function fetchDailyCloses(
  ticker: string,
): Promise<{ closes: number[]; current: number; previousClose: number } | null> {
  // 1y of daily candles gives ~250 points → enough for MA200 + RSI14.
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?range=1y&interval=1d`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; portfolio-dashboard/1.0)" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const d = await res.json();
    const result = d?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta ?? {};
    const rawCloses: Array<number | null> = result.indicators?.quote?.[0]?.close ?? [];
    const closes = rawCloses.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (closes.length < 2) return null;
    const current = Number(meta.regularMarketPrice ?? closes.at(-1));
    // previousClose: second-to-last daily close when current matches the last
    // close (market closed), else the last close (intraday). Mirrors quotes route.
    const lastClose = closes.at(-1)!;
    const prev =
      typeof meta.regularMarketPreviousClose === "number" && meta.regularMarketPreviousClose > 0
        ? meta.regularMarketPreviousClose
        : Math.abs(lastClose - current) < 0.01 && closes.length >= 2
        ? closes[closes.length - 2]
        : lastClose;
    return { closes, current, previousClose: prev };
  } catch {
    return null;
  }
}

// Wilder's RSI(14).
function computeRsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  // First average over the initial `period` deltas.
  for (let i = closes.length - period; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }
  const avgGain = gain / period;
  const avgLoss = loss / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

function computeMa(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return Math.round((sum / period) * 100) / 100;
}

async function fetchVix(): Promise<number | null> {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?range=5d&interval=1d";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; portfolio-dashboard/1.0)" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const d = await res.json();
    const meta = d?.chart?.result?.[0]?.meta;
    const v = Number(meta?.regularMarketPrice);
    return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null;
  } catch {
    return null;
  }
}

function classify(
  dipReached: boolean,
  vix: number | null,
  rsi: number | null,
  aboveMa200: boolean | null,
): { signal: Signal; reason: string } {
  const v = vix ?? 0;
  if (v > 30) return { signal: "none", reason: "VIX > 30 — рынок в страхе, ждём" };
  if (!dipReached) return { signal: "none", reason: "Нет нужной просадки" };
  // dip reached and VIX <= 30
  const rsiOk = rsi !== null && rsi < 40;
  if (v < 25 && rsiOk) {
    return { signal: "buy", reason: `Просадка + VIX ${v.toFixed(0)} + RSI ${rsi?.toFixed(0)}` };
  }
  const weakReasons: string[] = [];
  if (v >= 25) weakReasons.push(`VIX ${v.toFixed(0)}`);
  if (aboveMa200 === false) weakReasons.push("ниже MA200");
  if (!rsiOk && rsi !== null) weakReasons.push(`RSI ${rsi.toFixed(0)}`);
  return {
    signal: "weak",
    reason: weakReasons.length ? `Слабый: ${weakReasons.join(", ")}` : "Слабый сигнал",
  };
}

export async function GET() {
  const vix = await fetchVix();

  const instruments: DipInstrument[] = [];
  await Promise.all(
    TARGETS.map(async (t) => {
      const data = await fetchDailyCloses(t.ticker);
      if (!data) {
        instruments.push({
          ticker: t.ticker,
          price: 0,
          previousClose: 0,
          dailyChangePct: 0,
          dipThreshold: t.dipThreshold,
          dipReached: false,
          rsi14: null,
          ma200: null,
          aboveMa200: null,
          allocPct: t.allocPct,
          signal: "none",
          reason: "Нет данных",
        });
        return;
      }
      const dailyChangePct =
        data.previousClose > 0
          ? ((data.current - data.previousClose) / data.previousClose) * 100
          : 0;
      const rsi = computeRsi(data.closes, 14);
      const ma200 = computeMa(data.closes, 200);
      const aboveMa200 = ma200 !== null ? data.current >= ma200 : null;
      const dipReached = dailyChangePct <= t.dipThreshold;
      const { signal, reason } = classify(dipReached, vix, rsi, aboveMa200);
      instruments.push({
        ticker: t.ticker,
        price: Math.round(data.current * 100) / 100,
        previousClose: Math.round(data.previousClose * 100) / 100,
        dailyChangePct: Math.round(dailyChangePct * 100) / 100,
        dipThreshold: t.dipThreshold,
        dipReached,
        rsi14: rsi,
        ma200,
        aboveMa200,
        allocPct: t.allocPct,
        signal,
        reason,
      });
    }),
  );

  // Preserve TARGETS order (Promise.all resolves out of order).
  instruments.sort(
    (a, b) =>
      TARGETS.findIndex((t) => t.ticker === a.ticker) -
      TARGETS.findIndex((t) => t.ticker === b.ticker),
  );

  const vixZone: "risk-on" | "neutral" | "risk-off" | "unknown" =
    vix === null ? "unknown" : vix < 18 ? "risk-on" : vix <= 25 ? "neutral" : "risk-off";

  const anyBuy = instruments.some((i) => i.signal === "buy");
  const anyWeak = instruments.some((i) => i.signal === "weak");
  const overall: Signal = anyBuy ? "buy" : anyWeak ? "weak" : "none";

  return NextResponse.json({
    vix,
    vixZone,
    overall,
    instruments,
    updatedAt: Date.now(),
  });
}
