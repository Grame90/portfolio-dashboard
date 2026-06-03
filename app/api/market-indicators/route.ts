import { NextResponse } from "next/server";

// Market-valuation / health indicators ("Buffett-style") for the top strip.
// Real data where freely available (FRED — no key; Yahoo; alternative.me).
// The Buffett Indicator (market cap / GDP) and Shiller CAPE have NO free
// real-time API, so they are APPROXIMATED by anchoring a recent known value
// and scaling by the S&P 500 (and GDP). Flagged `approx: true` and shown with "≈".

const UA = "Mozilla/5.0 (compatible; portfolio-dashboard/1.0)";

async function fredLast(id: string): Promise<number | null> {
  try {
    const from = new Date();
    from.setMonth(from.getMonth() - 18);
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&observation_start=${from.toISOString().slice(0, 10)}`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const text = await res.text();
    const vals = text.trim().split("\n").slice(1)
      .map(line => parseFloat(line.split(",")[1]))
      .filter(v => Number.isFinite(v));
    return vals.length ? vals[vals.length - 1] : null;
  } catch {
    return null;
  }
}

async function yahooPrice(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d`,
      { headers: { "User-Agent": UA }, next: { revalidate: 900 }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const d = await res.json();
    const price = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" && price > 0 ? price : null;
  } catch {
    return null;
  }
}

async function cryptoFearGreed(): Promise<{ value: number; label: string } | null> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1", { next: { revalidate: 1800 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const d = await res.json();
    const x = d?.data?.[0];
    if (!x) return null;
    const value = Number(x.value);
    return Number.isFinite(value) ? { value, label: String(x.value_classification ?? "") } : null;
  } catch {
    return null;
  }
}

// ── Approximation anchors ──────────────────────────────────────────────────
// Anchored ~2024-11. UPDATE QUARTERLY: set SP_ANCHOR to the then-current S&P 500,
// GDP_ANCHOR to latest BEA nominal GDP ($B), and BUFFETT_ANCHOR / CAPE_ANCHOR to
// the published Buffett Indicator (Wilshire5000/GDP) and multpl.com CAPE at the
// same date. The longer this drifts, the less accurate the ≈ values become.
const SP_ANCHOR = 5800;     // S&P 500 level at anchor
const GDP_ANCHOR = 29000;   // US nominal GDP ($B) at anchor
const BUFFETT_ANCHOR = 200; // Buffett Indicator (%) at anchor
const CAPE_ANCHOR = 37;     // Shiller CAPE at anchor

type Indicator = {
  key: string;
  label: string;
  value: string;
  sub?: string;
  color: string;
  approx?: boolean;
};

const GREEN = "#22c55e";
const YELLOW = "#f59e0b";
const RED = "#ef4444";
const NEUTRAL = "#9fb3d4";

