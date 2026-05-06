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
};
