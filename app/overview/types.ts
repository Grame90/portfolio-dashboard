export type ChartPoint = { date: string; value: number; cost: number };

export type ReceivedDividend = {
  id: string;
  ticker: string;
  amountPerShare: number;
  shares: number;
  totalUSD: number;
  date: string;
  note: string;
};
