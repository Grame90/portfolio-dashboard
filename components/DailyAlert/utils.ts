import type { AlertLevel, DipSignal, MarketDip } from "./types";

export const DISMISS_KEY = "daily-alert-dismissed";

export const LEVEL_ORDER: Record<AlertLevel, number> = { green: 0, yellow: 1, red: 2 };

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === todayKey();
  } catch {
    return false;
  }
}

export function dismissToday(): void {
  try {
    localStorage.setItem(DISMISS_KEY, todayKey());
  } catch {}
}

// ── Market Dip helpers ────────────────────────────────────────────────────

export function dipLabel(s: DipSignal): string {
  return s === "buy" ? "✅ ПОКУПКА" : s === "weak" ? "⚠️ СЛАБО" : "🚫 ЖДЁМ";
}

export function dipColor(s: DipSignal): string {
  return s === "buy" ? "#22c55e" : s === "weak" ? "#f59e0b" : "#94a3b8";
}

export function dipBg(s: DipSignal): string {
  if (s === "buy") return "rgba(34,197,94,0.12)";
  if (s === "weak") return "rgba(245,158,11,0.12)";
  return "rgba(148,163,184,0.10)";
}

export function vixZoneLabel(z: MarketDip["vixZone"]): string {
  if (z === "risk-on") return "risk-on";
  if (z === "neutral") return "neutral";
  if (z === "risk-off") return "risk-off";
  return "—";
}

export function vixColor(z: MarketDip["vixZone"]): string {
  if (z === "risk-on") return "#22c55e";
  if (z === "neutral") return "#f59e0b";
  if (z === "risk-off") return "#ef4444";
  return "#94a3b8";
}
