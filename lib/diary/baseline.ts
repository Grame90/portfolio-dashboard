// Strategy baseline — single calendar-day track.
//
// Plan(date) = invested(date) + accumulated_growth(date)
//   where growth in each [eventA, eventB) segment is computed as:
//     invested_in_segment * annualRate * calendarDaysInSegment / 365
//
// Capital events (deposits / withdrawals / purchases) shift invested.
// Between events, growth is linear by calendar days (weekends included).

import type {
  CapitalEvent,
  StrategyConfig,
} from "./types";

// ── Date helpers ────────────────────────────────────────────────────────

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
}

// Calendar days between [from, to] inclusive of both ends. from > to → 0.
export function countCalendarDays(from: string, to: string): number {
  if (from > to) return 0;
  const a = parseDate(from).getTime();
  const b = parseDate(to).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

// ── Segment builder ─────────────────────────────────────────────────────

type Segment = {
  start: string; // inclusive
  end: string; // inclusive
  invested: number;
};

function buildSegments(
  startDate: string,
  initialInvested: number,
  events: CapitalEvent[],
  until: string,
): Segment[] {
  if (until < startDate || initialInvested < 0) return [];

  const relevantEvents = events
    .filter((e) => e.date > startDate && e.date <= until)
    .sort((a, b) => a.date.localeCompare(b.date));

  const segments: Segment[] = [];
  let currentInvested = initialInvested;
  let currentStart = startDate;

  for (const ev of relevantEvents) {
    segments.push({
      start: currentStart,
      end: addDays(ev.date, -1),
      invested: currentInvested,
    });
    currentInvested += ev.amountUsd;
    currentStart = ev.date;
  }

  segments.push({
    start: currentStart,
    end: until,
    invested: currentInvested,
  });

  return segments;
}

// ── Public API ──────────────────────────────────────────────────────────

export type BaselineResult = {
  date: string;
  invested: number; // invested on `date` (after all events up to and incl. date)
  plan: number; // strategy plan amount on `date`
};

export function computeBaseline(
  date: string,
  cfg: StrategyConfig,
  events: CapitalEvent[],
): BaselineResult {
  if (!cfg.startDate || date < cfg.startDate) {
    return { date, invested: 0, plan: 0 };
  }

  const segments = buildSegments(
    cfg.startDate,
    cfg.initialInvested,
    events,
    date,
  );

  let accumulatedProfit = 0;
  let finalInvested = cfg.initialInvested;

  for (const seg of segments) {
    // Days elapsed *within* this segment starting the day AFTER segment start
    // (so seg[start, start] contributes 0 days = pure baseline).
    const segDuration = countCalendarDays(addDays(seg.start, 1), seg.end);
    accumulatedProfit += (seg.invested * cfg.annualRate * segDuration) /
      cfg.calendarDaysPerYear;
    finalInvested = seg.invested;
  }

  return {
    date,
    invested: finalInvested,
    plan: finalInvested + accumulatedProfit,
  };
}

export function computeBaselineSeries(
  dates: string[],
  cfg: StrategyConfig,
  events: CapitalEvent[],
): BaselineResult[] {
  return dates.map((date) => computeBaseline(date, cfg, events));
}
