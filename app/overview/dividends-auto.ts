import type { StoredPosition } from "@/lib/types";
import { DIVIDEND_YIELDS } from "./constants";
import type { ReceivedDividend } from "./types";

// US ETFs/stocks that pay dividends typically distribute quarterly.
// We approximate dividend payment dates as the last day of each calendar quarter.
const QUARTER_END_MONTHS = [2, 5, 8, 11]; // Mar, Jun, Sep, Dec (zero-indexed)

function quarterKey(date: string): string {
  // "YYYY-QN" for the calendar quarter containing date
  const d = new Date(date);
  const m = d.getUTCMonth();
  return `${d.getUTCFullYear()}-Q${Math.floor(m / 3) + 1}`;
}

function quarterEndDatesBetween(fromIso: string, toIso: string): string[] {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const dates: string[] = [];
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return dates;

  for (let y = from.getUTCFullYear(); y <= to.getUTCFullYear(); y++) {
    for (const m of QUARTER_END_MONTHS) {
      const lastDay = new Date(Date.UTC(y, m + 1, 0));
      // strictly after purchase + on or before today
      if (lastDay > from && lastDay <= to) {
        dates.push(lastDay.toISOString().slice(0, 10));
      }
    }
  }
  return dates;
}

/**
 * Generates dividend entries that should exist historically based on each
 * position's purchaseDate and known annual yield. Only returns entries that
 * aren't already present (deduped by ticker+quarter).
 *
 * Amount per share is estimated as `avgPrice × yield% / 4`. The user can edit
 * if they need exact values.
 */
export function generateBackfillDividends(
  positions: StoredPosition[],
  existing: ReceivedDividend[],
): ReceivedDividend[] {
  const today = new Date().toISOString().slice(0, 10);

  // Skip any (ticker, quarter) already covered by an existing entry —
  // whether previously generated, manually added, or imported.
  const existingKeys = new Set(existing.map(d => `${d.ticker}-${quarterKey(d.date)}`));

  const newEntries: ReceivedDividend[] = [];

  for (const p of positions) {
    if (p.type === "Кэш") continue;
    if (!p.purchaseDate) continue;
    if (p.qty <= 0 || p.avgPrice <= 0) continue;

    const yieldPct = DIVIDEND_YIELDS[p.ticker];
    if (!yieldPct || yieldPct <= 0) continue;

    const dates = quarterEndDatesBetween(p.purchaseDate, today);
    const amountPerShare = (p.avgPrice * yieldPct) / 100 / 4;
    if (amountPerShare <= 0) continue;

    for (const date of dates) {
      const key = `${p.ticker}-${quarterKey(date)}`;
      if (existingKeys.has(key)) continue;
      const totalUSD = p.qty * amountPerShare;
      newEntries.push({
        id: `auto-${p.id}-${date}`,
        ticker: p.ticker,
        amountPerShare: Number(amountPerShare.toFixed(4)),
        shares: p.qty,
        totalUSD: Number(totalUSD.toFixed(2)),
        date,
        note: "Автоматически (оценка)",
        broker: p.broker,
        source: "auto",
        positionId: p.id,
      });
      existingKeys.add(key);
    }
  }

  return newEntries;
}

/**
 * Returns a transient list of "pending" dividend entries representing the
 * current quarter's expected dividend per dividend-paying position, only when
 * not already paid (i.e. no entry exists for this ticker × current quarter).
 *
 * These entries are NOT persisted. They're rendered above the received list
 * with a "Зачислить" action.
 */
export function generatePendingDividends(
  positions: StoredPosition[],
  existing: ReceivedDividend[],
): ReceivedDividend[] {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const currentQ = quarterKey(todayStr);

  const existingKeys = new Set(existing.map(d => `${d.ticker}-${quarterKey(d.date)}`));

  const pending: ReceivedDividend[] = [];

  for (const p of positions) {
    if (p.type === "Кэш") continue;
    if (!p.purchaseDate || p.purchaseDate > todayStr) continue;
    if (p.qty <= 0 || p.avgPrice <= 0) continue;

    const yieldPct = DIVIDEND_YIELDS[p.ticker];
    if (!yieldPct || yieldPct <= 0) continue;

    const key = `${p.ticker}-${currentQ}`;
    if (existingKeys.has(key)) continue;

    const amountPerShare = (p.avgPrice * yieldPct) / 100 / 4;
    const totalUSD = p.qty * amountPerShare;
    if (totalUSD <= 0) continue;

    pending.push({
      id: `pending-${p.id}-${currentQ}`,
      ticker: p.ticker,
      amountPerShare: Number(amountPerShare.toFixed(4)),
      shares: p.qty,
      totalUSD: Number(totalUSD.toFixed(2)),
      date: todayStr,
      note: `Ожидается за ${currentQ}`,
      broker: p.broker,
      source: "pending",
      positionId: p.id,
    });
  }

  return pending;
}