export async function GET() {
  const [gdp, sp500Fred, sp500Yahoo, dgs10, t10y2y, vix, fng] = await Promise.all([
    fredLast("GDP"),
    fredLast("SP500"),
    yahooPrice("^GSPC"),
    fredLast("DGS10"),
    fredLast("T10Y2Y"),
    yahooPrice("^VIX"),
    cryptoFearGreed(),
  ]);

  const sp500 = sp500Yahoo ?? sp500Fred;

  // Buffett Indicator ≈ (market cap / GDP) and Shiller CAPE ≈ (P/E 10) — neither has
  // a free real-time API, so both are anchor-scaled approximations. Computed ONCE
  // here and reused by the indicators strip AND the crisis score below (single
  // source of truth — no formula drift).
  const bi = sp500 && gdp ? BUFFETT_ANCHOR * (sp500 / SP_ANCHOR) * (GDP_ANCHOR / gdp) : null;
  const cape = sp500 ? CAPE_ANCHOR * (sp500 / SP_ANCHOR) : null;

  const indicators: Indicator[] = [];

  // Buffett Indicator ≈
  if (bi !== null) {
    indicators.push({
      key: "buffett",
      label: "Индикатор Баффета",
      value: `${bi.toFixed(0)}%`,
      sub: bi >= 150 ? "переоценён" : bi >= 100 ? "норма+" : "недооценён",
      color: bi >= 150 ? RED : bi >= 100 ? YELLOW : GREEN,
      approx: true,
    });
  }

  // Shiller CAPE ≈
  if (cape !== null) {
    indicators.push({
      key: "cape",
      label: "CAPE (P/E 10)",
      value: cape.toFixed(1),
      sub: cape >= 30 ? "дорого" : cape >= 20 ? "норма+" : "дёшево",
      color: cape >= 30 ? RED : cape >= 20 ? YELLOW : GREEN,
      approx: true,
    });
  }

  // VIX — real (Yahoo).
  if (vix) {
    indicators.push({
      key: "vix",
      label: "VIX",
      value: vix.toFixed(1),
      sub: vix >= 30 ? "страх" : vix >= 20 ? "повышен" : "спокойно",
      color: vix >= 30 ? RED : vix >= 20 ? YELLOW : GREEN,
    });
  }

  // Yield curve 10Y-2Y — real (FRED). Inverted (<0) = recession signal.
  if (t10y2y !== null) {
    indicators.push({
      key: "yieldcurve",
      label: "Кривая 10Y-2Y",
      value: `${t10y2y > 0 ? "+" : ""}${t10y2y.toFixed(2)}`,
      sub: t10y2y < 0 ? "инверсия" : t10y2y < 0.5 ? "плоская" : "норма",
      color: t10y2y < 0 ? RED : t10y2y < 0.5 ? YELLOW : GREEN,
    });
  }

  // 10Y Treasury yield — real (FRED). Informational.
  if (dgs10 !== null) {
    indicators.push({
      key: "us10y",
      label: "US 10Y",
      value: `${dgs10.toFixed(2)}%`,
      color: NEUTRAL,
    });
  }

  // Crypto Fear & Greed — real (alternative.me).
  if (fng) {
    indicators.push({
      key: "fng",
      label: "Fear & Greed",
      value: String(fng.value),
      sub: fng.label,
      color: fng.value < 25 ? RED : fng.value < 45 ? YELLOW : fng.value < 75 ? GREEN : "#16a34a",
    });
  }

  // ── Crisis assessment: aggregate danger signals into a weighted score ──
  let score = 0;
  const signals: string[] = [];

  if (bi !== null) {
    if (bi >= 180) { score += 2; signals.push(`Индикатор Баффета ${bi.toFixed(0)}% — сильная переоценка`); }
    else if (bi >= 150) { score += 1; signals.push(`Индикатор Баффета ${bi.toFixed(0)}% — переоценка`); }
  }

  if (cape !== null) {
    if (cape >= 35) { score += 2; signals.push(`CAPE ${cape.toFixed(1)} — рынок очень дорогой`); }
    else if (cape >= 30) { score += 1; signals.push(`CAPE ${cape.toFixed(1)} — рынок дорогой`); }
  }

  if (vix !== null) {
    if (vix >= 35) { score += 3; signals.push(`VIX ${vix.toFixed(0)} — паника на рынке`); }
    else if (vix >= 28) { score += 2; signals.push(`VIX ${vix.toFixed(0)} — высокая волатильность`); }
    else if (vix >= 22) { score += 1; signals.push(`VIX ${vix.toFixed(0)} — повышенная волатильность`); }
  }

  if (t10y2y !== null) {
    if (t10y2y < 0) { score += 2; signals.push(`Кривая доходности инвертирована (${t10y2y.toFixed(2)}) — сигнал рецессии`); }
    else if (t10y2y < 0.25) { score += 1; signals.push(`Кривая доходности почти плоская (${t10y2y.toFixed(2)})`); }
  }

  if (fng) {
    if (fng.value < 15) { score += 2; signals.push(`Fear & Greed ${fng.value} — паника`); }
    else if (fng.value < 25) { score += 1; signals.push(`Fear & Greed ${fng.value} — страх`); }
    else if (fng.value > 85) { score += 2; signals.push(`Fear & Greed ${fng.value} — эйфория (риск пузыря)`); }
    else if (fng.value > 75) { score += 1; signals.push(`Fear & Greed ${fng.value} — жадность`); }
  }

  let level: "calm" | "elevated" | "high" | "crisis";
  let label: string;
  let color: string;
  if (score >= 7)      { level = "crisis";   label = "КРИЗИС-АЛЕРТ";  color = "#ef4444"; }
  else if (score >= 5) { level = "high";     label = "Высокий риск";  color = "#f97316"; }
  else if (score >= 3) { level = "elevated"; label = "Осторожно";     color = "#f59e0b"; }
  else                 { level = "calm";     label = "Спокойно";      color = "#22c55e"; }

  const crisis = { level, label, color, score, signals };

  return NextResponse.json(
    { indicators, crisis, updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=300" } },
  );
}
