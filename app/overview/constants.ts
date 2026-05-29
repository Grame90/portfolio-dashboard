export const PERIOD_OPTIONS = ["7Д", "1М", "3М", "6М", "YTD", "1Г", "ВСЕ"];

export const LS_CHART = "portfolio-chart-history";
export const LS_DIVIDENDS = "dividends-received";

// Known annual dividend yields (%) — used across pages
export const DIVIDEND_YIELDS: Record<string, number> = {
  VOO: 1.30, QQQ: 0.60, SPY: 1.25, IVV: 1.28, VTI: 1.40,
  SMH: 0.68, SOXX: 1.18, XLK: 0.70, ARKK: 0.00,
  GLD: 0.00, SLV: 0.00, IAU: 0.00,
  "BRK.B": 0.00, TSLA: 0.00, AAPL: 0.50, MSFT: 0.80,
  NVDA: 0.03, AMZN: 0.00, GOOGL: 0.00, META: 0.40,
  IBKR: 0.90, JPM: 2.20, BAC: 2.50, V: 0.75, MA: 0.55,
  JNJ: 3.00, PFE: 5.80, KO: 3.10, PG: 2.30, T: 6.50,
};
