export type StoredPosition = {
  id: number;
  ticker: string;
  name: string;
  type: string;
  qty: number;
  avgPrice: number;
  color: string;
  purchaseDate: string;
  action: string;
  broker?: string;
};

export type Settings = {
  portfolioName: string;
  targetAmount: number;
  monthlyContribution: number;
  investmentHorizon: number;
  targetIncome: number;
  riskLevel: string;
  maxDrawdown: number;
  maxPositionSize: number;
  minCash: number;
  stopLoss: number;
  rebalancePeriod: string;
  currency: string;
};

export type LiveQuote = {
  current: number;
  previousClose: number;
  // Yahoo's market state (REGULAR / CLOSED / PRE / POST / …) for the ticker's
  // primary exchange. Useful so the UI can flag stale ETF prices outside
  // market hours.
  marketState?: string;
  // For commodity ETFs: corresponding futures symbol and its current %
  // change vs previousClose — the "real" intraday move underlying the ETF.
  futureSymbol?: string;
  futurePct?: number;
};
