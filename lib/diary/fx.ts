// Client-side FX rates fetcher.
//
// Calls /api/rates (server-cached for 30 min), parses into EntryFxRates
// (USD-per-unit shape). Client-side memo cache is 10 minutes.

import type { EntryFxRates } from "./types";

type ApiRatesShape = {
  EUR: number; // X per 1 USD
  TRY: number;
  RUB: number;
  BTC: number; // USD per 1 BTC
};

let cache: { rates: EntryFxRates; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function toEntryFxRates(api: ApiRatesShape): EntryFxRates {
  return {
    usdPerTry: api.TRY > 0 ? 1 / api.TRY : undefined,
    usdPerRub: api.RUB > 0 ? 1 / api.RUB : undefined,
    usdPerEur: api.EUR > 0 ? 1 / api.EUR : undefined,
    usdPerBtc: api.BTC > 0 ? api.BTC : undefined,
  };
}

export async function fetchCurrentRates(
  options: { force?: boolean } = {},
): Promise<EntryFxRates> {
  const now = Date.now();
  if (
    !options.force &&
    cache &&
    now - cache.fetchedAt < CACHE_TTL_MS
  ) {
    return cache.rates;
  }
  try {
    const res = await fetch("/api/rates", { cache: "no-store" });
    if (!res.ok) throw new Error("rates fetch failed");
    const data = (await res.json()) as ApiRatesShape;
    const rates = toEntryFxRates(data);
    cache = { rates, fetchedAt: now };
    return rates;
  } catch {
    // Return last good cache if any, else empty (caller handles missing rates).
    return cache?.rates ?? {};
  }
}

// For UI display: "1 USD = X" — invert the per-USD rate.
// Returns 0 if rate is missing.
export function getPerUsd(
  rates: EntryFxRates,
  currency: "TRY" | "RUB" | "EUR",
): number {
  const r = currency === "TRY"
    ? rates.usdPerTry
    : currency === "RUB"
    ? rates.usdPerRub
    : rates.usdPerEur;
  return r && r > 0 ? 1 / r : 0;
}
