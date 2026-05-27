// Group diary entries and capital events by period (day / week / month / year).
// Week = ISO week (Monday start). All dates are YYYY-MM-DD strings.

import type {
  CapitalEvent,
  DiaryEntry,
  Period,
} from "./types";

// ── Period keys ─────────────────────────────────────────────────────────

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

// ISO week-numbering year + week. Returns "YYYY-Www" e.g. "2026-W03".
export function getIsoWeekKey(iso: string): string {
  const d = parseDate(iso);
  // Shift to nearest Thursday: current date + 4 - current day number
  // (Sunday is 0 → treat as 7).
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export function getMonthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

export function getYearKey(iso: string): string {
  return iso.slice(0, 4); // YYYY
}

export function getPeriodKey(iso: string, period: Period): string {
  switch (period) {
    case "day":
      return iso;
    case "week":
      return getIsoWeekKey(iso);
    case "month":
      return getMonthKey(iso);
    case "year":
      return getYearKey(iso);
  }
}

// ── Grouping ────────────────────────────────────────────────────────────

export type PeriodGroup<T> = {
  key: string;
  items: T[];
};

export function groupByPeriod<T extends { date: string }>(
  items: T[],
  period: Period,
): PeriodGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const it of items) {
    const k = getPeriodKey(it.date, period);
    const arr = buckets.get(k) ?? [];
    arr.push(it);
    buckets.set(k, arr);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, items]) => ({ key, items }));
}

// ── Period summaries ────────────────────────────────────────────────────

export type PeriodSummary = {
  key: string;
  period: Period;
  entryCount: number;
  firstDate: string;
  lastDate: string;
  // Total at start/end of period
  totalStart: number;
  totalEnd: number;
  deltaUsd: number;
  deltaPct: number;
  // Capital events that happened in this period
  capitalIn: number; // sum of positive amounts
  capitalOut: number; // sum of negative amounts (as positive number)
  eventCount: number;
};

export function summarizePeriod(
  entries: DiaryEntry[],
  events: CapitalEvent[],
  period: Period,
  key: string,
): PeriodSummary | null {
  const inPeriod = entries
    .filter((e) => getPeriodKey(e.date, period) === key)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (inPeriod.length === 0) return null;

  const first = inPeriod[0];
  const last = inPeriod[inPeriod.length - 1];
  const totalStart = first.totalUsd ?? 0;
  const totalEnd = last.totalUsd ?? 0;
  const deltaUsd = totalEnd - totalStart;
  const deltaPct = totalStart > 0 ? (deltaUsd / totalStart) * 100 : 0;

  const evs = events.filter((e) => getPeriodKey(e.date, period) === key);
  let capitalIn = 0;
  let capitalOut = 0;
  for (const ev of evs) {
    if (ev.amountUsd >= 0) capitalIn += ev.amountUsd;
    else capitalOut += -ev.amountUsd;
  }

  return {
    key,
    period,
    entryCount: inPeriod.length,
    firstDate: first.date,
    lastDate: last.date,
    totalStart,
    totalEnd,
    deltaUsd,
    deltaPct,
    capitalIn,
    capitalOut,
    eventCount: evs.length,
  };
}

// ── Human-readable labels ───────────────────────────────────────────────

const MONTH_LABELS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export function formatPeriodKey(key: string, period: Period): string {
  switch (period) {
    case "day": {
      const [y, m, d] = key.split("-");
      return `${d}.${m}.${y}`;
    }
    case "week": {
      const [y, w] = key.split("-W");
      return `${y}, неделя ${Number(w)}`;
    }
    case "month": {
      const [y, m] = key.split("-");
      const monthIdx = Number(m) - 1;
      return `${MONTH_LABELS_RU[monthIdx] ?? m} ${y}`;
    }
    case "year":
      return key;
  }
}
