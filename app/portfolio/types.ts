export type LivePosition = {
  id: number;
  ticker: string;
  name: string;
  type: string;
  qty: number;
  avgPrice: number;
  currentPrice: number;
  previousClose: number;
  color: string;
  value: number;
  pnl: number;
  pnlPct: number;
  share: number;
  action: string;
  targetShare: number;
  live: boolean;
  broker?: string;
};

export type ColId =
  | "idx" | "ticker" | "name" | "qty" | "avgPrice" | "currentPrice"
  | "value" | "pnl" | "pnlPct" | "share" | "targetShare" | "deviation"
  | "action" | "type" | "dayUsd" | "dayPct" | "beta" | "stopLoss"
  | "annReturn" | "broker";

export type ChartPoint = { date: string; value: number; cost: number };

export type Snapshot = {
  date: string;
  time: string;
  capital: number;
  profitPct: string;
  comment: string;
};
