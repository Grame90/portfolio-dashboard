"use client";

// Shared constants, helpers and small primitives used across the Analytics page sections.

export const periodOptions = ["1М", "3М", "6М", "YTD", "1Г", "ВСЕ"];

export const TICKER_BETA_A: Record<string, number> = {
  BTC: 2.5, ETH: 2.8, SOL: 3.0, DOGE: 3.5, XRP: 2.2,
  TSLA: 2.0, NVDA: 1.8, META: 1.4, AMZN: 1.3, GOOGL: 1.2, AAPL: 1.2, MSFT: 1.1,
  QQQ: 1.1, ARKK: 1.6, SMH: 1.5, SOXX: 1.4, XLK: 1.2,
  SPY: 1.0, VOO: 1.0, IVV: 1.0, VTI: 1.0,
  GLD: 0.0, SLV: 0.1, IAU: 0.0,
  "BRK.B": 0.9, JPM: 1.2, BAC: 1.3, V: 0.9, MA: 0.9, IBKR: 1.1,
  JNJ: 0.5, PFE: 0.6, KO: 0.5, PG: 0.5, T: 0.5,
};

export const typeColors: Record<string, string> = {
  ETF: "#7c3aed", Акция: "#3b82f6", Крипто: "#f59e0b", Сырьё: "#22c55e",
  Кэш: "#94a3b8", Облигация: "#06b6d4",
};

export const marketColors: Record<string, string> = {
  США: "#7c3aed", Крипто: "#f59e0b", Сырьё: "#22c55e", Кэш: "#3b82f6", Облигации: "#06b6d4",
};

export type FactorWeights = {
  market?: number; growth?: number; value?: number; quality?: number;
  momentum?: number; lowVol?: number; size?: number;
};

export const FACTORS: Record<string, FactorWeights> = {
  TSLA: { market: 0.9, growth: 0.95, quality: 0.5, momentum: 0.7 },
  NVDA: { market: 0.95, growth: 0.92, quality: 0.7, momentum: 0.88 },
  META: { market: 0.9, growth: 0.82, quality: 0.75, momentum: 0.72 },
  AMZN: { market: 0.88, growth: 0.78, quality: 0.72 },
  GOOGL: { market: 0.88, growth: 0.72, quality: 0.78 },
  MSFT: { market: 0.88, growth: 0.65, quality: 0.88, momentum: 0.6 },
  AAPL: { market: 0.88, growth: 0.55, quality: 0.85, momentum: 0.55 },
  QQQ:  { market: 1.0, growth: 0.72, momentum: 0.65 },
  SPY:  { market: 1.0, value: 0.45, quality: 0.6, size: 0.3 },
  VOO:  { market: 1.0, value: 0.45, quality: 0.6, size: 0.3 },
  VTI:  { market: 1.0, value: 0.45, quality: 0.6, size: 0.5 },
  SMH:  { market: 0.95, growth: 0.85, momentum: 0.78 },
  SOXX: { market: 0.95, growth: 0.82, momentum: 0.75 },
  ARKK: { market: 0.9, growth: 0.95, momentum: 0.8 },
  "BRK.B": { market: 0.85, value: 0.82, quality: 0.88, lowVol: 0.55 },
  JPM:  { market: 0.88, value: 0.72, quality: 0.7 },
  KO:   { market: 0.6, value: 0.78, quality: 0.8, lowVol: 0.72 },
  JNJ:  { market: 0.6, value: 0.65, quality: 0.85, lowVol: 0.7 },
  GLD:  { market: 0.1, lowVol: 0.3 },
  SLV:  { market: 0.15, lowVol: 0.2 },
  IAU:  { market: 0.1, lowVol: 0.3 },
  BTC:  { market: 0.3, growth: 0.7, momentum: 0.75 },
  ETH:  { market: 0.3, growth: 0.75, momentum: 0.7 },
};

export function pearsonCorr(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const as = a.slice(-n), bs = b.slice(-n);
  const ma = as.reduce((s, v) => s + v, 0) / n;
  const mb = bs.reduce((s, v) => s + v, 0) / n;
  const num = as.reduce((s, v, i) => s + (v - ma) * (bs[i] - mb), 0);
  const da = Math.sqrt(as.reduce((s, v) => s + (v - ma) ** 2, 0));
  const db = Math.sqrt(bs.reduce((s, v) => s + (v - mb) ** 2, 0));
  return da && db ? num / (da * db) : 0;
}

export function CorrelationCell({ value }: { value: number }) {
  const abs = Math.abs(value);
  const bg = value > 0
    ? `rgba(124,58,237,${abs * 0.7})`
    : `rgba(239,68,68,${abs * 0.7})`;
  return (
    <td style={{
      padding: "6px", textAlign: "center", fontSize: 11, fontWeight: 600,
      background: bg, color: abs > 0.5 ? "white" : "var(--text-primary)", border: "1px solid var(--border)",
    }}>
      {value.toFixed(2)}
    </td>
  );
}
