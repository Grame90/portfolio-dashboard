export type AlertLevel = "green" | "yellow" | "red";

export type DipSignal = "buy" | "weak" | "none";

export interface DipInstrument {
  ticker: string;
  price: number;
  dailyChangePct: number;
  dipThreshold: number;
  dipReached: boolean;
  rsi14: number | null;
  ma200: number | null;
  aboveMa200: boolean | null;
  allocPct: number;
  signal: DipSignal;
  reason: string;
}

export interface MarketDip {
  vix: number | null;
  vixZone: "risk-on" | "neutral" | "risk-off" | "unknown";
  overall: DipSignal;
  instruments: DipInstrument[];
  updatedAt: number;
}

export interface AlertItem {
  icon: string;
  text: string;
  level: AlertLevel;
}

export interface Recommendation {
  text: string;
}

export interface Indicator {
  id: string;
  label: string;
  value: string;
  level: AlertLevel;
  note: string;
}
