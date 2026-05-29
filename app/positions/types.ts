export type Position = {
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
  live: boolean;
  purchaseDate: string;
  broker?: string;
};

export type SavedPosition = Pick<
  Position,
  "id" | "ticker" | "name" | "type" | "qty" | "avgPrice" | "color" | "purchaseDate" | "action" | "broker"
>;

export type PositionForm = {
  ticker: string;
  name: string;
  type: string;
  qty: string;
  avgPrice: string;
  currentPrice: string;
  previousClose: string;
  color: string;
  purchaseDate: string;
  broker: string;
};
