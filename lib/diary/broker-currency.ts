// Infer a broker's native currency by inspecting which positions live there.
//
// Each position has a `ticker` that often encodes its listing exchange via a
// suffix (`.IS` = BIST/Turkey, `.ME` = MOEX/Russia, etc.). We pick the most
// common listing currency across all positions matched to this broker.
//
// Plain US-style tickers (no suffix, e.g. AAPL) → USD.
// Crypto tickers (BTC, ETH, plain symbols flagged as crypto type) → USD,
// because the diary treats crypto-broker balances as USD-equivalent.

import type { StoredPosition } from "../types";
import type { BrokerCurrency } from "./types";

// Suffix → currency map.
const SUFFIX_TO_CCY: Array<{ suffixes: string[]; currency: BrokerCurrency }> = [
  { suffixes: [".IS", ".BIST"], currency: "TRY" },
  { suffixes: [".ME", ".MM", ".RTS"], currency: "RUB" },
  {
    suffixes: [
      ".PA", // Paris
      ".DE", // XETRA
      ".F", // Frankfurt
      ".MI", // Milan
      ".AS", // Amsterdam
      ".MC", // Madrid
      ".LS", // Lisbon
      ".VI", // Vienna
      ".BR", // Brussels
      ".HE", // Helsinki
      ".IR", // Dublin
      ".BE", // Berlin
      ".MU", // Munich
      ".SG", // Stuttgart
      ".DU", // Dusseldorf
      ".HA", // Hamburg
    ],
    currency: "EUR",
  },
];

export function inferCurrencyFromTicker(ticker: string): BrokerCurrency | null {
  const t = ticker.toUpperCase().trim();
  if (!t) return null;
  for (const { suffixes, currency } of SUFFIX_TO_CCY) {
    if (suffixes.some((s) => t.endsWith(s))) return currency;
  }
  // No suffix → assume USD (NYSE/NASDAQ default).
  return "USD";
}

// Given a list of position-broker names (the broker's mapping) and the full
// position list, find positions belonging to this broker and pick the most
// common inferred currency. Returns null if no positions match.
export function inferBrokerCurrency(
  positionBrokerNames: string[],
  positions: StoredPosition[],
): BrokerCurrency | null {
  if (positionBrokerNames.length === 0 || positions.length === 0) return null;
  const needles = positionBrokerNames.map((n) => n.toLowerCase().trim());
  const counts: Record<string, number> = {};
  for (const p of positions) {
    if (!p.broker) continue;
    const b = p.broker.toLowerCase().trim();
    if (!needles.includes(b)) continue;
    const ccy = inferCurrencyFromTicker(p.ticker);
    if (!ccy) continue;
    counts[ccy] = (counts[ccy] || 0) + 1;
  }
  let best: BrokerCurrency | null = null;
  let bestCount = 0;
  for (const ccy of Object.keys(counts) as BrokerCurrency[]) {
    if (counts[ccy] > bestCount) {
      best = ccy;
      bestCount = counts[ccy];
    }
  }
  return best;
}

// Helper: build a summary string for UI hint ("USD 5 · EUR 2 · TRY 1").
export function summarizeCurrencyMix(
  positionBrokerNames: string[],
  positions: StoredPosition[],
): string {
  const needles = positionBrokerNames.map((n) => n.toLowerCase().trim());
  const counts: Record<string, number> = {};
  for (const p of positions) {
    if (!p.broker) continue;
    const b = p.broker.toLowerCase().trim();
    if (!needles.includes(b)) continue;
    const ccy = inferCurrencyFromTicker(p.ticker);
    if (!ccy) continue;
    counts[ccy] = (counts[ccy] || 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "";
  return entries.map(([c, n]) => `${c} ${n}`).join(" · ");
}
