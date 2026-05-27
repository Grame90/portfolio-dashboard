// Auto-backfill diary entries from position history.
//
// For each trading day from cfg.startDate (or earliest purchaseDate) to today:
//   1. Determine which positions were already open (purchaseDate <= date).
//   2. Sum qty × close-on-date per broker, in broker's native currency.
//   3. Convert to USD using historical FX (Yahoo) as of that date.
//   4. Emit a DiaryEntry.
//
// Source of truth = /api/historical (Yahoo daily closes) for both stock
// tickers and FX pairs (USDTRY=X, USDRUB=X, EURUSD=X, BTC-USD).

import type { StoredPosition } from "../types";
import type {
  DiaryBroker,
  DiaryEntry,
  EntryFxRates,
  StrategyConfig,
} from "./types";

type HistResponse = Record<
  string,
  { dates: string[]; closes: number[]; returns: number[] }
>;

// Map of date → close, forward-filled so non-trading days resolve to the
// most recent prior close.
type CloseSeries = {
  byDate: Map<string, number>; // date → close (exact match only)
  sortedDates: string[]; // ascending dates that exist
};

function buildCloseSeries(
  data: { dates: string[]; closes: number[] } | undefined,
): CloseSeries | null {
  if (!data || data.dates.length === 0) return null;
  const byDate = new Map<string, number>();
  data.dates.forEach((d, i) => byDate.set(d, data.closes[i]));
  return {
    byDate,
    sortedDates: [...data.dates].sort((a, b) => a.localeCompare(b)),
  };
}

// Returns the most recent close on or before `date`. Undefined if none exists.
function closeAsOf(series: CloseSeries, date: string): number | undefined {
  if (series.byDate.has(date)) return series.byDate.get(date);
  // Binary search for last date <= target.
  let lo = 0;
  let hi = series.sortedDates.length - 1;
  let bestIdx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series.sortedDates[mid] <= date) {
      bestIdx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (bestIdx === -1) return undefined;
  return series.byDate.get(series.sortedDates[bestIdx]);
}

function uniqueTickers(positions: StoredPosition[]): string[] {
  return Array.from(new Set(positions.map((p) => p.ticker).filter(Boolean)));
}

