import { NextResponse } from "next/server";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY!;
const FMP_KEY     = process.env.FMP_API_KEY!;

// ── Event name translation ───────────────────────────────────────────────────

// Ordered by specificity: longer/more-specific patterns first
const EVENT_TRANSLATIONS: [RegExp, string][] = [
  // FOMC / Fed
  [/fomc.*(minute|protocol|протокол)/i,          "Протокол заседания FOMC"],
  [/fed.*(rate|ставк|interest)/i,                "Решение ФРС по ставке"],
  [/federal.*(rate|ставк|interest)/i,            "Решение ФРС по ставке"],
  [/fomc/i,                                      "Заседание FOMC"],

  // CPI
  [/core\s+cpi.*(y\/y|год)/i,                    "Базовая инфляция CPI (г/г)"],
  [/core\s+cpi.*(m\/m|мес)/i,                    "Базовая инфляция CPI (м/м)"],
  [/cpi.*(y\/y|год)/i,                           "Инфляция CPI (г/г)"],
  [/cpi.*(m\/m|мес)/i,                           "Инфляция CPI (м/м)"],
  [/consumer price/i,                            "Индекс потребительских цен"],

  // PCE
  [/core\s+pce.*(y\/y|год)/i,                    "Базовый PCE (г/г)"],
  [/core\s+pce.*(m\/m|мес)/i,                    "Базовый PCE (м/м)"],
  [/pce.*(y\/y|год)/i,                           "Индекс PCE (г/г)"],
  [/pce.*(m\/m|мес)/i,                           "Индекс PCE (м/м)"],
  [/personal consumption/i,                      "Личные расходы (PCE)"],

  // PPI
  [/core\s+ppi.*(m\/m|мес)/i,                    "Базовый PPI (м/м)"],
  [/ppi.*(m\/m|мес)/i,                           "Производственные цены PPI (м/м)"],
  [/producer price/i,                            "Индекс цен производителей"],

  // GDP
  [/gdp.*(q\/q|qoq|кварт)/i,                    "ВВП (кв/кв)"],
  [/gdp.*(y\/y|г\/г)/i,                          "ВВП (г/г)"],
  [/gross domestic/i,                            "Валовой внутренний продукт"],

  // Jobs
  [/nonfarm payroll/i,                           "Занятость вне с/х (NFP)"],
  [/adp.*employ/i,                               "Занятость ADP"],
  [/initial jobless/i,                           "Первичные заявки по безработице"],
  [/continuing jobless/i,                        "Повторные заявки по безработице"],
  [/unemployment rate/i,                         "Уровень безработицы"],
  [/average hourly earn/i,                       "Средняя почасовая зарплата"],
  [/job openings|jolts/i,                        "Вакансии (JOLTS)"],

  // PMI / ISM
  [/ism.*manufactur/i,                           "PMI производство (ISM)"],
  [/ism.*service/i,                              "PMI услуги (ISM)"],
  [/manufactur.*pmi/i,                           "PMI производство"],
  [/service.*pmi/i,                              "PMI услуги"],
  [/composite.*pmi/i,                            "PMI сводный"],
  [/flash.*pmi/i,                                "PMI предварительный"],

  // Retail / Consumer
  [/retail sales.*(m\/m|мес)/i,                  "Розничные продажи (м/м)"],
  [/retail sales/i,                              "Розничные продажи"],
  [/consumer confidence/i,                       "Потребительское доверие"],
  [/michigan.*sentiment/i,                       "Настроения потребителей (Мичиган)"],
  [/consumer sentiment/i,                        "Потребительские настроения"],

  // Housing
  [/existing home sales/i,                       "Продажи существующего жилья"],
  [/new home sales/i,                            "Продажи нового жилья"],
  [/housing starts/i,                            "Начало строительства"],
  [/building permits/i,                          "Разрешения на строительство"],
  [/pending home/i,                              "Незакрытые сделки с жильём"],

  // Trade / Balance
  [/trade balance/i,                             "Торговый баланс"],
  [/current account/i,                           "Счёт текущих операций"],

  // Other macro
  [/durable goods/i,                             "Заказы на товары длит. пользования"],
  [/industrial production/i,                     "Промышленное производство"],
  [/capacity utilization/i,                      "Загрузка производственных мощностей"],
  [/treasury.*auction/i,                         "Аукцион гособлигаций США"],
  [/budget.*balance/i,                           "Бюджетный баланс"],
  [/import.*price/i,                             "Цены на импорт"],
  [/export.*price/i,                             "Цены на экспорт"],
];

