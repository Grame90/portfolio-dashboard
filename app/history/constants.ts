import type { EventItem } from "./types";

export const TYPE_COLOR: Record<string, string> = {
  "Акция": "#7c3aed",
  "ETF": "#3b82f6",
  "Сырьё": "#f59e0b",
  "Крипто": "#f97316",
  "Облигация": "#06b6d4",
  "Кэш": "#22c55e",
};

export const HIST_PERIODS = ["1M", "3M", "6M", "YTD", "1Y", "ALL"] as const;
export type HistPeriod = (typeof HIST_PERIODS)[number];

export const CASH_FLOW_PERIODS = ["1М", "3М", "6М", "YTD"];

export const FALLBACK_EVENTS: EventItem[] = (() => {
  const dFwd = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  };
  return [
    { date: dFwd(3),  event: "Протокол FOMC",           importance: "Высокая" },
    { date: dFwd(7),  event: "Инфляция CPI (м/м)",      importance: "Высокая" },
    { date: dFwd(12), event: "Решение ФРС по ставке",   importance: "Высокая" },
    { date: dFwd(16), event: "ВВП (кв/кв)",             importance: "Высокая" },
    { date: dFwd(20), event: "Занятость вне с/х (NFP)", importance: "Высокая" },
    { date: dFwd(25), event: "Базовый PCE (м/м)",       importance: "Высокая" },
  ];
})();
