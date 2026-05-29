import {
  portfolioHistory1M,
  portfolioHistory3M,
  portfolioHistoryYTD,
  portfolioHistory1Y,
} from "@/lib/mockData";
import type { PositionForm } from "./types";

export const TYPE_TABS = ["ВСЕ ПОЗИЦИИ", "АКЦИИ", "ETF", "СЫРЬЁ", "КРИПТО", "КЭШ"];
export const PERIOD_OPTIONS = ["1Д", "7Д", "1М", "3М", "6М", "YTD", "1Г", "ВСЕ"];

export const CHART_DATA_MAP: Record<string, typeof portfolioHistory1M> = {
  "1М": portfolioHistory1M,
  "3М": portfolioHistory3M,
  "YTD": portfolioHistoryYTD,
  "1Г": portfolioHistory1Y,
  "1Д": portfolioHistory1M.slice(-5),
  "7Д": portfolioHistory1M.slice(-7),
  "6М": portfolioHistoryYTD,
  "ВСЕ": portfolioHistory1Y,
};

export const COLORS = [
  "#7c3aed", "#9d6ef5", "#3b82f6", "#06b6d4", "#f59e0b", "#94a3b8",
  "#ef4444", "#ec4899", "#22c55e", "#84cc16", "#f97316", "#a855f7",
];

export const TYPES = ["ETF", "Акция", "Крипто", "Сырьё", "Облигация", "Кэш"];

export const CASH_CURRENCIES = [
  { code: "USD",  name: "Доллар США",           flag: "🇺🇸", color: "#22c55e", defaultRate: 1 },
  { code: "EUR",  name: "Евро",                  flag: "🇪🇺", color: "#3b82f6", defaultRate: 1.08 },
  { code: "GBP",  name: "Фунт стерлингов",       flag: "🇬🇧", color: "#8b5cf6", defaultRate: 1.27 },
  { code: "CHF",  name: "Швейцарский франк",     flag: "🇨🇭", color: "#06b6d4", defaultRate: 1.11 },
  { code: "CAD",  name: "Канадский доллар",      flag: "🇨🇦", color: "#84cc16", defaultRate: 0.73 },
  { code: "AED",  name: "Дирхам ОАЭ",            flag: "🇦🇪", color: "#f97316", defaultRate: 0.272 },
  { code: "CNY",  name: "Китайский юань",        flag: "🇨🇳", color: "#ec4899", defaultRate: 0.138 },
  { code: "JPY",  name: "Японская иена",         flag: "🇯🇵", color: "#94a3b8", defaultRate: 0.0067 },
  { code: "TRY",  name: "Турецкая лира",         flag: "🇹🇷", color: "#ef4444", defaultRate: 0.028 },
  { code: "RUB",  name: "Российский рубль",      flag: "🇷🇺", color: "#f59e0b", defaultRate: 0.011 },
  { code: "AZN",  name: "Азербайджанский манат", flag: "🇦🇿", color: "#06b6d4", defaultRate: 0.588 },
  { code: "GEL",  name: "Грузинский лари",       flag: "🇬🇪", color: "#84cc16", defaultRate: 0.364 },
  { code: "USDT", name: "Tether (стейблкоин)",   flag: "💵",  color: "#22c55e", defaultRate: 1 },
];

export const TICKER_BETA: Record<string, number> = {
  VOO: 1.00, QQQ: 1.12, SMH: 1.35, SOXX: 1.30, GLD: -0.08,
  SLV: 0.12, "BRK.B": 0.82, TSLA: 1.85, IBKR: 1.10,
};

export const LS_POSITIONS = "positions-data";

export const TODAY = new Date().toISOString().slice(0, 10);
export const TODAY_MS = new Date().getTime();

export const EMPTY_FORM: PositionForm = {
  ticker: "",
  name: "",
  type: "ETF",
  qty: "",
  avgPrice: "",
  currentPrice: "",
  previousClose: "",
  color: COLORS[0],
  purchaseDate: TODAY,
  broker: "",
};

export const BROKERS = ["Interactive Brokers", "Binance", "Bybit", "Midas"];

export const BROKER_COLORS = [
  "#7c3aed", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#f97316", "#a855f7", "#84cc16",
];

export const PURCHASE_DATES: Record<number, string> = {
  1: "2023-02-14", 2: "2023-01-09", 3: "2022-11-21",
  4: "2023-04-03", 5: "2022-10-17", 6: "2022-09-05",
  7: "2023-03-28", 8: "2023-07-12", 9: "2022-12-01", 10: "",
};
