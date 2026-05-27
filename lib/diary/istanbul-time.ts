// Istanbul-anchored calendar day helpers.
//
// Diary uses Istanbul (UTC+3, no DST) as its calendar reference, with a
// 03:00 day boundary instead of midnight:
//   • Wall clock 03:00 Istanbul → diary day flips to the new date
//   • Wall clock 00:00–02:59 Istanbul → still the previous diary day
// Rationale: snapshot fires at 03:00 Istanbul when markets are mostly quiet;
// labelling pre-03:00 hours as "yesterday" keeps the snapshot for the day
// that just ended.

const ISTANBUL_UTC_OFFSET_MS = 3 * 3600_000;
const DAY_ROLLOVER_HOUR = 3; // 03:00 Istanbul

// Returns the Istanbul wall-clock view for a given UTC Date.
function istanbulOf(date: Date): Date {
  return new Date(date.getTime() + ISTANBUL_UTC_OFFSET_MS);
}

// YYYY-MM-DD of the current diary day (Istanbul, 03:00 rollover).
// At 02:59 Istanbul of Jan 15 → returns "2026-01-14".
// At 03:00 Istanbul of Jan 15 → returns "2026-01-15".
export function istanbulToday(now: Date = new Date()): string {
  const istanbul = istanbulOf(now);
  if (istanbul.getUTCHours() < DAY_ROLLOVER_HOUR) {
    // Still in the previous diary day until rollover hits.
    istanbul.setUTCDate(istanbul.getUTCDate() - 1);
  }
  return istanbul.toISOString().slice(0, 10);
}

// Hour-of-day (0-23) in Istanbul.
export function istanbulHour(now: Date = new Date()): number {
  return istanbulOf(now).getUTCHours();
}

// True iff `now` is past the 03:00 Istanbul rollover that ends the diary
// day represented by `dateIso`. (Each diary day "ends" at 03:00 Istanbul
// of the next calendar day.)
export function isPastDailyFreeze(dateIso: string, now: Date = new Date()): boolean {
  const [y, m, d] = dateIso.split("-").map(Number);
  // Cutoff in UTC = (dateIso + 1 day) at 03:00 Istanbul = 00:00 UTC.
  const cutoffUtc = Date.UTC(y, m - 1, d + 1, 0, 0, 0);
  return now.getTime() >= cutoffUtc;
}

// Generate the list of YYYY-MM-DD strings between (exclusive) `afterDate`
// and (inclusive) `untilDate`. Used to fill in skipped days when user
// hasn't opened the diary for a while.
export function listDatesBetween(afterDate: string | null, untilDate: string): string[] {
  if (!untilDate) return [];
  if (!afterDate) return [untilDate];
  const result: string[] = [];
  const [ay, am, ad] = afterDate.split("-").map(Number);
  const [uy, um, ud] = untilDate.split("-").map(Number);
  let cur = Date.UTC(ay, am - 1, ad) + 86_400_000;
  const until = Date.UTC(uy, um - 1, ud);
  while (cur <= until) {
    result.push(new Date(cur).toISOString().slice(0, 10));
    cur += 86_400_000;
  }
  return result;
}
