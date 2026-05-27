// Year → Month → Week → Day grouping for the diary journal.
//
// Pure functions: takes entries + their precomputed metrics, returns flat
// row items (groups + entries) ready for the table to render.

import type { CapitalEvent, DiaryBroker, DiaryEntry, StrategyConfig } from "./types";
import { computeEntryMetrics } from "./compute";

export const MONTHS_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

const MONTHS_RU_GENITIVE = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
] as const;

// ISO 8601 week-of-year (Monday-anchored). Returns the week-year, week number,
// and the Monday/Sunday calendar range for display.
export function isoWeekInfo(dateStr: string): {
  weekYear: number;
  weekNum: number;
  key: string; // YYYY-Www, e.g. 2026-W22
  rangeLabel: string; // "25–31 мая"
} {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Thursday in this week determines the ISO week year.
  const dayNum = date.getUTCDay() || 7;
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );

  // Monday/Sunday of the calendar week containing this date.
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - (dayNum - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const mDay = monday.getUTCDate();
  const sDay = sunday.getUTCDate();
  const mMon = MONTHS_RU_GENITIVE[monday.getUTCMonth()];
  const sMon = MONTHS_RU_GENITIVE[sunday.getUTCMonth()];
  const rangeLabel = mMon === sMon
    ? `${mDay}–${sDay} ${mMon}`
    : `${mDay} ${mMon} – ${sDay} ${sMon}`;

  return {
    weekYear: thursday.getUTCFullYear(),
    weekNum,
    key: `${thursday.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`,
    rangeLabel,
  };
}

export function formatMonthLabel(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-").map(Number);
  return `${MONTHS_RU[month - 1]} ${year}`;
}

// ── Group summary ──────────────────────────────────────────────────────

export type GroupSummary = {
  // Last entry (most recent date) inside the group.
  closeTotalUsd: number;
  closePositionInvested: number;
  closeStrategyPlan: number;
  closeTarget10Pct: number;
  closeEarnedUsd: number;
  closeOverProfitPct: number;
  closeBalances: Record<string, number>;
  // First entry's open Total (for delta).
  openTotalUsd: number;
  deltaTotalUsd: number;
  deltaPct: number;
  // Sum of all transfersUsd in this group.
  transfersSum: number;
  // Date range of this group (first/last entries' dates).
  firstDate: string;
  lastDate: string;
};

function summarize(
  entries: DiaryEntry[],
  metricsByDate: Map<string, ReturnType<typeof computeEntryMetrics>>,
): GroupSummary {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const firstM = metricsByDate.get(first.date)!;
  const lastM = metricsByDate.get(last.date)!;
  const transfersSum = sorted.reduce((s, e) => s + (e.transfersUsd ?? 0), 0);
  const openTotal = firstM.totalUsd;
  const closeTotal = lastM.totalUsd;
  return {
    closeTotalUsd: closeTotal,
    closePositionInvested: lastM.positionInvested,
    closeStrategyPlan: lastM.strategyPlan,
    closeTarget10Pct: lastM.target10Pct,
    closeEarnedUsd: lastM.earnedUsd,
    closeOverProfitPct: lastM.overProfitPct,
    closeBalances: { ...last.balances },
    openTotalUsd: openTotal,
    deltaTotalUsd: closeTotal - openTotal,
    deltaPct: openTotal > 0 ? ((closeTotal - openTotal) / openTotal) * 100 : 0,
    transfersSum,
    firstDate: first.date,
    lastDate: last.date,
  };
}

// ── Row items (flattened, ready to render) ─────────────────────────────

export type GroupRowItem = {
  kind: "group";
  level: "year" | "month" | "week";
  key: string;
  label: string;
  summary: GroupSummary;
  depth: number; // 0 = year, 1 = month, 2 = week
};

export type EntryRowItem = {
  kind: "entry";
  entry: DiaryEntry;
  metrics: ReturnType<typeof computeEntryMetrics>;
  depth: number; // 3
};

export type RowItem = GroupRowItem | EntryRowItem;

export type BuildGroupedRowsInput = {
  entries: DiaryEntry[];
  brokers: DiaryBroker[];
  cfg: StrategyConfig;
  events: CapitalEvent[];
  cumulativeTransfersByDate: Record<string, number>;
  today: string;
  livePositionInvested: number | undefined;
  collapsedKeys: Set<string>;
};

