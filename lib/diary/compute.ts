// Derived metrics for a diary entry.
//
// Two parallel views of "invested":
//   1. Strategy invested — initial + capital events (lives in baseline.ts)
//   2. Position-based invested — cost-basis of holdings + cash from /positions
//      (lives outside the diary; passed in as positionInvestedUsd)

import { computeBaseline } from "./baseline";
import type {
  CapitalEvent,
  DiaryBroker,
  DiaryEntry,
  EntryFxRates,
  StrategyConfig,
} from "./types";

// ── FX conversion ───────────────────────────────────────────────────────

// Convert a balance in `currency` to USD using rates from the entry.
// Returns null when the rate is missing (so the caller can render "—").
// Defensive against missing `rates` object (legacy entries from Sprint 1).
export function toUsd(
  amount: number,
  currency: string,
  rates: EntryFxRates | undefined,
): number | null {
  if (!amount) return 0;
  const r = rates ?? {};
  switch (currency) {
    case "USD":
      return amount;
    case "TRY":
      return r.usdPerTry ? amount * r.usdPerTry : null;
    case "RUB":
      return r.usdPerRub ? amount * r.usdPerRub : null;
    case "EUR":
      return r.usdPerEur ? amount * r.usdPerEur : null;
    default:
      return null;
  }
}

// Sum all broker balances in USD. Brokers with missing rates contribute 0
// to the sum but are reported in `missingRates` so UI can flag them.
export function sumBalancesInUsd(
  entry: DiaryEntry,
  brokers: DiaryBroker[],
): { totalUsd: number; missingRates: string[] } {
  let total = 0;
  const missingRates: string[] = [];
  for (const b of brokers) {
    const amt = entry.balances[b.id] || 0;
    if (!amt) continue;
    const usd = toUsd(amt, b.currency, entry.rates);
    if (usd === null) {
      missingRates.push(`${b.label} (${b.currency})`);
    } else {
      total += usd;
    }
  }
  return { totalUsd: total, missingRates };
}

// ── Entry metrics ───────────────────────────────────────────────────────

export type EntryMetrics = {
  date: string;
  // Total in USD (sum of all broker balances converted)
  totalUsd: number;
  missingRates: string[];
  // Strategy baseline (from baseline.ts)
  strategyInvested: number;
  strategyPlan: number;
  overProfitUsd: number; // total − strategyPlan
  overProfitPct: number; // overProfitUsd / strategyPlan × 100
  // Position-based metrics (passed in from caller)
  positionInvested: number; // cost + cash from /positions, in USD
  target10Pct: number; // positionInvested × annualRate × daysFromStart / 365
  earnedUsd: number; // totalUsd − positionInvested (raw profit on what's deployed)
};

export type EntryMetricsInput = {
  entry: DiaryEntry;
  brokers: DiaryBroker[];
  cfg: StrategyConfig;
  events: CapitalEvent[];
  positionInvested?: number; // optional, defaults to strategyInvested
};

function daysSinceStart(date: string, startDate: string): number {
  if (!startDate || date < startDate) return 0;
  const a = Date.UTC(
    Number(startDate.slice(0, 4)),
    Number(startDate.slice(5, 7)) - 1,
    Number(startDate.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function computeEntryMetrics(
  input: EntryMetricsInput,
): EntryMetrics {
  const { entry, brokers, cfg, events } = input;
  const { totalUsd: computedTotal, missingRates } = sumBalancesInUsd(entry, brokers);
  // If the source row had its own Total USD column, trust it.
  const totalUsd = entry.totalUsd && entry.totalUsd > 0
    ? entry.totalUsd
    : computedTotal;
  const baseline = computeBaseline(entry.date, cfg, events);

  // Prefer imported plan from the source spreadsheet over the computed
  // baseline, but fall back to computed for entries created without import.
  const strategyPlan = entry.importedPlan && entry.importedPlan > 0
    ? entry.importedPlan
    : baseline.plan;

  // overProfit: prefer imported %, derive USD from it; otherwise compute both.
  let overProfitPct: number;
  let overProfitUsd: number;
  if (entry.importedOverProfitPct !== undefined) {
    overProfitPct = entry.importedOverProfitPct;
    overProfitUsd = strategyPlan > 0
      ? (overProfitPct / 100) * strategyPlan
      : 0;
  } else {
    overProfitUsd = totalUsd - strategyPlan;
    overProfitPct = strategyPlan > 0
      ? (overProfitUsd / strategyPlan) * 100
      : 0;
  }

  // positionInvested: imported wins, otherwise caller-provided, otherwise
  // strategy baseline invested.
  const positionInvested = entry.importedInvested && entry.importedInvested > 0
    ? entry.importedInvested
    : (input.positionInvested ?? baseline.invested);

  const days = daysSinceStart(entry.date, cfg.startDate);
  const target10Pct =
    (positionInvested * cfg.annualRate * days) / cfg.calendarDaysPerYear;
  const earnedUsd = totalUsd - positionInvested;

  return {
    date: entry.date,
    totalUsd,
    missingRates,
    strategyInvested: baseline.invested,
    strategyPlan,
    overProfitUsd,
    overProfitPct,
    positionInvested,
    target10Pct,
    earnedUsd,
  };
}

// ── Day-over-day delta ──────────────────────────────────────────────────

export type DailyDelta = {
  deltaTotalUsd: number;
  deltaTotalPct: number;
  deltaOverProfitPct: number;
};

export function computeDailyDelta(
  current: EntryMetrics,
  previous: EntryMetrics | null,
): DailyDelta {
  if (!previous) {
    return { deltaTotalUsd: 0, deltaTotalPct: 0, deltaOverProfitPct: 0 };
  }
  const deltaTotalUsd = current.totalUsd - previous.totalUsd;
  const deltaTotalPct = previous.totalUsd > 0
    ? (deltaTotalUsd / previous.totalUsd) * 100
    : 0;
  const deltaOverProfitPct = current.overProfitPct - previous.overProfitPct;
  return { deltaTotalUsd, deltaTotalPct, deltaOverProfitPct };
}
