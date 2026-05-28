// Daily auto-snapshot orchestrator.
//
// Behaviour:
//   • The latest entry has date === istanbulToday() and `isLive: true`.
//   • All earlier entries are frozen (`isLive: false`).
//   • On every mount (and on a tick interval), `ensureTodayEntry()` is called:
//       - If no entry exists for today's Istanbul date → create one (live).
//       - If an entry exists but it's older → freeze whatever's there as
//         yesterday's snapshot, then create today.
//   • The live row's balances ARE refreshed from /positions on every call.
//   • Manual edits to past entries (balances/transfers/comment) persist.
//   • Manual edits to today's transfers/comment persist; balances cannot
//     be edited until the day rolls over.

import type { LiveQuote, StoredPosition } from "../types";
import { buildSnapshotFromPositions } from "./positions-snapshot";
import { fetchCurrentRates } from "./fx";
import { istanbulToday } from "./istanbul-time";
import {
  loadBrokers,
  upsertDiaryEntry,
} from "./storage";
import type { DiaryBroker, DiaryEntry, EntryFxRates } from "./types";

// Optional `isLive` marker stashed on the entry (kept off the canonical type
// so older stored rows still parse). True only for the most recent row that
// mirrors live /positions. Everything else is frozen.
export function isEntryLive(e: DiaryEntry): boolean {
  return (e as DiaryEntry & { isLive?: boolean }).isLive === true;
}
export function markLive(e: DiaryEntry, live: boolean): DiaryEntry {
  return { ...e, isLive: live } as DiaryEntry;
}

// Build a fresh entry for the given date using current positions & rates.
export function buildLiveEntry(
  date: string,
  positions: StoredPosition[],
  quotes: Record<string, LiveQuote>,
  brokers: DiaryBroker[],
  rates: EntryFxRates,
): DiaryEntry {
  const snap = buildSnapshotFromPositions({ positions, quotes, brokers, rates });
  return {
    id: `diary-${date}`,
    date,
    balances: snap.balances,
    rates,
  };
}

// Pure: returns next entries[] that satisfies daily-snapshot invariants.
// Caller saves to storage if identity changed.
//
// Rules:
//   • Any entry flagged `isLive` with date < today gets frozen.
//   • If today's entry exists, its balances are REFRESHED to current /positions;
//     transfers/comment/manualInvested are preserved.
//   • If today's entry doesn't exist, append a new live one.
export function ensureTodayEntry(
  entries: DiaryEntry[],
  positions: StoredPosition[],
  quotes: Record<string, LiveQuote>,
  brokers: DiaryBroker[],
  rates: EntryFxRates,
): DiaryEntry[] {
  if (positions.length === 0 || brokers.length === 0) return entries;
  const today = istanbulToday();
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  // Freeze any "live" entry that is no longer today.
  const frozen = sorted.map((e) =>
    isEntryLive(e) && e.date < today ? markLive(e, false) : e,
  );

  const snap = buildSnapshotFromPositions({ positions, quotes, brokers, rates });
  const lastIdx = frozen.length - 1;
  const last = lastIdx >= 0 ? frozen[lastIdx] : null;

  if (last && last.date === today) {
    const refreshed: DiaryEntry = { ...last, balances: snap.balances, rates };
    const next = [...frozen];
    next[lastIdx] = markLive(refreshed, true);
    return next;
  }

  const todayEntry = markLive(
    buildLiveEntry(today, positions, quotes, brokers, rates),
    true,
  );
  return [...frozen, todayEntry];
}

// ── Back-compat: existing call site (PageHeader "Фиксация" button) ─────
// Synchronous one-shot snapshot for today, persisted via upsertDiaryEntry.
// Kept here so other code that imports `writeDiarySnapshotForToday` from
// this module still compiles.
export async function writeDiarySnapshotForToday(input: {
  positions: StoredPosition[];
  quotes: Record<string, LiveQuote>;
  comment?: string;
}): Promise<DiaryEntry> {
  const { positions, quotes, comment } = input;
  const brokers = loadBrokers();
  const rates = await fetchCurrentRates();
  const entry = buildLiveEntry(
    istanbulToday(),
    positions,
    quotes,
    brokers,
    rates,
  );
  const withComment: DiaryEntry = comment ? { ...entry, comment } : entry;
  upsertDiaryEntry(withComment);
  return withComment;
}