function translateEvent(name: string): string {
  for (const [pattern, ru] of EVENT_TRANSLATIONS) {
    if (pattern.test(name)) return ru;
  }
  return name; // keep original if no match
}

// ── Finnhub: macro events ────────────────────────────────────────────────────

const MACRO_KEYWORDS = [
  "cpi", "pce", "ppi", "fomc", "fed", "nonfarm", "gdp", "unemployment",
  "interest rate", "inflation", "payroll", "retail sales", "ism",
];

function isMacroRelevant(event: string) {
  const lower = event.toLowerCase();
  return MACRO_KEYWORDS.some(k => lower.includes(k));
}

const IMPORTANCE_MAP: Record<string, string> = {
  high:   "Высокая",
  medium: "Средняя",
  low:    "Низкая",
};

function toRuDate(isoStr: string) {
  const d = new Date(isoStr);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

async function fetchMacroEvents(from: string, to: string) {
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${FINNHUB_KEY}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.economicCalendar ?? [])
      .filter((e: any) => e.country === "US" && isMacroRelevant(e.event) && e.impact?.toLowerCase() === "high")
      .sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime())
      .map((e: any) => ({
        kind:       "macro",
        date:       toRuDate(e.time),
        isoDate:    e.time,
        event:      translateEvent(e.event),
        importance: IMPORTANCE_MAP[e.impact?.toLowerCase()] ?? "Средняя",
        estimate:   e.estimate != null ? `${e.estimate}${e.unit ?? ""}` : null,
        actual:     e.actual   != null ? `${e.actual}${e.unit ?? ""}`   : null,
        ticker:     null,
      }));
  } catch { return []; }
}

// ── FMP: earnings for portfolio tickers ─────────────────────────────────────

async function fetchEarnings(tickers: string[], from: string, to: string) {
  if (!tickers.length) return [];
  try {
    const res = await fetch(
      `https://financialmodelingprep.com/api/v3/earning_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data: any[] = await res.json();
    const tickerSet = new Set(tickers.map(t => t.toUpperCase()));
    return data
      .filter(e => tickerSet.has(e.symbol?.toUpperCase()))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(e => ({
        kind:       "earnings",
        date:       toRuDate(e.date),
        isoDate:    e.date,
        event:      `Отчёт ${e.symbol}`,
        importance: "Высокая",
        estimate:   e.epsEstimated != null ? `EPS ${e.epsEstimated}` : null,
        actual:     e.eps          != null ? `EPS ${e.eps}`          : null,
        ticker:     e.symbol,
      }));
  } catch { return []; }
}

// ── FMP: dividends for portfolio tickers ─────────────────────────────────────

async function fetchDividends(tickers: string[], from: string, to: string) {
  if (!tickers.length) return [];
  try {
    const res = await fetch(
      `https://financialmodelingprep.com/api/v3/stock_dividend_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data: any[] = await res.json();
    const tickerSet = new Set(tickers.map(t => t.toUpperCase()));
    return data
      .filter(e => tickerSet.has(e.symbol?.toUpperCase()))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(e => ({
        kind:       "dividend",
        date:       toRuDate(e.date),
        isoDate:    e.date,
        event:      `Дивиденд ${e.symbol}`,
        importance: "Высокая",
        estimate:   e.dividend != null ? `$${e.dividend}` : null,
        actual:     e.adjDividend != null ? `$${e.adjDividend}` : null,
        ticker:     e.symbol,
      }));
  } catch { return []; }
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers") ?? "";
  const tickers = tickersParam ? tickersParam.split(",").filter(Boolean) : [];

  // 3 days back → 45 days forward
  const from = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
  const to   = new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10);

  const [macro, earnings, dividends] = await Promise.all([
    fetchMacroEvents(from, to),
    fetchEarnings(tickers, from, to),
    fetchDividends(tickers, from, to),
  ]);

  const all = [...macro, ...earnings, ...dividends].sort(
    (a, b) => new Date(a.isoDate).getTime() - new Date(b.isoDate).getTime()
  );

  return NextResponse.json({ events: all });
}
