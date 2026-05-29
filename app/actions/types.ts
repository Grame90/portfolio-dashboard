export type TargetRow = { ticker: string; target: number };

export type SortField = "date" | "type" | "ticker" | "qty" | "price" | "amount" | "commission" | "pnl";

export type Recommendation = {
  action: string;
  reason: string;
  priority: string;
};

export type DeviationPoint = {
  ticker: string;
  deviation: number;
};
