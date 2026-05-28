// Build a diary snapshot from the current portfolio positions.
//
// Each broker's balance is computed in its NATIVE currency:
//   balance[brokerId] = Σ qty × (currentPrice || avgPrice)  for positions
//                       whose `broker` field matches that broker's
//                       positionBrokers list (case-insensitive).
//
// `positionInvested` (cost-basis in USD) is computed alongside for the
// "Инвестировано (из позиций)" column. It sums avgPrice across all positions
// in all brokers, converted to USD via the entry's FX rates.
//
// This is a pure function — pass in positions/quotes/brokers/rates,
// get back a structured result.

import type { LiveQuote, StoredPosition } from "../types";
import { toUsd } from "./compute";
import type {
  BrokerCurrency,
  DiaryBroker,
  EntryFxRates,
} from "./types";

export type PositionSnapshotResult = {
  // Balances keyed by broker id, in each broker's native currency.
  balances: Record<string, number>;
  // Cost-basis of all matched positions, converted to USD.
  positionInvestedUsd: number;
  // Brokers we couldn't compute USD for (rate missing). For UI warnings.
  missingRates: BrokerCurrency[];
  // Positions that have a `broker` but no diary broker mapped them.
  unmappedBrokers: string[];
};

function matchesBroker(positionBroker: string | undefined, broker: DiaryBroker): boolean {
  if (!positionBroker) return false;
  const needle = positionBroker.toLowerCase().trim();
  return broker.positionBrokers.some(
    (name) => name.toLowerCase().trim() === needle,
  );
}

function currentPrice(p: StoredPosition, quotes: Record<string, LiveQuote>): number {
  const live = quotes[p.ticker]?.current;
  return live && live > 0 ? live : p.avgPrice;
}

export function buildSnapshotFromPositions(input: {
  positions: StoredPosition[];
  quotes: Record<string, LiveQuote>;
  brokers: DiaryBroker[];
  rates: EntryFxRates;
}): PositionSnapshotResult {
  const { positions, quotes, brokers, rates } = input;

  const balances: Record<string, number> = {};
  for (const b of brokers) balances[b.id] = 0;

  let costBasisUsd = 0;
  const missingRates = new Set<BrokerCurrency>();
  const unmappedBrokers = new Set<string>();

  for (const p of positions) {
    const broker = brokers.find((b) => matchesBroker(p.broker, b));
    if (!broker) {
      if (p.broker) unmappedBrokers.add(p.broker);
      continue;
    }
    const price = currentPrice(p, quotes);
    const native = p.qty * price;
    balances[broker.id] = (balances[broker.id] || 0) + native;

    // Cost basis for "Инвестировано (из позиций)" — uses avgPrice.
    const cost = p.qty * p.avgPrice;
    const costInUsd = toUsd(cost, broker.currency, rates);
    if (costInUsd === null) {
      missingRates.add(broker.currency);
    } else {
      costBasisUsd += costInUsd;
    }
  }

  return {
    balances,
    positionInvestedUsd: Math.round(costBasisUsd * 100) / 100,
    missingRates: Array.from(missingRates),
    unmappedBrokers: Array.from(unmappedBrokers),
  };
}