// Build flat row list, applying collapse state.
// Order: most-recent year first, within year most-recent month first, etc.
// Entries within a week are sorted descending (newest at top).
export function buildGroupedRows(input: BuildGroupedRowsInput): {
  rows: RowItem[];
  allGroupKeys: string[]; // every group key encountered (for "expand all" / default collapse)
} {
  const {
    entries,
    brokers,
    cfg,
    events,
    cumulativeTransfersByDate,
    today,
    livePositionInvested,
    collapsedKeys,
  } = input;

  // Precompute metrics for every entry, keyed by date.
  const metricsByDate = new Map<string, ReturnType<typeof computeEntryMetrics>>();
  for (const e of entries) {
    metricsByDate.set(
      e.date,
      computeEntryMetrics({
        entry: e,
        brokers,
        cfg,
        events,
        positionInvested: e.date === today ? livePositionInvested : undefined,
        cumulativeTransfersUsd: cumulativeTransfersByDate[e.date] ?? 0,
      }),
    );
  }

  // Group: year > month > week
  type Bucket = { entries: DiaryEntry[]; key: string };
  const yearMap = new Map<string, Bucket>();
  const monthMap = new Map<string, Bucket>();
  const weekMap = new Map<string, Bucket>();
  const weekLabel = new Map<string, string>(); // weekKey -> "Неделя N (25–31 мая)"

  for (const e of entries) {
    const yearKey = `year:${e.date.slice(0, 4)}`;
    const monthKey = `month:${e.date.slice(0, 7)}`;
    const wi = isoWeekInfo(e.date);
    const weekKey = `week:${wi.key}`;
    if (!yearMap.has(yearKey)) yearMap.set(yearKey, { entries: [], key: yearKey });
    if (!monthMap.has(monthKey)) monthMap.set(monthKey, { entries: [], key: monthKey });
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, { entries: [], key: weekKey });
      weekLabel.set(weekKey, `Неделя ${wi.weekNum} · ${wi.rangeLabel}`);
    }
    yearMap.get(yearKey)!.entries.push(e);
    monthMap.get(monthKey)!.entries.push(e);
    weekMap.get(weekKey)!.entries.push(e);
  }

  const allGroupKeys: string[] = [];
  const rows: RowItem[] = [];

  // Iterate years descending
  const yearKeys = Array.from(yearMap.keys()).sort((a, b) => b.localeCompare(a));
  for (const yearKey of yearKeys) {
    const yearBucket = yearMap.get(yearKey)!;
    const yearLabel = yearKey.split(":")[1];
    rows.push({
      kind: "group",
      level: "year",
      key: yearKey,
      label: yearLabel,
      summary: summarize(yearBucket.entries, metricsByDate),
      depth: 0,
    });
    allGroupKeys.push(yearKey);
    if (collapsedKeys.has(yearKey)) continue;

    // Months in this year descending
    const monthKeysInYear = Array.from(monthMap.keys())
      .filter((k) => k.startsWith(`month:${yearLabel}`))
      .sort((a, b) => b.localeCompare(a));
    for (const monthKey of monthKeysInYear) {
      const monthBucket = monthMap.get(monthKey)!;
      rows.push({
        kind: "group",
        level: "month",
        key: monthKey,
        label: formatMonthLabel(monthKey.split(":")[1]),
        summary: summarize(monthBucket.entries, metricsByDate),
        depth: 1,
      });
      allGroupKeys.push(monthKey);
      if (collapsedKeys.has(monthKey)) continue;

      // Weeks that touch this month's entries
      const monthEntries = monthBucket.entries;
      const weekKeysInMonth = Array.from(
        new Set(monthEntries.map((e) => `week:${isoWeekInfo(e.date).key}`)),
      ).sort((a, b) => b.localeCompare(a));
      for (const weekKey of weekKeysInMonth) {
        // Only entries belonging to this month (avoid week-spanning duplication)
        const weekEntriesInMonth = monthEntries.filter(
          (e) => `week:${isoWeekInfo(e.date).key}` === weekKey,
        );
        rows.push({
          kind: "group",
          level: "week",
          key: weekKey,
          label: weekLabel.get(weekKey) ?? weekKey,
          summary: summarize(weekEntriesInMonth, metricsByDate),
          depth: 2,
        });
        allGroupKeys.push(weekKey);
        if (collapsedKeys.has(weekKey)) continue;

        // Daily entries descending
        const daily = [...weekEntriesInMonth].sort((a, b) =>
          b.date.localeCompare(a.date),
        );
        for (const e of daily) {
          rows.push({
            kind: "entry",
            entry: e,
            metrics: metricsByDate.get(e.date)!,
            depth: 3,
          });
        }
      }
    }
  }

  return { rows, allGroupKeys };
}

// Default collapsed set: everything except the most recent year/month/week.
// (So user opens the page and sees this-week's days, with this-month and
// this-year summary rows above.)
export function buildDefaultCollapsedKeys(entries: DiaryEntry[]): Set<string> {
  if (entries.length === 0) return new Set();
  const latest = entries
    .map((e) => e.date)
    .sort()
    .slice(-1)[0];
  const latestYear = `year:${latest.slice(0, 4)}`;
  const latestMonth = `month:${latest.slice(0, 7)}`;
  const latestWeek = `week:${isoWeekInfo(latest).key}`;
  const set = new Set<string>();
  const seenY = new Set<string>();
  const seenM = new Set<string>();
  const seenW = new Set<string>();
  for (const e of entries) {
    const yk = `year:${e.date.slice(0, 4)}`;
    const mk = `month:${e.date.slice(0, 7)}`;
    const wk = `week:${isoWeekInfo(e.date).key}`;
    if (!seenY.has(yk)) {
      seenY.add(yk);
      if (yk !== latestYear) set.add(yk);
    }
    if (!seenM.has(mk)) {
      seenM.add(mk);
      if (mk !== latestMonth) set.add(mk);
    }
    if (!seenW.has(wk)) {
      seenW.add(wk);
      if (wk !== latestWeek) set.add(wk);
    }
  }
  return set;
}
