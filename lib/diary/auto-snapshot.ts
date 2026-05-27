// Auto-snapshot helper shared by:
//   - DashboardProvider scheduled 03:00 Istanbul writer
//   - PageHeader "Фиксация" button
//   - /diary "Снять снимок сейчас" button
//
// Reads current positions + quotes, fetches FX rates, builds entry,
// upserts by date. Safe to call without positions (writes empty entry).

import type { LiveQuote, StoredPosition } from "../types";
import { fetchCurrentRates } from "./fx";
import { buildSnapshotFromPositions } from "./positions-snapshot";
import {
  loadBrokers,
  upsertDiaryEntry,
} from "./storage";
import type { DiaryEntry } from "./types";

export async function writeDiarySnapshotForToday(input: {
  positions: StoredPosition[];
  quotes: Record<string, LiveQuote>;
  comment?: string;
}): Promise<DiaryEntry> {
  const { positions, quotes, comment } = input;
  const brokers = loadBrokers();
  const rates = await fetchCurrentRates();
  const snap = buildSnapshotFromPositions({
    positions,
    quotes,
    brokers,
    rates,
  });
  const today = new Date().toISOString().slice(0, 10);
  const entry: DiaryEntry = {
    id: `diary-${today}`,
    date: today,
    balances: snap.balances,
    rates,
    comment,
  };
  upsertDiaryEntry(entry);
  return entry;
}
