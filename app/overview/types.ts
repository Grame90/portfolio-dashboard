export type ChartPoint = { date: string; value: number; cost: number };

export type DividendSource = "manual" | "auto" | "pending";

export type ReceivedDividend = {
  id: string;
  ticker: string;
  amountPerShare: number;
  shares: number;
  totalUSD: number;
  date: string;
  note: string;
  broker?: string;
  source?: DividendSource;
  positionId?: number;
};
