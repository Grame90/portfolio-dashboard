// Financial diary domain types.
//
// Brokers are dynamic (user-managed). Each broker holds money in its native
// currency (USD/TRY/RUB/EUR). Capital events shift the strategy baseline.
// All FX conversion happens through rates stored per-entry so historical
// reconstruction is exact.

export type BrokerCurrency = "USD" | "TRY" | "RUB" | "EUR";

export const CURRENCY_LABELS: Record<BrokerCurrency, string> = {
  USD: "USD ($)",
  TRY: "Лира (₺)",
  RUB: "Рубль (₽)",
  EUR: "Евро (€)",
};

// A broker (or exchange) that holds money. User can add/remove these.
export type DiaryBroker = {
  id: string; // immutable slug (e.g. "ibkr"), used as key in balances
  label: string; // display name (e.g. "IBKR")
  currency: BrokerCurrency; // native currency of this account
  isCrypto: boolean; // tag for analytics; does not affect baseline math
  // Names from /positions to roll up into this broker. Case-insensitive match.
  positionBrokers: string[];
  order: number; // sort order in the journal table
};

export function makeDefaultBrokers(): DiaryBroker[] {
  return [
    {
      id: "ibkr",
      label: "IBKR",
      currency: "USD",
      isCrypto: false,
      positionBrokers: ["IBKR", "Interactive Brokers"],
      order: 1,
    },
    {
      id: "osman",
      label: "OSMAN",
      currency: "TRY",
      isCrypto: false,
      positionBrokers: ["OSMAN"],
      order: 2,
    },
    {
      id: "midas",
      label: "Midas",
      currency: "USD",
      isCrypto: false,
      positionBrokers: ["Midas"],
      order: 3,
    },
    {
      id: "rus",
      label: "Rus",
      currency: "RUB",
      isCrypto: false,
      positionBrokers: ["BCS", "Тинькофф", "Сбер", "Rus"],
      order: 4,
    },
  ];
}

// FX rates used to convert balances into USD for Total.
// Stored per entry so historical Totals stay reproducible even if rates change.
// Each rate is "USD per 1 unit of currency". E.g. usdPerTry = 0.0234.
// Use safeRate() to invert UI-friendly "TRY per 1 USD" inputs.
export type EntryFxRates = {
  usdPerTry?: number;
  usdPerRub?: number;
  usdPerEur?: number;
  // BTC kept separately; used to display Total in BTC, not to convert balances.
  usdPerBtc?: number;
};

// Convert "TRY per 1 USD" (the UI-friendly number, e.g. 42.95) to
// usdPerTry. Returns undefined for 0 / falsy / negative inputs.
export function invertRate(perUsd: number | undefined | null): number | undefined {
  if (!perUsd || perUsd <= 0) return undefined;
  return 1 / perUsd;
}

// Diary entry — one daily snapshot.
// Balances are in each broker's NATIVE currency, keyed by broker id.
// USD totals are computed from balances + entry's rates.
export type DiaryEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  // brokerId -> amount in broker's native currency
  balances: Record<string, number>;
  // FX rates as of this date
  rates: EntryFxRates;
  // Optional cached Total in USD (recomputed on every render anyway).
  totalUsd?: number;
  // Optional cached USD-equivalents in alt currencies (for table cells).
  balanceEur?: number;
  balanceBtc?: number;
  balanceTry?: number;
  balanceRub?: number;
  // Free-text note. Separate from capital events.
  comment?: string;
  // Values copied from the source spreadsheet (when present). Preferred over
  // computed values in the UI so the diary matches the user's own numbers.
  importedInvested?: number; // "Инвестировано" column, USD
  importedPlan?: number; // "По стоку 10% прибыли (USD)" column, USD
  importedOverProfitPct?: number; // "Сверх %" column (e.g. 5.43 means +5.43%)
  // Manual overrides edited inline in the journal table.
  // Override computed positionInvested when set (number, USD).
  manualInvested?: number;
  // Free-form USD value for money transferred in/out on this date.
  // Displayed only; not factored into derived metrics.
  transfersUsd?: number;
  // Original formula text per editable field — preserved so the user sees
  // their `=1000+500` expression on next focus, not just the evaluated
  // number. Keys:
  //   "manualInvested" | "transfersUsd" | `balance:${brokerId}`
  formulas?: Record<string, string>;
};

// Capital event — money flowing into or out of the portfolio.
// + amount = deposit, − amount = withdrawal / large purchase.
// These events shift the invested baseline used by the strategy plan.
export type CapitalEventCategory =
  | "deposit"
  | "withdrawal"
  | "tesla"
  | "repair"
  | "credit_payment"
  | "other";

export const CAPITAL_EVENT_LABELS: Record<CapitalEventCategory, string> = {
  deposit: "Ввод средств",
  withdrawal: "Вывод средств",
  tesla: "Тесла",
  repair: "Ремонт",
  credit_payment: "Оплата кредита",
  other: "Прочее",
};

export type CapitalEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  amountUsd: number;
  category: CapitalEventCategory;
  // Optional broker association (for future per-broker analytics, not used in baseline).
  brokerId?: string;
  comment?: string;
};

// Strategy configuration: one record, governs the 10% annual baseline.
export type StrategyConfig = {
  startDate: string; // YYYY-MM-DD — when diary tracking begins
  initialInvested: number; // USD at startDate (the "Инвестировано" column)
  annualRate: number; // decimal, e.g. 0.10 for 10%
  calendarDaysPerYear: number; // 365 (configurable for testing)
};

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  startDate: "",
  initialInvested: 0,
  annualRate: 0.1,
  calendarDaysPerYear: 365,
};

export type Period = "day" | "week" | "month" | "year";

// UI column visibility — persisted separately, drives the journal table.
export type DiaryColumnId =
  | "date"
  | "broker:*" // wildcard; one column per broker is generated dynamically
  | "totalUsd"
  | "investedFromPositions"
  | "transfersUsd"
  | "target10Pct"
  | "earnedUsd"
  | "strategyPlan"
  | "overProfitPct"
  | "balanceEur"
  | "balanceBtc"
  | "balanceTry"
  | "balanceRub"
  | "closeLira"
  | "currentLira"
  | "comment";

export type ColumnVisibilityState = {
  // Map of column id -> visible flag. Missing keys default to true.
  // For broker columns, key is `broker:${brokerId}`.
  visible: Record<string, boolean>;
  // Ordered list of column ids (excluding "date" which is always pinned first).
  // Missing ids are appended in natural order. Drag-and-drop in the header
  // mutates this array.
  order?: string[];
};

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibilityState = {
  visible: {
    // Alt currencies hidden by default (toggle them on as needed)
    balanceEur: false,
    balanceBtc: false,
    balanceTry: false,
    balanceRub: false,
    closeLira: false,
    currentLira: false,
  },
};