// Daysbetween two YYYY-MM-DD dates (UTC, calendar days).
function daysBetween(start: string, end: string): number {
  const a = Date.UTC(
    Number(start.slice(0, 4)),
    Number(start.slice(5, 7)) - 1,
    Number(start.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(end.slice(0, 4)),
    Number(end.slice(5, 7)) - 1,
    Number(end.slice(8, 10)),
  );
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function matchesBroker(positionBroker: string | undefined, broker: DiaryBroker): boolean {
  if (!positionBroker) return false;
  const needle = positionBroker.toLowerCase().trim();
  return broker.positionBrokers.some(
    (name) => name.toLowerCase().trim() === needle,
  );
}

export type BackfillInput = {
  positions: StoredPosition[];
  brokers: DiaryBroker[];
  cfg: StrategyConfig;
  // Optional override; defaults to today.
  endDate?: string;
};

export type BackfillResult = {
  entries: DiaryEntry[];
  warnings: string[];
  meta: {
    startDate: string;
    endDate: string;
    days: number;
    tickersRequested: number;
    tickersFetched: number;
    fxFetched: string[];
  };
};

const FX_SYMBOLS = {
  TRY: "USDTRY=X", // TRY per 1 USD → invert to usdPerTry
  RUB: "USDRUB=X",
  EUR: "EURUSD=X", // USD per 1 EUR → use directly as usdPerEur
  BTC: "BTC-USD", // USD per 1 BTC → use directly as usdPerBtc
} as const;

// Fetch historical FX rates for a date range and build a per-date rates map.
// Returns a Map<YYYY-MM-DD, EntryFxRates> where each rates object is
// forward-filled from the closest prior trading day.
export async function fetchHistoricalFxMap(
  startDate: string,
  endDate: string,
  currencies: { TRY?: boolean; RUB?: boolean; EUR?: boolean; BTC?: boolean },
): Promise<{
  ratesByDate: Map<string, EntryFxRates>;
  fetched: string[];
  missing: string[];
}> {
  const span = daysBetween(startDate, endDate) + 10;
  const fetchDays = Math.min(1000, Math.max(span, 30));

  const symbols: string[] = [];
  if (currencies.TRY) symbols.push(FX_SYMBOLS.TRY);
  if (currencies.RUB) symbols.push(FX_SYMBOLS.RUB);
  if (currencies.EUR) symbols.push(FX_SYMBOLS.EUR);
  if (currencies.BTC) symbols.push(FX_SYMBOLS.BTC);

  const resp = await fetchHistoricalBatch(symbols, fetchDays);
  const fxTry = buildCloseSeries(resp[FX_SYMBOLS.TRY]);
  const fxRub = buildCloseSeries(resp[FX_SYMBOLS.RUB]);
  const fxEur = buildCloseSeries(resp[FX_SYMBOLS.EUR]);
  const fxBtc = buildCloseSeries(resp[FX_SYMBOLS.BTC]);

  const fetched: string[] = [];
  const missing: string[] = [];
  if (currencies.TRY) (fxTry ? fetched : missing).push("TRY");
  if (currencies.RUB) (fxRub ? fetched : missing).push("RUB");
  if (currencies.EUR) (fxEur ? fetched : missing).push("EUR");
  if (currencies.BTC) (fxBtc ? fetched : missing).push("BTC");

  // Collect union of all trading dates across the fetched series, clipped to range.
  const dateSet = new Set<string>();
  for (const s of [fxTry, fxRub, fxEur, fxBtc]) {
    if (!s) continue;
    for (const d of s.sortedDates) {
      if (d >= startDate && d <= endDate) dateSet.add(d);
    }
  }
  const ratesByDate = new Map<string, EntryFxRates>();
  for (const d of dateSet) {
    const r: EntryFxRates = {};
    if (fxTry) {
      const v = closeAsOf(fxTry, d);
      if (v && v > 0) r.usdPerTry = 1 / v;
    }
    if (fxRub) {
      const v = closeAsOf(fxRub, d);
      if (v && v > 0) r.usdPerRub = 1 / v;
    }
    if (fxEur) {
      const v = closeAsOf(fxEur, d);
      if (v && v > 0) r.usdPerEur = v;
    }
    if (fxBtc) {
      const v = closeAsOf(fxBtc, d);
      if (v && v > 0) r.usdPerBtc = v;
    }
    ratesByDate.set(d, r);
  }
  return { ratesByDate, fetched, missing };
}

// For a specific date, resolve rates by looking up the closest prior trading
// day in the pre-built FX map. Returns the best match (closest <= date).
export function pickRatesForDate(
  date: string,
  ratesByDate: Map<string, EntryFxRates>,
): EntryFxRates {
  if (ratesByDate.has(date)) return ratesByDate.get(date)!;
  // Walk back at most 14 days to find the most recent rates entry.
  // (FX trades 5d/week, so 7 days is enough; 14 covers extreme holiday gaps.)
  const parts = date.split("-").map(Number);
  let cur = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  for (let i = 0; i < 14; i++) {
    cur -= 86_400_000;
    const d = new Date(cur).toISOString().slice(0, 10);
    if (ratesByDate.has(d)) return ratesByDate.get(d)!;
  }
  return {};
}

async function fetchHistoricalBatch(
  symbols: string[],
  days: number,
): Promise<HistResponse> {
  if (symbols.length === 0) return {};
  const q = encodeURIComponent(symbols.join(","));
  const res = await fetch(`/api/historical?tickers=${q}&days=${days}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`historical API ${res.status}`);
  return (await res.json()) as HistResponse;
}

export async function runBackfill(input: BackfillInput): Promise<BackfillResult> {
  const { positions, brokers, cfg } = input;
  const warnings: string[] = [];

  // ── 1. Validate inputs ────────────────────────────────────────────────
  if (positions.length === 0) {
    throw new Error("Нет позиций для бэкфилла");
  }
  if (brokers.length === 0) {
    throw new Error("Нет настроенных брокеров");
  }

  // Determine date range. Prefer cfg.startDate; fall back to earliest purchaseDate.
  const earliestPurchase = positions
    .map((p) => p.purchaseDate)
    .filter(Boolean)
    .sort()[0];
  const startDate = cfg.startDate || earliestPurchase;
  if (!startDate) {
    throw new Error(
      "Не задана startDate стратегии и нет purchaseDate в позициях",
    );
  }
  const endDate = input.endDate ?? new Date().toISOString().slice(0, 10);
  if (startDate > endDate) {
    throw new Error("startDate > endDate");
  }
  const spanDays = daysBetween(startDate, endDate) + 10; // small buffer
  const fetchDays = Math.min(1000, Math.max(spanDays, 30));

  // ── 2. Fetch historical prices for all unique tickers ─────────────────
  const tickers = uniqueTickers(positions);
  if (tickers.length > 50) {
    warnings.push(
      `Тикеров ${tickers.length} > 50 — API возьмёт только первые 50.`,
    );
  }
  const priceResp = await fetchHistoricalBatch(tickers, fetchDays);

  const priceSeries: Record<string, CloseSeries> = {};
  for (const t of tickers) {
    const s = buildCloseSeries(priceResp[t]);
    if (!s) {
      warnings.push(`Нет цен для ${t} — позиция исключена.`);
      continue;
    }
    priceSeries[t] = s;
  }

  // ── 3. Fetch historical FX ────────────────────────────────────────────
  const neededCurrencies = new Set(brokers.map((b) => b.currency));
  const fxSymbolsToFetch: string[] = [];
  if (neededCurrencies.has("TRY")) fxSymbolsToFetch.push(FX_SYMBOLS.TRY);
  if (neededCurrencies.has("RUB")) fxSymbolsToFetch.push(FX_SYMBOLS.RUB);
  if (neededCurrencies.has("EUR")) fxSymbolsToFetch.push(FX_SYMBOLS.EUR);
  // BTC is informational (display only), fetch if any broker is crypto.
  if (brokers.some((b) => b.isCrypto)) fxSymbolsToFetch.push(FX_SYMBOLS.BTC);

  const fxResp = await fetchHistoricalBatch(fxSymbolsToFetch, fetchDays);
  const fxFetched: string[] = [];
  const fxTry = buildCloseSeries(fxResp[FX_SYMBOLS.TRY]);
  const fxRub = buildCloseSeries(fxResp[FX_SYMBOLS.RUB]);
  const fxEur = buildCloseSeries(fxResp[FX_SYMBOLS.EUR]);
  const fxBtc = buildCloseSeries(fxResp[FX_SYMBOLS.BTC]);
  if (fxTry) fxFetched.push("TRY");
  if (fxRub) fxFetched.push("RUB");
  if (fxEur) fxFetched.push("EUR");
  if (fxBtc) fxFetched.push("BTC");

  if (neededCurrencies.has("TRY") && !fxTry) {
    warnings.push("Нет исторического USD/TRY — балансы TRY не будут в Total.");
  }
  if (neededCurrencies.has("RUB") && !fxRub) {
    warnings.push("Нет исторического USD/RUB — балансы RUB не будут в Total.");
  }
  if (neededCurrencies.has("EUR") && !fxEur) {
    warnings.push("Нет исторического USD/EUR — балансы EUR не будут в Total.");
  }

  // ── 4. Build union of trading dates across all price series ───────────
  // We use the master set of dates from price series + FX series, filtered
  // to [startDate, endDate]. This yields actual trading days, not weekends.
  const dateSet = new Set<string>();
  for (const s of Object.values(priceSeries)) {
    for (const d of s.sortedDates) {
      if (d >= startDate && d <= endDate) dateSet.add(d);
    }
  }
  if (fxTry) for (const d of fxTry.sortedDates) if (d >= startDate && d <= endDate) dateSet.add(d);
  if (fxRub) for (const d of fxRub.sortedDates) if (d >= startDate && d <= endDate) dateSet.add(d);
  if (fxEur) for (const d of fxEur.sortedDates) if (d >= startDate && d <= endDate) dateSet.add(d);

  const allDates = Array.from(dateSet).sort((a, b) => a.localeCompare(b));
  if (allDates.length === 0) {
    throw new Error("Нет торговых дней в диапазоне — проверь даты.");
  }

  // ── 5. For each date, build the entry ─────────────────────────────────
  const entries: DiaryEntry[] = [];
  for (const date of allDates) {
    const balances: Record<string, number> = {};
    for (const b of brokers) balances[b.id] = 0;

    for (const p of positions) {
      if (p.purchaseDate && p.purchaseDate > date) continue; // not open yet
      const broker = brokers.find((b) => matchesBroker(p.broker, b));
      if (!broker) continue;
      const series = priceSeries[p.ticker];
      // If no historical series available, fall back to avgPrice
      // (so position still contributes from purchaseDate forward).
      const close = series ? closeAsOf(series, date) : undefined;
      const price = close && close > 0 ? close : p.avgPrice;
      balances[broker.id] = (balances[broker.id] || 0) + p.qty * price;
    }

    const rates: EntryFxRates = {};
    if (fxTry) {
      const tryPerUsd = closeAsOf(fxTry, date);
      if (tryPerUsd && tryPerUsd > 0) rates.usdPerTry = 1 / tryPerUsd;
    }
    if (fxRub) {
      const rubPerUsd = closeAsOf(fxRub, date);
      if (rubPerUsd && rubPerUsd > 0) rates.usdPerRub = 1 / rubPerUsd;
    }
    if (fxEur) {
      const usdPerEurVal = closeAsOf(fxEur, date);
      if (usdPerEurVal && usdPerEurVal > 0) rates.usdPerEur = usdPerEurVal;
    }
    if (fxBtc) {
      const btcUsd = closeAsOf(fxBtc, date);
      if (btcUsd && btcUsd > 0) rates.usdPerBtc = btcUsd;
    }

    entries.push({
      id: `diary-${date}`,
      date,
      balances,
      rates,
    });
  }

  return {
    entries,
    warnings,
    meta: {
      startDate,
      endDate,
      days: allDates.length,
      tickersRequested: tickers.length,
      tickersFetched: Object.keys(priceSeries).length,
      fxFetched,
    },
  };
}
