// LocalStorage repository for diary entries, capital events, brokers,
// strategy config, and column visibility. Pure functions.

import type {
  CapitalEvent,
  ColumnVisibilityState,
  DiaryBroker,
  DiaryEntry,
  StrategyConfig,
} from "./types";
import {
  DEFAULT_COLUMN_VISIBILITY,
  DEFAULT_STRATEGY_CONFIG,
  makeDefaultBrokers,
} from "./types";

export const LS_DIARY_ENTRIES = "diary-entries-v1";
export const LS_DIARY_CAPITAL_EVENTS = "diary-capital-events-v1";
export const LS_DIARY_STRATEGY = "diary-strategy-v1";
export const LS_DIARY_BROKERS = "diary-brokers-v1";
export const LS_DIARY_COLUMNS = "diary-columns-v1";
export const LS_DIARY_IMPORT_DIAG = "diary-import-diag-v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ── Diary entries ───────────────────────────────────────────────────────

export function loadDiaryEntries(): DiaryEntry[] {
  if (typeof window === "undefined") return [];
  const rows = safeParse<DiaryEntry[]>(
    localStorage.getItem(LS_DIARY_ENTRIES),
    [],
  );
  // Migrate Sprint 1 entries: ensure `rates` and `balances` exist.
  // Old shape had per-key balances (e.g. balances.ibkr) which already match
  // the new dynamic-id format for default brokers.
  const migrated = rows.map((r) => ({
    ...r,
    balances: r.balances ?? {},
    rates: r.rates ?? {},
  }));
  return migrated.sort((a, b) => a.date.localeCompare(b.date));
}

export function saveDiaryEntries(entries: DiaryEntry[]): void {
  if (typeof window === "undefined") return;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(LS_DIARY_ENTRIES, JSON.stringify(sorted));
}

export function upsertDiaryEntry(entry: DiaryEntry): DiaryEntry[] {
  const all = loadDiaryEntries();
  const idx = all.findIndex((e) => e.date === entry.date);
  const next = idx >= 0
    ? all.map((e, i) => (i === idx ? entry : e))
    : [...all, entry];
  saveDiaryEntries(next);
  return next;
}

export function deleteDiaryEntry(id: string): DiaryEntry[] {
  const next = loadDiaryEntries().filter((e) => e.id !== id);
  saveDiaryEntries(next);
  return next;
}

// ── Capital events ──────────────────────────────────────────────────────

export function loadCapitalEvents(): CapitalEvent[] {
  if (typeof window === "undefined") return [];
  const rows = safeParse<CapitalEvent[]>(
    localStorage.getItem(LS_DIARY_CAPITAL_EVENTS),
    [],
  );
  return [...rows].sort((a, b) => a.date.localeCompare(b.date));
}

export function saveCapitalEvents(events: CapitalEvent[]): void {
  if (typeof window === "undefined") return;
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(LS_DIARY_CAPITAL_EVENTS, JSON.stringify(sorted));
}

export function upsertCapitalEvent(event: CapitalEvent): CapitalEvent[] {
  const all = loadCapitalEvents();
  const idx = all.findIndex((e) => e.id === event.id);
  const next = idx >= 0
    ? all.map((e, i) => (i === idx ? event : e))
    : [...all, event];
  saveCapitalEvents(next);
  return next;
}

export function deleteCapitalEvent(id: string): CapitalEvent[] {
  const next = loadCapitalEvents().filter((e) => e.id !== id);
  saveCapitalEvents(next);
  return next;
}

// ── Strategy config ─────────────────────────────────────────────────────

export function loadStrategyConfig(): StrategyConfig {
  if (typeof window === "undefined") return DEFAULT_STRATEGY_CONFIG;
  return safeParse<StrategyConfig>(
    localStorage.getItem(LS_DIARY_STRATEGY),
    DEFAULT_STRATEGY_CONFIG,
  );
}

export function saveStrategyConfig(cfg: StrategyConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_DIARY_STRATEGY, JSON.stringify(cfg));
}

// ── Brokers ─────────────────────────────────────────────────────────────

export function loadBrokers(): DiaryBroker[] {
  if (typeof window === "undefined") return makeDefaultBrokers();
  const raw = localStorage.getItem(LS_DIARY_BROKERS);
  if (!raw) return makeDefaultBrokers();
  const parsed = safeParse<DiaryBroker[]>(raw, []);
  if (parsed.length === 0) return makeDefaultBrokers();
  return [...parsed].sort((a, b) => a.order - b.order);
}

export function saveBrokers(brokers: DiaryBroker[]): void {
  if (typeof window === "undefined") return;
  const sorted = [...brokers].sort((a, b) => a.order - b.order);
  localStorage.setItem(LS_DIARY_BROKERS, JSON.stringify(sorted));
}

export function upsertBroker(broker: DiaryBroker): DiaryBroker[] {
  const all = loadBrokers();
  const idx = all.findIndex((b) => b.id === broker.id);
  const next = idx >= 0
    ? all.map((b, i) => (i === idx ? broker : b))
    : [...all, broker];
  saveBrokers(next);
  return next;
}

export function deleteBroker(id: string): DiaryBroker[] {
  const next = loadBrokers().filter((b) => b.id !== id);
  saveBrokers(next);
  return next;
}

// ── Column visibility ───────────────────────────────────────────────────

export function loadColumnVisibility(): ColumnVisibilityState {
  if (typeof window === "undefined") return DEFAULT_COLUMN_VISIBILITY;
  return safeParse<ColumnVisibilityState>(
    localStorage.getItem(LS_DIARY_COLUMNS),
    DEFAULT_COLUMN_VISIBILITY,
  );
}

export function saveColumnVisibility(state: ColumnVisibilityState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_DIARY_COLUMNS, JSON.stringify(state));
}

// ── Import diagnostics (last-run snapshot) ──────────────────────────────

import type { ImportDiagnostics } from "./import";

export function loadImportDiagnostics(): ImportDiagnostics | null {
  if (typeof window === "undefined") return null;
  return safeParse<ImportDiagnostics | null>(
    localStorage.getItem(LS_DIARY_IMPORT_DIAG),
    null,
  );
}

export function saveImportDiagnostics(diag: ImportDiagnostics): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_DIARY_IMPORT_DIAG, JSON.stringify(diag));
}

// ── Reset ───────────────────────────────────────────────────────────────

export function clearDiaryStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LS_DIARY_ENTRIES);
  localStorage.removeItem(LS_DIARY_CAPITAL_EVENTS);
  localStorage.removeItem(LS_DIARY_STRATEGY);
  localStorage.removeItem(LS_DIARY_BROKERS);
  // Do NOT clear column visibility — user UI preference
}
