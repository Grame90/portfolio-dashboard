import type { SortField } from "./types";

export const TABS = ["ВСЕ ДЕЙСТВИЯ", "ПРИОРИТЕТНЫЕ", "ЗАПЛАНИРОВАННЫЕ", "ИСТОРИЯ"];

export const PRIORITY_COLOR: Record<string, string> = {
  "Высокий": "#ef4444",
  "Средний": "#f59e0b",
  "Низкий": "#94a3b8",
  "Критический": "#7c3aed",
};

export const PRIORITY_BG: Record<string, string> = {
  "Высокий": "rgba(239,68,68,0.12)",
  "Средний": "rgba(245,158,11,0.12)",
  "Низкий": "rgba(148,163,184,0.12)",
  "Критический": "rgba(124,58,237,0.12)",
};

export const TYPE_COLOR: Record<string, string> = {
  "Покупка":        "#22c55e",
  "Продажа":        "#ef4444",
  "Дивиденды":      "#f59e0b",
  "Ребалансировка": "#7c3aed",
};

export const TYPE_BG: Record<string, string> = {
  "Покупка":        "rgba(34,197,94,0.12)",
  "Продажа":        "rgba(239,68,68,0.12)",
  "Дивиденды":      "rgba(245,158,11,0.12)",
  "Ребалансировка": "rgba(124,58,237,0.12)",
};

export const SORT_FIELDS: readonly SortField[] = [
  "date", "type", "ticker", "qty", "price", "amount", "commission", "pnl",
];

export const HISTORY_TYPES = ["Все", "Покупка", "Продажа", "Дивиденды", "Ребалансировка"];

export const HISTORY_PERIODS = ["1М", "3М", "6М", "1Г", "Всё"];

export const HISTORY_PERIOD_DAYS: Record<string, number> = {
  "1М": 30, "3М": 90, "6М": 180, "1Г": 365, "Всё": 99999,
};

export const LS_TARGET = "target-structure";

export const PAGE_SIZE = 10;
