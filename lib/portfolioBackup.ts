import { StoredPosition } from "./types";

export const BACKUP_KEYS = [
  "positions-data",
  "dashboard-settings",
  "portfolio-chart-history",
  "dividends-received",
  "snapshots-data",
  "target-structure",
] as const;

// All keys touched by the app. Used by the "Reset all data" button on /settings
// to clear instruments, money, snapshots, imports, triggers, cached layouts —
// the full user-data surface, not just the backup-worthy subset.
export const RESET_ALL_KEYS = [
  // Positions + their backup + sync metadata
  "positions-data",
  "positions-data-backup",
  "positions-data-updated-at",
  // Dashboard settings + notifications
  "dashboard-settings",
  "dashboard-notifications",
  // History, snapshots, dividends, targets
  "portfolio-chart-history",
  "snapshots-data",
  "dividends-received",
  "target-structure",
  // /report standalone data (separate from auto-snapshots)
  "report-snapshots",
  "report-imported-rows-v1",
  // /triggers, /actions
  "triggers-data",
  "operations-log",
  // /portfolio UI prefs
  "portfolio-cols",
  "portfolio-col-order",
  "ladder-levels",
  "ladder-step",
  // /analytics chart profiles
  "chart-grid-profiles",
  // Market ticker cache
  "mt-price-cache",
  // Trading-day baseline + dedup flags
  "portfolio-istanbul-day-baseline",
  "auto-snapshot-date",
  // Cached external data + UI dismissals
  "calendar-cache-v2",
  "daily-alert-dismissed",
] as const;

type BackupPayload = Record<string, unknown>;

function unwrapPositions(value: unknown): StoredPosition[] {
  if (Array.isArray(value)) return value as StoredPosition[];
  if (
    value &&
    typeof value === "object" &&
    "state" in value &&
    value.state &&
    typeof value.state === "object" &&
    "positions" in value.state &&
    Array.isArray(value.state.positions)
  ) {
    return value.state.positions as StoredPosition[];
  }
  return [];
}

export function extractBackupPositions(payload: BackupPayload): StoredPosition[] {
  return unwrapPositions(payload["positions-data"]).length
    ? unwrapPositions(payload["positions-data"])
    : unwrapPositions(payload.positions);
}

export function importBackupPayload(payload: BackupPayload) {
  for (const key of BACKUP_KEYS) {
    if (key === "positions-data") continue;
    if (payload[key] != null) localStorage.setItem(key, JSON.stringify(payload[key]));
  }

  const legacyMap: Record<string, string> = {
    settings: "dashboard-settings",
    history: "portfolio-chart-history",
    dividends: "dividends-received",
    snapshots: "snapshots-data",
    targetStructure: "target-structure",
  };

  for (const [from, to] of Object.entries(legacyMap)) {
    if (payload[from] != null) localStorage.setItem(to, JSON.stringify(payload[from]));
  }

  return extractBackupPositions(payload);
}
