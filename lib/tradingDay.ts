// Trading day starts at 06:00 Istanbul time (UTC+3, fixed — no DST in Turkey)
// "Day" resets at 06:00 Istanbul, not at midnight UTC

const LS_DAY_BASELINE = "portfolio-istanbul-day-baseline";
const ISTANBUL_OFFSET_MS = 3 * 3_600_000; // UTC+3
const DAY_START_HOUR = 6;

export interface DayBaseline {
  dayKey: string; // YYYY-MM-DD (Istanbul date of the trading day)
  value: number;  // portfolio total at day start
  setAt: number;  // unix ms
}

/**
 * Returns the "trading day key" in Istanbul date format.
 * If Istanbul time is before 06:00, the trading day is still the previous calendar day.
 */
export function getTradingDayKey(): string {
  const now = new Date();
  const istanbulTime = new Date(now.getTime() + ISTANBUL_OFFSET_MS);
  if (istanbulTime.getUTCHours() < DAY_START_HOUR) {
    istanbulTime.setUTCDate(istanbulTime.getUTCDate() - 1);
  }
  return istanbulTime.toISOString().slice(0, 10);
}

/** Returns true when the trading day has started (Istanbul time >= 06:00). */
export function isTradingDayStarted(): boolean {
  const now = new Date();
  const istanbulTime = new Date(now.getTime() + ISTANBUL_OFFSET_MS);
  return istanbulTime.getUTCHours() >= DAY_START_HOUR;
}

/**
 * Returns true when any major market is in pre-market or regular/extended session.
 * Dead zone: 01:00–09:00 Istanbul (no significant market activity).
 */
export function isMarketHoursNow(): boolean {
  const now = new Date();
  const h = new Date(now.getTime() + ISTANBUL_OFFSET_MS).getUTCHours();
  return !(h >= 1 && h < 9);
}

/** Returns current time in Istanbul as HH:MM string (for display). */
export function getIstanbulTimeStr(): string {
  return new Date().toLocaleTimeString("ru-RU", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function saveDayBaseline(value: number): void {
  if (value <= 0) return;
  const data: DayBaseline = {
    dayKey: getTradingDayKey(),
    value: Math.round(value),
    setAt: Date.now(),
  };
  try { localStorage.setItem(LS_DAY_BASELINE, JSON.stringify(data)); } catch {}
}

/**
 * Returns the saved baseline for today's trading day, or null if none.
 * Returns null if the saved baseline is for a different trading day.
 */
export function loadDayBaseline(): number | null {
  try {
    const raw = localStorage.getItem(LS_DAY_BASELINE);
    if (!raw) return null;
    const d: DayBaseline = JSON.parse(raw);
    if (!d.dayKey || !d.value || d.value <= 0) return null;
    if (d.dayKey !== getTradingDayKey()) return null;
    return d.value;
  } catch {
    return null;
  }
}
