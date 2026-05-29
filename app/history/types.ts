export type Snapshot = {
  date: string;
  time: string;
  capital: number;
  cost: number;
  profit: number;
  profitPct: string;
  comment: string;
};

export type Operation = {
  date: string;
  ticker: string;
  action: string;
  qty: number;
  price: number;
  sum: number;
};

export type RecommendedAction = {
  action: string;
  priority: "Высокий" | "Средний" | "Низкий";
  reason: string;
};

export type EventItem = {
  kind?: string;
  date: string;
  isoDate?: string;
  event: string;
  importance: string;
  estimate?: string | null;
  actual?: string | null;
  ticker?: string | null;
};

export type TargetRow = { ticker: string; target: number };

export type DistributionSlice = {
  name: string;
  value: number;
  color: string;
  pct: string;
};

export type RebalanceItem = {
  action: string;
  deviation: string;
  target: string;
  deadline: string;
};

export type CashFlowData = {
  deposits: number;
  withdrawals: number;
  fixedProfit: number;
  reinvested: number;
  netFlow: number;
};

export type Goal = {
  goal: string;
  detail: string;
  pct: number;
  status: string;
  color: string;
};
