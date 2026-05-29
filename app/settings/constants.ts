export const SETTINGS_TABS = ["ПОДКЛЮЧЕНИЯ", "УВЕДОМЛЕНИЯ", "РИСК-ПРОФИЛЬ", "ПОРТФЕЛЬ", "ДАННЫЕ", "АККАУНТ"] as const;

export const STORAGE_INFO = [
  { key: "positions-data", label: "Позиции" },
  { key: "dashboard-settings", label: "Настройки" },
  { key: "portfolio-chart-history", label: "История портфеля" },
  { key: "dividends-received", label: "Дивиденды" },
  { key: "snapshots-data", label: "Снимки" },
  { key: "target-structure", label: "Целевая структура" },
];

export interface RiskPreset {
  maxDrawdown: number;
  maxPositionSize: number;
  minCash: number;
  stopLoss: number;
  rebalancePeriod: string;
}

export const RISK_PRESETS: Record<string, RiskPreset> = {
  "Консервативный": { maxDrawdown: 10, maxPositionSize: 15, minCash: 20, stopLoss: 8,  rebalancePeriod: "Ежеквартально" },
  "Умеренный":      { maxDrawdown: 15, maxPositionSize: 20, minCash: 10, stopLoss: 12, rebalancePeriod: "Квартально" },
  "Средний":        { maxDrawdown: 20, maxPositionSize: 25, minCash: 5,  stopLoss: 15, rebalancePeriod: "Полугодово" },
  "Агрессивный":    { maxDrawdown: 35, maxPositionSize: 40, minCash: 2,  stopLoss: 25, rebalancePeriod: "Ежегодно" },
};

export const RISK_CONFIGS: Record<string, { color: string; desc: string }> = {
  "Консервативный": { color: "#22c55e", desc: "Сохранение капитала, минимальный риск" },
  "Умеренный":      { color: "#3b82f6", desc: "Баланс роста и защиты" },
  "Средний":        { color: "#f59e0b", desc: "Умеренный рост с допустимым риском" },
  "Агрессивный":    { color: "#ef4444", desc: "Максимальный рост, высокий риск" },
};

export interface NotificationItem {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  { id: "price_alert",   label: "Ценовые оповещения",        description: "Уведомления при достижении целевой цены инструмента",  enabled: true },
  { id: "pnl_alert",     label: "Изменение P&L",             description: "Уведомления при изменении P&L более чем на 5%",        enabled: true },
  { id: "rebalance",     label: "Напоминание о ребалансировке", description: "Периодические напоминания о ребалансировке портфеля", enabled: false },
  { id: "earnings",      label: "Отчёты компаний",            description: "Уведомления о предстоящих квартальных отчётах",        enabled: true },
  { id: "dividends",     label: "Дивидендные выплаты",        description: "Напоминания о датах дивидендных выплат",               enabled: false },
  { id: "macro",         label: "Макроэкономические события", description: "ФРС, CPI, NFP и другие ключевые события",              enabled: true },
  { id: "drawdown",      label: "Просадка портфеля",          description: "Уведомление при просадке портфеля ниже установленного порога", enabled: true },
  { id: "daily_summary", label: "Дневной итог",               description: "Ежедневная сводка по портфелю в конце торгового дня",  enabled: false },
];

export const LS_NOTIFICATIONS = "dashboard-notifications";
