// ── Date helpers ──────────────────────────────────────────────────────────────
function fmt(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
function dAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n); return fmt(d);
}
function dFwd(n: number): string {
  const d = new Date(); d.setDate(d.getDate() + n); return fmt(d);
}
// ──────────────────────────────────────────────────────────────────────────────

export const portfolioTotal = 314565;
export const portfolioCurrency = "USD";
export const lastUpdated = (() => {
  const now = new Date();
  return `${fmt(now)} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
})();

// avgPrice = historical purchase price (bought 1–2 years ago)
// previousClose = yesterday's closing price (for daily P&L)
export const positions = [
  { id: 1, ticker: "VOO",      name: "Vanguard S&P 500 ETF",     type: "ETF",   qty: 100.617,  avgPrice: 468.30, currentPrice: 606.20, previousClose: 601.50, value: 60963,  pnl: 13873, pnlPct:  29.47, share: 19.39, targetShare: 25.0, action: "Докупить",   color: "#7c3aed" },
  { id: 2, ticker: "QQQ",      name: "Invesco QQQ Trust",         type: "ETF",   qty: 126.0191, avgPrice: 372.15, currentPrice: 577.03, previousClose: 571.90, value: 72729,  pnl: 25826, pnlPct:  55.01, share: 23.11, targetShare: 15.0, action: "Фиксировать", color: "#9d6ef5" },
  { id: 3, ticker: "SMH",      name: "VanEck Semiconductor ETF",  type: "ETF",   qty: 68.1382,  avgPrice: 148.60, currentPrice: 341.29, previousClose: 350.10, value: 23257,  pnl: 13130, pnlPct: 129.67, share:  7.39, targetShare: 10.0, action: "Докупить",   color: "#3b82f6" },
  { id: 4, ticker: "SOXX",     name: "iShares Semiconductor ETF", type: "ETF",   qty: 8.0,      avgPrice: 208.40, currentPrice: 287.70, previousClose: 296.80, value:  2302,  pnl:   634, pnlPct:  38.05, share:  0.73, targetShare: 10.0, action: "Докупить",   color: "#06b6d4" },
  { id: 5, ticker: "GLD",      name: "SPDR Gold Shares",          type: "ETF",   qty: 111.8784, avgPrice: 182.50, currentPrice: 318.00, previousClose: 315.80, value: 35577,  pnl: 15148, pnlPct:  74.25, share: 11.31, targetShare: 12.0, action: "Удерживать", color: "#f59e0b" },
  { id: 6, ticker: "SLV",      name: "iShares Silver Trust",      type: "ETF",   qty: 746.5671, avgPrice:  21.80, currentPrice:  39.62, previousClose:  39.06, value: 29577,  pnl: 13293, pnlPct:  81.74, share:  9.40, targetShare:  8.0, action: "Удерживать", color: "#94a3b8" },
  { id: 7, ticker: "BRK.B",   name: "Berkshire Hathaway B",      type: "Акция", qty: 52.9441,  avgPrice: 326.70, currentPrice: 490.26, previousClose: 488.40, value: 25956,  pnl:  8660, pnlPct:  50.06, share:  8.25, targetShare: 10.0, action: "Докупить",   color: "#ef4444" },
  { id: 8, ticker: "TSLA",     name: "Tesla Inc.",                type: "Акция", qty: 0.8736,   avgPrice: 285.40, currentPrice: 231.48, previousClose: 243.50, value:   202,  pnl:   -47, pnlPct: -18.89, share:  0.06, targetShare:  5.0, action: "Докупить",   color: "#ec4899" },
  { id: 9, ticker: "IBKR",     name: "Interactive Brokers",       type: "Акция", qty: 224.28,   avgPrice:  36.90, currentPrice:  54.23, previousClose:  51.65, value: 12163,  pnl:  3884, pnlPct:  46.96, share:  3.87, targetShare:  5.0, action: "Докупить",   color: "#22c55e" },
  { id: 10, ticker: "КЭШ (USD)", name: "Кэш в долларах",         type: "Кэш",   qty: 0,        avgPrice:   0,    currentPrice:   0,    previousClose:   0,    value: 30839,  pnl:    0,  pnlPct:   0.0,  share:  9.80, targetShare:  5.0, action: "Удерживать", color: "#84cc16" },
];

export const performanceMetrics = {
  day: { value: 2752, pct: 0.88 },
  week: { value: 5231, pct: 1.69 },
  month: { value: 18742, pct: 6.33 },
  year: { value: 54183, pct: 20.81 },
};

export const cashBalances = {
  usd: 30700,
  try: 26.15,
  total: 30726,
  pctOfPortfolio: 8.92,
};

// Total cost basis (sum of qty * avgPrice across all non-cash positions + cash)
export const portfolioCostBasis = 199164;

// Deterministic portfolio history with invested baseline
// invested = cumulative capital put in; value = current market value
function generatePortfolioHistory(
  days: number,
  startValue: number,
  endValue: number,
  startInvested: number,
  endInvested: number,
) {
  const data = [];
  const now = new Date();
  const amplitude = (endValue - startValue) * 0.055;
  const monthCount = days / 30;

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const progress = (days - i) / days;
    const trend = startValue + (endValue - startValue) * progress;
    // Deterministic noise — sine waves only, no Math.random
    const noise =
      Math.sin(i * 0.31) * amplitude +
      Math.sin(i * 0.73 + 1.1) * amplitude * 0.45 +
      Math.sin(i * 1.27 + 2.3) * amplitude * 0.2;
    // Invested grows in monthly steps
    const monthsPassed = Math.floor((progress * days) / 30);
    const perMonth = (endInvested - startInvested) / Math.max(monthCount, 1);
    const invested = Math.round(
      Math.min(startInvested + perMonth * monthsPassed, endInvested),
    );
    data.push({
      date: date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }),
      value: Math.round(Math.max(trend + noise, startValue * 0.82)),
      invested,
    });
  }
  return data;
}

export const portfolioHistory1D  = generatePortfolioHistory(1,   311813, 314565, 294086, 294086);
export const portfolioHistory7D  = generatePortfolioHistory(7,   307200, 314565, 291000, 294086);
export const portfolioHistory1M  = generatePortfolioHistory(30,  290000, 314565, 280000, 294086);
export const portfolioHistory3M  = generatePortfolioHistory(90,  265000, 314565, 260000, 294086);
export const portfolioHistory6M  = generatePortfolioHistory(180, 240000, 314565, 235000, 294086);
export const portfolioHistoryYTD = generatePortfolioHistory(141, 248000, 314565, 243000, 294086);
export const portfolioHistory1Y  = generatePortfolioHistory(365, 195000, 314565, 195000, 294086);
export const portfolioHistoryAll = generatePortfolioHistory(420, 175000, 314565, 175000, 294086);

export const assetDistribution = [
  { name: "Акции США", value: 67.0, color: "#7c3aed" },
  { name: "Сырьевые товары", value: 20.7, color: "#f59e0b" },
  { name: "Кэш", value: 9.8, color: "#3b82f6" },
  { name: "Прочее", value: 2.5, color: "#22c55e" },
];

export const sectorDistribution = [
  { name: "Технологии", value: 55.2, color: "#7c3aed" },
  { name: "Финансы", value: 13.4, color: "#3b82f6" },
  { name: "Драгметаллы", value: 20.7, color: "#f59e0b" },
  { name: "Промышленность", value: 5.2, color: "#22c55e" },
  { name: "Прочее", value: 5.5, color: "#94a3b8" },
];

export const currencyChanges = [
  { currency: "USD", value: 2752, pct: 0.88 },
  { currency: "EUR", value: 1102, pct: 0.56 },
  { currency: "TRY", value: 125, pct: 0.45 },
  { currency: "BTC", value: 873, pct: 1.15 },
  { currency: "ETH", value: 432, pct: 1.02 },
];

export const keyIndicators = {
  riskLevel: "Средний",
  beta: 0.92,
  maxDrawdown: -13.2,
  var95_1d: -2.18,
  var95_10d: -6.74,
  sharpe: 1.28,
  diversification: "Хорошая",
};

export const riskScore = 52;

export const growthLeaders = [
  { ticker: "IBKR", pct: 4.80, usd: 578 },
  { ticker: "SLV", pct: 1.40, usd: 408 },
  { ticker: "QQQ", pct: 0.90, usd: 654 },
  { ticker: "VOO", pct: 0.61, usd: 345 },
  { ticker: "BRK.B", pct: 0.35, usd: 182 },
];

export const declineLeaders = [
  { ticker: "SOXX", pct: -9.27, usd: -233 },
  { ticker: "TSLA", pct: -4.94, usd: -256 },
  { ticker: "SMH", pct: -2.61, usd: -384 },
  { ticker: "GLD", pct: -0.69, usd: -69 },
  { ticker: "BRK.B", pct: -0.42, usd: -32 },
];

export const targetStructure = [
  { ticker: "VOO", current: 19.39, target: 25.0, deviation: -5.61, status: "Недовес" },
  { ticker: "QQQ", current: 23.11, target: 15.0, deviation: 8.11, status: "Перевес" },
  { ticker: "SMH", current: 7.39, target: 10.0, deviation: -2.61, status: "Недовес" },
  { ticker: "SOXX", current: 0.73, target: 10.0, deviation: -9.27, status: "Недовес" },
  { ticker: "GLD", current: 11.31, target: 12.0, deviation: -0.69, status: "Недовес" },
  { ticker: "SLV", current: 9.40, target: 8.0, deviation: 1.40, status: "Норма" },
  { ticker: "BRK.B", current: 8.25, target: 10.0, deviation: -1.75, status: "Недовес" },
  { ticker: "TSLA", current: 0.06, target: 5.0, deviation: -4.94, status: "Недовес" },
  { ticker: "IBKR", current: 3.87, target: 5.0, deviation: -1.13, status: "Недовес" },
  { ticker: "КЭШ(USD)", current: 9.80, target: 5.0, deviation: 4.80, status: "Перевес" },
];

export const snapshots = [
  { date: dAgo(0),  time: "01:52", capital: 314565, profit: 31457, profit10: 14842, profitPct: "14.84%", comment: "Плановая фиксация" },
  { date: dAgo(1),  time: "10:10", capital: 311813, profit: 31181, profit10: 13999, profitPct: "14.81%", comment: "Фиксация QQQ" },
  { date: dAgo(2),  time: "10:05", capital: 308100, profit: 30910, profit10: 13752, profitPct: "14.78%", comment: "Плановая фиксация" },
  { date: dAgo(3),  time: "10:00", capital: 306789, profit: 30679, profit10: 13450, profitPct: "14.72%", comment: "Ребалансировка" },
  { date: dAgo(7),  time: "11:30", capital: 301244, profit: 29843, profit10: 12980, profitPct: "14.63%", comment: "Еженедельная сводка" },
  { date: dAgo(14), time: "09:45", capital: 296870, profit: 28012, profit10: 12100, profitPct: "14.38%", comment: "Докупка VOO" },
  { date: dAgo(30), time: "10:00", capital: 289300, profit: 25410, profit10: 10820, profitPct: "13.95%", comment: "Ежемесячная фиксация" },
  { date: dAgo(60), time: "11:15", capital: 278940, profit: 21560, profit10:  9430, profitPct: "13.22%", comment: "Докупка GLD" },
];

export const operations = [
  { date: dAgo(1),  ticker: "QQQ",   action: "Продажа", qty: 10, price: 577.03, sum: 5770 },
  { date: dAgo(4),  ticker: "GLD",   action: "Продажа", qty: 5,  price: 318.00, sum: 1590 },
  { date: dAgo(6),  ticker: "SLV",   action: "Продажа", qty: 20, price: 39.62,  sum: 792 },
  { date: dAgo(7),  ticker: "VOO",   action: "Покупка", qty: 5,  price: 606.20, sum: -3031 },
  { date: dAgo(8),  ticker: "SMH",   action: "Покупка", qty: 2,  price: 341.29, sum: -682 },
  { date: dAgo(11), ticker: "BRK.B", action: "Покупка", qty: 1,  price: 490.26, sum: -490 },
  { date: dAgo(13), ticker: "TSLA",  action: "Покупка", qty: 2,  price: 231.48, sum: -463 },
];

export const recommendedActions = [
  { action: "Докупить VOO", priority: "Высокий", reason: "Недовес к цели 5.61%, Сильная динамика" },
  { action: "Докупить SMH", priority: "Высокий", reason: "Недовес к цели 2.61%, Рост полупроводников" },
  { action: "Фиксировать прибыль QQQ", priority: "Средний", reason: "Прибыль выше цели (+8.11%)" },
  { action: "Частичная фиксация GLD", priority: "Средний", reason: "Перевес к цели (-0.69%), Снижение волатильности" },
  { action: "Ребалансировка", priority: "Средний", reason: "Отклонение портфеля от целей 14.84%" },
];

export const events = [
  { date: dFwd(1),  event: "Протокол FOMC", importance: "Высокая" },
  { date: dFwd(2),  event: "ВВП (1 кв.) США", importance: "Высокая" },
  { date: dFwd(3),  event: "Индекс PCE (г/г)", importance: "Высокая" },
  { date: dFwd(10), event: "Отчёт по инфляции (PCE)", importance: "Высокая" },
  { date: dFwd(17), event: "Отчёт по рынку труда (NFP)", importance: "Высокая" },
];

export const cashFlow = {
  deposits: 15000,
  withdrawals: -3000,
  fixedProfit: 31457,
  reinvested: -16615,
  netFlow: 26842,
};

export const goals = [
  { goal: "Капитал 400,000 USD", progress: 314565, target: 400000, pct: 78, status: "В процессе" },
  { goal: "Пассивный доход 5,000 USD/мес", progress: 3420, target: 5000, pct: 68, status: "В процессе" },
  { goal: "Фин. свобода 600,000 USD", progress: 314565, target: 600000, pct: 52, status: "В процессе" },
  { goal: "Дивидендный доход 4,000 USD/мес", progress: 2180, target: 4000, pct: 55, status: "В процессе" },
];

export const riskCategories = [
  { name: "Рыночный риск", value: 58, color: "#f59e0b" },
  { name: "Кредитный риск", value: 22, color: "#22c55e" },
  { name: "Ликвидность", value: 35, color: "#22c55e" },
  { name: "Концентрация", value: 68, color: "#ef4444" },
  { name: "Валютный риск", value: 28, color: "#22c55e" },
  { name: "Процентный риск", value: 31, color: "#22c55e" },
];

export const riskMetrics = {
  var95_1d: -2.18,
  var95_10d: -6.74,
  expectedShortfall: -3.25,
  maxDrawdown: -13.2,
  volatility30d: 12.68,
  sharpe: 1.28,
  beta: 0.92,
};

export const stressScenarios = [
  { scenario: "Финансовый кризис (2008)", description: "Падение рынка на 45%", lossUsd: -109842, lossPct: -34.9, probability: "Низкая" },
  { scenario: "Пандемия (COVID-19)", description: "Резкое падение на 30%", lossUsd: -68215, lossPct: -21.7, probability: "Низкая" },
  { scenario: "Инфляционный шок", description: "Рост инфляции до 8%", lossUsd: -35467, lossPct: -11.3, probability: "Средняя" },
  { scenario: "Рецессия (мягкая)", description: "Падение прибыли корпораций", lossUsd: -26418, lossPct: -8.4, probability: "Средняя" },
  { scenario: "Рост ставок (+2%)", description: "Ужесточение монетарной политики", lossUsd: -21307, lossPct: -6.8, probability: "Высокая" },
  { scenario: "Геополитический кризис", description: "Эскалация конфликта", lossUsd: -18963, lossPct: -6.0, probability: "Средняя" },
  { scenario: "Бычий сценарий", description: "Рост рынка на 20%", lossUsd: 62913, lossPct: 20.0, probability: "Средняя" },
];

export const correlationMatrix = {
  tickers: ["VOO", "QQQ", "SMH", "SOXX", "GLD", "SLV", "BRK.B", "TSLA"],
  data: [
    [1.00, 0.88, 0.76, 0.71, -0.25, -0.31, 0.35, 0.42],
    [0.88, 1.00, 0.81, 0.76, -0.20, -0.26, 0.32, 0.61],
    [0.76, 0.81, 1.00, 0.92, -0.15, -0.21, 0.25, 0.58],
    [0.71, 0.76, 0.92, 1.00, -0.12, -0.18, 0.22, 0.55],
    [-0.25, -0.20, -0.15, -0.12, 1.00, 0.76, -0.05, -0.10],
    [-0.31, -0.26, -0.21, -0.18, 0.76, 1.00, -0.03, -0.08],
    [0.35, 0.32, 0.25, 0.22, -0.05, -0.03, 1.00, 0.28],
    [0.42, 0.61, 0.58, 0.55, -0.10, -0.08, 0.28, 1.00],
  ],
};

function generateDrawdown(days: number) {
  const data = [];
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const t = (days - i) / days;
    let dd = 0;
    if (t < 0.3) dd = -(Math.random() * 8);
    else if (t < 0.5) dd = -(Math.random() * 13.2);
    else dd = -(Math.random() * 5);
    data.push({
      date: date.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" }),
      drawdown: Math.round(dd * 100) / 100,
    });
  }
  return data;
}

export const drawdownHistory = generateDrawdown(365);

export const varDetails = [
  { period: "1 день", level: "95%", varUsd: -6854, varPct: -2.18, es: -9842 },
  { period: "1 день", level: "99%", varUsd: -10932, varPct: -3.48, es: -15231 },
  { period: "10 дней", level: "95%", varUsd: -21182, varPct: -6.74, es: -28615 },
  { period: "10 дней", level: "99%", varUsd: -33765, varPct: -10.75, es: -45823 },
  { period: "30 дней", level: "95%", varUsd: -37942, varPct: -12.07, es: -51683 },
  { period: "30 дней", level: "99%", varUsd: -58432, varPct: -18.58, es: -79214 },
];

export const strategyRating = {
  overall: "A-",
  label: "Отлично",
  categories: [
    { name: "Доходность", rating: "A-" },
    { name: "Риск-менеджмент", rating: "B+" },
    { name: "Диверсификация", rating: "A" },
    { name: "Эффективность", rating: "A-" },
    { name: "Устойчивость", rating: "A" },
  ],
};

export const longTermGoal = {
  name: "Финансовая свобода",
  progress: 68,
  current: 314565,
  target: 400000,
  remaining: 85435,
};

export const aiForecasts = [
  { label: "Консервативный", value: 12.4 },
  { label: "Базовый", value: 18.7 },
  { label: "Агрессивный", value: 26.3 },
];

export const goalProbabilities = [
  { years: 5, probability: 68 },
  { years: 10, probability: 82 },
  { years: 15, probability: 94 },
];

export const actionPlan = [
  { action: "Докупка VOO при просадке > 5%", target: "Целевая сумма: 2,000 USD", status: "В процессе" },
  { action: "Фиксация прибыли QQQ", target: "Цель: +15% от текущей цены", status: "Запланировано" },
  { action: "Увеличить долю золота (GLD)", target: "Цель: до 10% портфеля", status: "Запланировано" },
  { action: "Снизить концентрацию в SMH", target: "Цель: до 7% портфеля", status: "Ожидание" },
  { action: "Пополнение портфеля", target: "Цель: +15,000 USD", status: "Запланировано" },
];

export const portfolioRules = [
  "Никогда не рисковать более 1-2% на одну идею",
  "Фиксируй минимум 10% прибыли при достижении цели",
  "Максимальная просадка портфеля: 20%",
  "Ребалансировка каждые 3 месяца или при отклонении > 5%",
  "Держи кэш не менее 5% для манёвра",
  "Инвестируй в растущие активы и тренды",
];

export const aiSignals = [
  { signal: "ПОКУПАТЬ", ticker: "VOO", reason: "Просадка и сильные фундаменталы", confidence: 85, color: "#22c55e" },
  { signal: "ДЕРЖАТЬ", ticker: "QQQ", reason: "Ожидание пробоя сопротивления", confidence: 60, color: "#f59e0b" },
  { signal: "ПОКУПАТЬ", ticker: "GLD", reason: "Инфляция и геополитика", confidence: 75, color: "#22c55e" },
  { signal: "СНИЗИТЬ", ticker: "SMH", reason: "Высокая оценка и риск коррекции", confidence: 40, color: "#ef4444" },
  { signal: "НАБЛЮДАТЬ", ticker: "TSLA", reason: "Высокая волатильность", confidence: 35, color: "#94a3b8" },
];

export const macroFactors = [
  { factor: "Инфляция (CPI)", current: "3.4%", forecast: "↓ 2.8%", impact: "Положительное" },
  { factor: "Ставка ФРС", current: "5.25%", forecast: "↓ 4.25%", impact: "Положительное" },
  { factor: "ВВП (США)", current: "2.1%", forecast: "↑ 2.3%", impact: "Положительное" },
  { factor: "Безработица", current: "3.9%", forecast: "↑ 4.2%", impact: "Нейтральное" },
  { factor: "Рынок акций (S&P 500)", current: "5,321", forecast: "↑ 5,800", impact: "Положительное" },
  { factor: "Цена золота", current: "2,420", forecast: "↑ 2,700", impact: "Положительное" },
];

export const aiInsights = [
  "Портфель хорошо диверсифицирован",
  "Высокая корреляция в секторе технологий",
  "Рекомендуется увеличить долю золота",
  "Возможность в энергетическом секторе",
  "Следить за инфляцией и ставками ФРС",
];

export const targetStrategicAllocation = [
  { name: "Акции США", value: 60.0, color: "#7c3aed" },
  { name: "ETF", value: 20.0, color: "#3b82f6" },
  { name: "Драг. металлы", value: 10.0, color: "#f59e0b" },
  { name: "Облигации", value: 5.0, color: "#22c55e" },
  { name: "Кэш", value: 5.0, color: "#94a3b8" },
];

// Benchmark comparison for analytics
function generateBenchmark(days: number, startPct: number, endPct: number) {
  const data = [];
  for (let i = 0; i <= days; i++) {
    const progress = i / days;
    const trend = startPct + (endPct - startPct) * progress;
    const noise = (Math.random() - 0.5) * 3;
    data.push(Math.round((trend + noise) * 100) / 100);
  }
  return data;
}

export const benchmarkDays = 141;
export const portfolioBenchmark = generateBenchmark(benchmarkDays, -5, 20.81);
export const sp500Benchmark = generateBenchmark(benchmarkDays, -3, 13.24);
export const nasdaqBenchmark = generateBenchmark(benchmarkDays, -4, 9.81);
export const goldBenchmark = generateBenchmark(benchmarkDays, -1, 3.45);

export function getBenchmarkChartData() {
  const dates = [];
  const now = new Date();
  for (let i = benchmarkDays; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    dates.push(date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }));
  }
  return dates.map((date, i) => ({
    date,
    portfolio: portfolioBenchmark[i],
    sp500: sp500Benchmark[i],
    nasdaq: nasdaqBenchmark[i],
    gold: goldBenchmark[i],
  }));
}

export const factorExposure = [
  { factor: "Market (Рынок)", value: 0.92 },
  { factor: "Size (Размер)", value: 0.15 },
  { factor: "Value (Стоимость)", value: 0.22 },
  { factor: "Growth (Рост)", value: 0.68 },
  { factor: "Quality (Качество)", value: 0.61 },
  { factor: "Momentum (Моментум)", value: 0.55 },
  { factor: "Low Volatility", value: 0.18 },
];

export const summaryStats = {
  totalProfit: 54183,
  totalProfitPct: 20.81,
  ytdReturn: 18.42,
  bestDay: 2.18,
  worstDay: -1.46,
  avgDailyReturn: 0.68,
  positiveDays: 68,
  profitRiskRatio: 1.78,
  tradingDays: 142,
};

// --- Triggers ---
export const triggers = [
  { id: 1, ticker: "VOO", name: "Vanguard S&P 500 ETF", type: "Цена ниже", condition: "Цена < 580", currentValue: "606.20", targetValue: "580.00", priority: "Высокий", status: "Активен", lastTriggered: null, color: "#7c3aed" },
  { id: 2, ticker: "QQQ", name: "Invesco QQQ Trust", type: "Цена выше", condition: "Цена > 620", currentValue: "577.03", targetValue: "620.00", priority: "Средний", status: "Активен", lastTriggered: null, color: "#9d6ef5" },
  { id: 3, ticker: "SMH", name: "VanEck Semiconductor ETF", type: "Просадка %", condition: "Просадка > 10%", currentValue: "0.00%", targetValue: "10.00%", priority: "Высокий", status: "Активен", lastTriggered: null, color: "#3b82f6" },
  { id: 4, ticker: "GLD", name: "SPDR Gold Shares", type: "Рост %", condition: "Рост > 5%", currentValue: "0.00%", targetValue: "5.00%", priority: "Средний", status: "Активен", lastTriggered: null, color: "#f59e0b" },
  { id: 5, ticker: "TSLA", name: "Tesla Inc.", type: "Объём", condition: "Объём > 200M", currentValue: "142M", targetValue: "200M", priority: "Низкий", status: "Неактивен", lastTriggered: dAgo(4), color: "#ec4899" },
  { id: 6, ticker: "BRK.B", name: "Berkshire Hathaway B", type: "Цена ниже", condition: "Цена < 460", currentValue: "490.26", targetValue: "460.00", priority: "Средний", status: "Активен", lastTriggered: null, color: "#ef4444" },
  { id: 7, ticker: "SLV", name: "iShares Silver Trust", type: "Просадка %", condition: "Просадка > 15%", currentValue: "0.00%", targetValue: "15.00%", priority: "Низкий", status: "Активен", lastTriggered: null, color: "#94a3b8" },
  { id: 8, ticker: "ПОРТФЕЛЬ", name: "Весь портфель", type: "Просадка портфеля", condition: "Просадка > 20%", currentValue: "0.00%", targetValue: "20.00%", priority: "Критический", status: "Активен", lastTriggered: null, color: "#22c55e" },
];

export const triggerAlerts = [
  { id: 1, ticker: "SOXX",     message: "Просадка SOXX превысила 9.27%",                          time: `${dAgo(0)} 01:45`,  severity: "Высокая", read: false },
  { id: 2, ticker: "TSLA",     message: "Объём торгов TSLA вырос выше 200M",                      time: `${dAgo(4)} 16:30`,  severity: "Средняя", read: true },
  { id: 3, ticker: "GLD",      message: "Золото снизилось на 0.69%",                              time: `${dAgo(6)} 14:20`,  severity: "Низкая",  read: true },
  { id: 4, ticker: "ПОРТФЕЛЬ", message: "Ребалансировка: отклонение от цели превышает 5%",        time: `${dAgo(7)} 10:00`,  severity: "Средняя", read: true },
];

// --- Actions ---
export const actionItems = [
  { id: 1, action: "Докупить VOO",            ticker: "VOO",      amount: 2000, qty: 3.30,  priority: "Высокий", reason: "Недовес к цели -5.61%. Сильная рыночная динамика. Рекомендуется при следующей просадке.", status: "Ожидание",     deadline: dFwd(10), color: "#7c3aed" },
  { id: 2, action: "Фиксировать прибыль QQQ", ticker: "QQQ",      amount: 5770, qty: 10,    priority: "Высокий", reason: "Перевес +8.11% от цели. Фиксация на текущих уровнях, цена у сопротивления.",            status: "Ожидание",     deadline: dFwd(4),  color: "#9d6ef5" },
  { id: 3, action: "Докупить SMH",            ticker: "SMH",      amount: 2700, qty: 7.91,  priority: "Средний", reason: "Недовес -2.61%. Рост сектора полупроводников в долгосрочной перспективе.",              status: "Запланировано", deadline: dFwd(25), color: "#3b82f6" },
  { id: 4, action: "Докупить SOXX",           ticker: "SOXX",     amount: 4500, qty: 15.64, priority: "Средний", reason: "Критический недовес -9.27% от цели. Сектор полупроводников на просадке.",               status: "Запланировано", deadline: dFwd(25), color: "#06b6d4" },
  { id: 5, action: "Частичная фиксация SLV",  ticker: "SLV",      amount: 1190, qty: 30,    priority: "Низкий",  reason: "Небольшой перевес +1.4%. Коррекция позиции.",                                          status: "Ожидание",     deadline: dFwd(40), color: "#94a3b8" },
  { id: 6, action: "Ребалансировка портфеля", ticker: "ПОРТФЕЛЬ", amount: 0,    qty: 0,     priority: "Средний", reason: "Суммарное отклонение от целей 14.84%. Плановая ребалансировка.",                        status: "Запланировано", deadline: dFwd(11), color: "#22c55e" },
  { id: 7, action: "Пополнение депозита", ticker: "КЭШ", amount: 15000, qty: 0, priority: "Средний", reason: "Плановое пополнение счёта для реализации инвестиционного плана.", status: "Ожидание", deadline: "31.05.2024", color: "#84cc16" },
];

export const completedActions = [
  { id:  1, date: dAgo(1),   time: "14:32", type: "Продажа",        ticker: "QQQ",      name: "Invesco QQQ Trust",        qty: 10,  price: 577.03, amount:  5770, commission: 2.89, broker: "IBKR", pnl:  2048, result: "+5,770", status: "Выполнено", color: "#9d6ef5", note: "Частичная фиксация прибыли" },
  { id:  2, date: dAgo(4),   time: "11:15", type: "Продажа",        ticker: "GLD",      name: "SPDR Gold Shares",         qty: 5,   price: 318.00, amount:  1590, commission: 0.80, broker: "IBKR", pnl:   678, result: "+1,590", status: "Выполнено", color: "#f59e0b", note: "" },
  { id:  3, date: dAgo(6),   time: "10:05", type: "Продажа",        ticker: "SLV",      name: "iShares Silver Trust",     qty: 20,  price:  39.62, amount:   792, commission: 0.40, broker: "IBKR", pnl:   356, result: "+792",   status: "Выполнено", color: "#94a3b8", note: "" },
  { id:  4, date: dAgo(7),   time: "09:45", type: "Покупка",        ticker: "VOO",      name: "Vanguard S&P 500 ETF",     qty: 5,   price: 606.20, amount:  3031, commission: 1.52, broker: "IBKR", pnl:     0, result: "-3,031", status: "Выполнено", color: "#7c3aed", note: "Докупка на просадке" },
  { id:  5, date: dAgo(8),   time: "10:20", type: "Покупка",        ticker: "SMH",      name: "VanEck Semiconductor ETF", qty: 2,   price: 341.29, amount:   683, commission: 0.34, broker: "IBKR", pnl:     0, result: "-683",   status: "Выполнено", color: "#3b82f6", note: "" },
  { id:  6, date: dAgo(20),  time: "12:00", type: "Ребалансировка", ticker: "ПОРТФЕЛЬ", name: "Весь портфель",            qty: 0,   price:   0,    amount:     0, commission: 8.40, broker: "IBKR", pnl:     0, result: "—",      status: "Выполнено", color: "#22c55e", note: "Плановая ребалансировка Q2" },
  { id:  7, date: dAgo(29),  time: "15:10", type: "Покупка",        ticker: "IBKR",     name: "Interactive Brokers",      qty: 20,  price:  51.65, amount:  1033, commission: 0.52, broker: "IBKR", pnl:     0, result: "-1,033", status: "Выполнено", color: "#22c55e", note: "" },
  { id:  8, date: dAgo(41),  time: "09:30", type: "Покупка",        ticker: "GLD",      name: "SPDR Gold Shares",         qty: 8,   price: 307.40, amount:  2459, commission: 1.23, broker: "IBKR", pnl:     0, result: "-2,459", status: "Выполнено", color: "#f59e0b", note: "Хедж от инфляции" },
  { id:  9, date: dAgo(54),  time: "11:45", type: "Продажа",        ticker: "TSLA",     name: "Tesla Inc.",               qty: 2,   price: 175.20, amount:   350, commission: 0.18, broker: "IBKR", pnl:  -220, result: "-220",   status: "Выполнено", color: "#ec4899", note: "Стоп-лосс" },
  { id: 10, date: dAgo(67),  time: "14:00", type: "Покупка",        ticker: "BRK.B",    name: "Berkshire Hathaway B",     qty: 5,   price: 410.30, amount:  2052, commission: 1.03, broker: "IBKR", pnl:     0, result: "-2,052", status: "Выполнено", color: "#ef4444", note: "" },
  { id: 11, date: dAgo(81),  time: "10:00", type: "Покупка",        ticker: "SLV",      name: "iShares Silver Trust",     qty: 100, price:  23.50, amount:  2350, commission: 1.18, broker: "IBKR", pnl:     0, result: "-2,350", status: "Выполнено", color: "#94a3b8", note: "" },
  { id: 12, date: dAgo(97),  time: "09:15", type: "Покупка",        ticker: "VOO",      name: "Vanguard S&P 500 ETF",     qty: 8,   price: 488.30, amount:  3906, commission: 1.95, broker: "IBKR", pnl:     0, result: "-3,906", status: "Выполнено", color: "#7c3aed", note: "" },
  { id: 13, date: dAgo(112), time: "13:20", type: "Дивиденды",      ticker: "VOO",      name: "Vanguard S&P 500 ETF",     qty: 0,   price:   0,    amount:   184, commission: 0,    broker: "IBKR", pnl:   184, result: "+184",   status: "Выполнено", color: "#7c3aed", note: "Квартальные дивиденды" },
  { id: 14, date: dAgo(133), time: "10:30", type: "Покупка",        ticker: "QQQ",      name: "Invesco QQQ Trust",        qty: 15,  price: 397.20, amount:  5958, commission: 2.98, broker: "IBKR", pnl:     0, result: "-5,958", status: "Выполнено", color: "#9d6ef5", note: "" },
  { id: 15, date: dAgo(158), time: "11:00", type: "Покупка",        ticker: "SOXX",     name: "iShares Semiconductor ETF",qty: 8,   price: 210.50, amount:  1684, commission: 0.84, broker: "IBKR", pnl:     0, result: "-1,684", status: "Выполнено", color: "#06b6d4", note: "" },
  { id: 16, date: dAgo(172), time: "09:45", type: "Покупка",        ticker: "IBKR",     name: "Interactive Brokers",      qty: 50,  price:  42.10, amount:  2105, commission: 1.05, broker: "IBKR", pnl:     0, result: "-2,105", status: "Выполнено", color: "#22c55e", note: "" },
  { id: 17, date: dAgo(202), time: "12:30", type: "Ребалансировка", ticker: "ПОРТФЕЛЬ", name: "Весь портфель",            qty: 0,   price:   0,    amount:     0, commission: 7.20, broker: "IBKR", pnl:     0, result: "—",      status: "Выполнено", color: "#22c55e", note: "Плановая ребалансировка Q4" },
  { id: 18, date: dAgo(314), time: "10:15", type: "Покупка",        ticker: "TSLA",     name: "Tesla Inc.",               qty: 3,   price: 277.90, amount:   834, commission: 0.42, broker: "IBKR", pnl:     0, result: "-834",   status: "Выполнено", color: "#ec4899", note: "" },
  { id: 19, date: dAgo(420), time: "14:00", type: "Покупка",        ticker: "BRK.B",    name: "Berkshire Hathaway B",     qty: 10,  price: 336.40, amount:  3364, commission: 1.68, broker: "IBKR", pnl:     0, result: "-3,364", status: "Выполнено", color: "#ef4444", note: "" },
  { id: 20, date: dAgo(462), time: "09:30", type: "Покупка",        ticker: "VOO",      name: "Vanguard S&P 500 ETF",     qty: 20,  price: 366.80, amount:  7336, commission: 3.67, broker: "IBKR", pnl:     0, result: "-7,336", status: "Выполнено", color: "#7c3aed", note: "Начало формирования позиции" },
  { id: 21, date: dAgo(497), time: "10:00", type: "Покупка",        ticker: "QQQ",      name: "Invesco QQQ Trust",        qty: 30,  price: 271.50, amount:  8145, commission: 4.07, broker: "IBKR", pnl:     0, result: "-8,145", status: "Выполнено", color: "#9d6ef5", note: "" },
  { id: 22, date: dAgo(536), time: "11:00", type: "Покупка",        ticker: "IBKR",     name: "Interactive Brokers",      qty: 100, price:  32.80, amount:  3280, commission: 1.64, broker: "IBKR", pnl:     0, result: "-3,280", status: "Выполнено", color: "#22c55e", note: "" },
  { id: 23, date: dAgo(546), time: "09:30", type: "Покупка",        ticker: "SMH",      name: "VanEck Semiconductor ETF", qty: 40,  price: 122.40, amount:  4896, commission: 2.45, broker: "IBKR", pnl:     0, result: "-4,896", status: "Выполнено", color: "#3b82f6", note: "Вход на низах рынка" },
  { id: 24, date: dAgo(581), time: "10:30", type: "Покупка",        ticker: "GLD",      name: "SPDR Gold Shares",         qty: 25,  price: 155.90, amount:  3898, commission: 1.95, broker: "IBKR", pnl:     0, result: "-3,898", status: "Выполнено", color: "#f59e0b", note: "" },
  { id: 25, date: dAgo(623), time: "09:00", type: "Покупка",        ticker: "SLV",      name: "iShares Silver Trust",     qty: 300, price:  17.20, amount:  5160, commission: 2.58, broker: "IBKR", pnl:     0, result: "-5,160", status: "Выполнено", color: "#94a3b8", note: "Первая покупка серебра" },
];

// --- Settings ---
export const connections = [
  { id: "ibkr", name: "Interactive Brokers", type: "Брокер", status: "Отключён", icon: "IB", color: "#ef4444", description: "Подключение через IBKR Web API / TWS API" },
  { id: "bybit", name: "Bybit", type: "Биржа крипто", status: "Отключён", icon: "BY", color: "#f59e0b", description: "Подключение через Bybit REST API v5" },
  { id: "yahoo", name: "Yahoo Finance", type: "Данные рынка", status: "Активен", icon: "YF", color: "#22c55e", description: "Котировки и исторические данные (бесплатно)" },
];

export const notificationSettings = [
  { id: "trigger_alerts", label: "Уведомления по триггерам", description: "Push-уведомления при срабатывании триггеров", enabled: true },
  { id: "daily_summary", label: "Ежедневный отчёт", description: "Сводка по портфелю в конце дня", enabled: true },
  { id: "rebalance", label: "Напоминания о ребалансировке", description: "Уведомление при отклонении > 5% от цели", enabled: true },
  { id: "price_alerts", label: "Ценовые алерты", description: "Уведомления при достижении целевых цен", enabled: false },
  { id: "news", label: "Новости рынка", description: "Важные новости по активам портфеля", enabled: false },
];

export const riskProfileSettings = {
  level: "Средний",
  maxDrawdown: 20,
  maxPositionSize: 25,
  minCash: 5,
  rebalancePeriod: "Квартально",
  stopLoss: 15,
};
