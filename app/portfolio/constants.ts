import type { ColId } from "./types";

export const POSITION_COLORS = [
  "#7c3aed", "#9d6ef5", "#3b82f6", "#06b6d4", "#f59e0b",
  "#94a3b8", "#ef4444", "#ec4899", "#22c55e", "#84cc16", "#f97316", "#a855f7",
];

export const COLORS = ["#7c3aed", "#f59e0b", "#3b82f6", "#22c55e"];

export const TICKER_BETA: Record<string, number> = {
  VOO: 1.00, QQQ: 1.12, SMH: 1.35, SOXX: 1.30, GLD: -0.08,
  SLV: 0.12, "BRK.B": 0.82, TSLA: 1.85, IBKR: 1.10,
};

export const PURCHASE_DATES: Record<string, string> = {
  VOO: "2023-02-14", QQQ: "2023-01-09", SMH: "2022-11-21",
  SOXX: "2023-04-03", GLD: "2022-10-17", SLV: "2022-09-05",
  "BRK.B": "2023-03-28", TSLA: "2023-07-12", IBKR: "2022-12-01",
};

export const ALL_COLS: { id: ColId; label: string; extra?: boolean }[] = [
  { id: "idx",          label: "#" },
  { id: "ticker",       label: "Тикер" },
  { id: "name",         label: "Инструмент" },
  { id: "qty",          label: "Кол-во" },
  { id: "avgPrice",     label: "Ср.цена" },
  { id: "currentPrice", label: "Тек.цена" },
  { id: "value",        label: "Стоимость" },
  { id: "pnl",          label: "P/L USD" },
  { id: "pnlPct",       label: "P/L %" },
  { id: "share",        label: "Доля" },
  { id: "targetShare",  label: "Цел.доля" },
  { id: "deviation",    label: "Откл." },
  { id: "action",       label: "Действие" },
  { id: "type",         label: "Тип",        extra: true },
  { id: "dayUsd",       label: "День $",     extra: true },
  { id: "dayPct",       label: "День %",     extra: true },
  { id: "beta",         label: "Бета",       extra: true },
  { id: "stopLoss",     label: "Стоп-лосс",  extra: true },
  { id: "annReturn",    label: "Год. дох.",  extra: true },
  { id: "broker",       label: "Брокер",     extra: true },
];

export const DEFAULT_COLS = new Set<ColId>([
  "idx", "ticker", "name", "qty", "avgPrice", "currentPrice",
  "value", "pnl", "pnlPct", "share", "targetShare", "deviation", "action",
]);

export const DEFAULT_LADDER_STEP = 5;
export const DEFAULT_LADDER_LEVELS = 4;

export const PERIOD_OPTIONS = ["1Д", "7Д", "1М", "3М", "6М", "YTD", "1Г", "ВСЕ"];

export const LS_CHART = "portfolio-chart-history";
