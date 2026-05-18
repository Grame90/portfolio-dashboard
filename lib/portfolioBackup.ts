import { StoredPosition } from "./types";

export const BACKUP_KEYS = [
  "positions-data",
  "dashboard-settings",
  "portfolio-chart-history",
  "dividends-received",
  "snapshots-data",
  "target-structure",
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
