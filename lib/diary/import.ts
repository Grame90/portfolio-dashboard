// CSV / TSV importer for the user's daily diary spreadsheet.
//
// Maps Excel columns to dynamic brokers and stores balances in NATIVE currency.
// FX rates are derived from the spreadsheet itself:
//   - usdPerTry  ← 1 / "курс лиры"
//   - usdPerEur  ← Total USD / Баланс (EUR)
//   - usdPerBtc  ← Total USD / Баланс (BTC)
//   - usdPerRub  ← Total USD / Баланс (RUB)
//
// If the spreadsheet has a "Крипта" column and no crypto broker exists in
// the user's broker list, a default one is appended.

import type {
  CapitalEvent,
  CapitalEventCategory,
  DiaryBroker,
  DiaryEntry,
  EntryFxRates,
  StrategyConfig,
} from "./types";
import { DEFAULT_STRATEGY_CONFIG, makeDefaultBrokers } from "./types";

// ── Parsing primitives ──────────────────────────────────────────────────

export function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
  const variants = [",", ";", "\t", "|"];
  let best = ",";
  let count = -1;
  for (const d of variants) {
    const c = line.split(d).length;
    if (c > count) {
      count = c;
      best = d;
    }
  }
  return best;
}

export function parseDelimited(
  text: string,
): { headers: string[]; rows: string[][] } {
  const delimiter = detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === "\"") {
        if (inQuotes && line[i + 1] === "\"") {
          cur += "\"";
          i++;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === delimiter && !inQuotes) {
        out.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function normalizeHeader(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/ /g, " ")
    .replace(/[^\p{L}\p{N}%()+./\s-]/gu, "")
    .replace(/\s+/g, " ");
}

function toNum(v: unknown): number {
  if (v == null || v === "") return 0;
  const s = String(v)
    .replace(/\s+/g, "")
    .replace(/[₺$€₽]/g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.+-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function toIsoDate(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[.](\d{1,2})[.](\d{2,4})/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yy}-${mm}-${dd}`;
  }
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m2) {
    const dd = m2[1].padStart(2, "0");
    const mm = m2[2].padStart(2, "0");
    const yy = m2[3].length === 2 ? `20${m2[3]}` : m2[3];
    return `${yy}-${mm}-${dd}`;
  }
  return null;
}

// ── Column detection ────────────────────────────────────────────────────

type ColumnIndex = {
  date?: number;
  closeLira?: number;
  currentLira?: number;
  brokers: Record<string, number>; // brokerLabel (lowercase) -> col idx
  total?: number;
  eur?: number;
  btc?: number;
  try_?: number;
  rub?: number;
  invested?: number;
  plan10pct?: number; // "По стоку 10% прибыли (USD)"
  overProfitPct?: number; // "Сверх %" (green column)
  eventAmount?: number;
  comment?: number;
};

// Detect columns by matching against broker labels (case-insensitive)
// plus the well-known metadata columns.
function detectColumns(
  headers: string[],
  brokerLabels: string[],
): ColumnIndex {
  const idx: ColumnIndex = { brokers: {} };
  const labelsLc = brokerLabels.map((l) => l.toLowerCase());

  headers.forEach((raw, i) => {
    const h = normalizeHeader(raw);

    // Direct match on broker label
    const labelIdx = labelsLc.findIndex((l) => h === l);
    if (labelIdx >= 0 && idx.brokers[labelsLc[labelIdx]] === undefined) {
      idx.brokers[labelsLc[labelIdx]] = i;
      return;
    }

    if (idx.date === undefined && /^(date|дата)\b/.test(h)) idx.date = i;
    else if (idx.closeLira === undefined && /^close\b/.test(h)) {
      idx.closeLira = i;
    } else if (
      idx.currentLira === undefined &&
      /(курс лиры|kurs liry|kuрс лиры|try\/usd|usd\/try)/.test(h)
    ) {
      idx.currentLira = i;
    } else if (idx.total === undefined && /^(total|итого|сумма)$/.test(h)) {
      idx.total = i;
    } else if (
      idx.eur === undefined && /eur|евро/.test(h) && /баланс/.test(h)
    ) {
      idx.eur = i;
    } else if (idx.btc === undefined && /btc/.test(h)) idx.btc = i;
    else if (
      idx.try_ === undefined && /(ytl|try|лир)/.test(h) && /баланс/.test(h)
    ) {
      idx.try_ = i;
    } else if (
      idx.rub === undefined && /(rub|руб)/.test(h) && /баланс/.test(h)
    ) {
      idx.rub = i;
    } else if (
      idx.invested === undefined && /^(инвест|invest)/.test(h)
    ) {
      // Matches "Инвест", "Инвестировано", "Invested", but NOT "T-Invest" (broker).
      idx.invested = i;
    } else if (
      idx.plan10pct === undefined &&
      /(по стоку|стоку 10|10\s*прибыли|10%\s*прибыли)/.test(h)
    ) {
      idx.plan10pct = i;
    } else if (
      idx.overProfitPct === undefined &&
      // Matches "Сверх %", "Сверх прибыли %", and plain "Сверх прибыли"
      // (no %). Excludes "Сверх прибыли Разница (USD)" via the (usd|разн) guard.
      /сверх\s*прибыл/.test(h) && !/(usd|разниц|\$)/.test(h)
    ) {
      idx.overProfitPct = i;
    } else if (
      idx.eventAmount === undefined &&
      // Matches plain "USD" header and the "переводы на счет" capital-event column.
      (/^usd$/.test(h) || /перевод.*(счет|капит)|capital\s*flow|пополн.*вывод/.test(h))
    ) {
      idx.eventAmount = i;
    } else if (idx.comment === undefined && /(коммент|комент|comment|примеч)/.test(h)) {
      idx.comment = i;
    }
  });
  return idx;
}

// ── Comment heuristics ──────────────────────────────────────────────────

function categorizeComment(comment: string): CapitalEventCategory {
  const c = comment.toLowerCase();
  if (/тесл/.test(c)) return "tesla";
  if (/ремонт/.test(c)) return "repair";
  if (/кредит|олата|оплат/.test(c)) return "credit_payment";
  if (/ввод|депоз|deposit|пополн/.test(c)) return "deposit";
  if (/вывод|withdraw/.test(c)) return "withdrawal";
  return "other";
}

// ── Public API ──────────────────────────────────────────────────────────

export type ImportDiagnostics = {
  headers: string[];
  detected: {
    date: string | null;
    invested: string | null;
    plan10pct: string | null;
    overProfitPct: string | null;
    total: string | null;
    eventAmount: string | null;
    comment: string | null;
    currentLira: string | null;
    eur: string | null;
    btc: string | null;
    try_: string | null;
    rub: string | null;
    brokers: Record<string, string>; // broker label -> matched header
  };
  // Per-field count of how many rows received a non-empty value
  counts: {
    importedInvested: number;
    importedPlan: number;
    importedOverProfitPct: number;
    capitalEvents: number;
  };
};

export type ImportResult = {
  entries: DiaryEntry[];
  events: CapitalEvent[];
  brokers: DiaryBroker[];
  suggestedConfig: StrategyConfig;
  warnings: string[];
  errors: string[];
  diagnostics: ImportDiagnostics;
};

export function importDiaryCsv(
  text: string,
  existingBrokers?: DiaryBroker[],
): ImportResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const { headers, rows } = parseDelimited(text);

  if (headers.length === 0) {
    errors.push("Не удалось разобрать CSV: пустой файл или нет заголовка");
    return {
      entries: [],
      events: [],
      brokers: existingBrokers ?? makeDefaultBrokers(),
      suggestedConfig: DEFAULT_STRATEGY_CONFIG,
      warnings,
      errors,
      diagnostics: emptyDiagnostics(headers),
    };
  }

  // Start with the user's current brokers (or defaults if first import).
  const brokers: DiaryBroker[] = (existingBrokers ?? makeDefaultBrokers()).map(
    (b) => ({ ...b }),
  );

  // Add a "Крипта" broker if header has it and none exists.
  const hasCryptoColumn = headers.some((h) => /крипт|crypto/i.test(h));
  const hasCryptoBroker = brokers.some(
    (b) => b.isCrypto || /крипт|crypto/i.test(b.label),
  );
  if (hasCryptoColumn && !hasCryptoBroker) {
    brokers.push({
      id: "crypto",
      label: "Крипта",
      currency: "USD",
      isCrypto: true,
      positionBrokers: ["Bybit", "Binance", "KuCoin", "Крипта"],
      order: (brokers[brokers.length - 1]?.order ?? 0) + 1,
    });
    warnings.push(
      "Найдена колонка \"Крипта\" — автоматически добавлен брокер с тем же названием",
    );
  }

  const cols = detectColumns(headers, brokers.map((b) => b.label));
  // Diagnostic log: which columns matched which header index.
  if (typeof window !== "undefined") {
    const colMap = {
      headers,
      detected: {
        date: cols.date !== undefined ? headers[cols.date] : null,
        invested: cols.invested !== undefined ? headers[cols.invested] : null,
        plan10pct: cols.plan10pct !== undefined ? headers[cols.plan10pct] : null,
        overProfitPct: cols.overProfitPct !== undefined ? headers[cols.overProfitPct] : null,
        total: cols.total !== undefined ? headers[cols.total] : null,
        comment: cols.comment !== undefined ? headers[cols.comment] : null,
        brokers: cols.brokers,
      },
    };
    console.log("[Diary import] detected columns:", colMap);
  }
  if (cols.date === undefined) {
    errors.push("Не найдена колонка Date / Дата");
  }
  if (cols.invested === undefined) {
    warnings.push(
      "Не найдена колонка \"Инвестировано\" — колонка в журнале останется пустой/нулевой. Заголовки в файле: " +
        headers.slice(0, 30).join(" | "),
    );
  }
  if (Object.keys(cols.brokers).length === 0) {
    errors.push(
      "Не найдено ни одной колонки брокеров. Ожидаются: " +
        brokers.map((b) => b.label).join(", "),
    );
  }
  if (errors.length > 0) {
    return {
      entries: [],
      events: [],
      brokers,
      suggestedConfig: DEFAULT_STRATEGY_CONFIG,
      warnings,
      errors,
      diagnostics: buildDiagnostics(headers, cols, [], []),
    };
  }

  const entries: DiaryEntry[] = [];
  const events: CapitalEvent[] = [];
  let prevInvested: number | null = null;

  rows.forEach((row, rowIdx) => {
    const dateRaw = cols.date !== undefined ? row[cols.date] : "";
    const iso = dateRaw ? toIsoDate(dateRaw) : null;
    if (!iso) {
      warnings.push(
        `Строка ${rowIdx + 2}: не удалось разобрать дату "${dateRaw}"`,
      );
      return;
    }

    // Build balances Record<brokerId, native_amount>
    const balances: Record<string, number> = {};
    for (const b of brokers) {
      const ci = cols.brokers[b.label.toLowerCase()];
      if (ci === undefined) continue;
      balances[b.id] = toNum(row[ci]);
    }

    // Derive FX rates for this entry.
    const currentLira = cols.currentLira !== undefined
      ? toNum(row[cols.currentLira])
      : 0;
    const closeLira = cols.closeLira !== undefined
      ? toNum(row[cols.closeLira])
      : 0;
    const totalCol = cols.total !== undefined ? toNum(row[cols.total]) : 0;
    const balEur = cols.eur !== undefined ? toNum(row[cols.eur]) : 0;
    const balBtc = cols.btc !== undefined ? toNum(row[cols.btc]) : 0;
    const balRub = cols.rub !== undefined ? toNum(row[cols.rub]) : 0;
    const balTry = cols.try_ !== undefined ? toNum(row[cols.try_]) : 0;

    const rates: EntryFxRates = {};
    if (currentLira > 0) rates.usdPerTry = 1 / currentLira;
    else if (balTry > 0 && totalCol > 0) rates.usdPerTry = totalCol / balTry;
    if (balEur > 0 && totalCol > 0) rates.usdPerEur = totalCol / balEur;
    if (balBtc > 0 && totalCol > 0) rates.usdPerBtc = totalCol / balBtc;
    if (balRub > 0 && totalCol > 0) rates.usdPerRub = totalCol / balRub;

    const comment = cols.comment !== undefined
      ? String(row[cols.comment] ?? "").trim()
      : "";

    // Imported values from the user's spreadsheet — preferred over computed.
    const importedInvested = cols.invested !== undefined
      ? toNum(row[cols.invested])
      : 0;
    const importedPlan = cols.plan10pct !== undefined
      ? toNum(row[cols.plan10pct])
      : 0;
    const importedOverProfitPct = cols.overProfitPct !== undefined
      ? toNum(row[cols.overProfitPct])
      : 0;

    const entry: DiaryEntry = {
      id: `diary-${iso}-${rowIdx}`,
      date: iso,
      balances,
      rates,
      totalUsd: totalCol || undefined,
      balanceEur: balEur || undefined,
      balanceBtc: balBtc || undefined,
      balanceTry: balTry || undefined,
      balanceRub: balRub || undefined,
      comment: comment || undefined,
      importedInvested: importedInvested > 0 ? importedInvested : undefined,
      importedPlan: importedPlan > 0 ? importedPlan : undefined,
      importedOverProfitPct: cols.overProfitPct !== undefined
        ? importedOverProfitPct
        : undefined,
    };
    if (closeLira > 0) {
      // Stash close-lira in rates via a synthetic field? Keep simple: drop it.
      // (We don't have a dedicated field; user mostly uses current rate.)
    }
    entries.push(entry);

    // Capital event extraction.
    const eventAmount = cols.eventAmount !== undefined
      ? toNum(row[cols.eventAmount])
      : 0;
    if (Math.abs(eventAmount) > 1) {
      events.push({
        id: `evt-${iso}-${rowIdx}`,
        date: iso,
        amountUsd: eventAmount,
        category: categorizeComment(comment),
        comment: comment || undefined,
      });
    } else if (cols.invested !== undefined) {
      const invested = toNum(row[cols.invested]);
      if (prevInvested !== null && Math.abs(invested - prevInvested) > 1) {
        const diff = invested - prevInvested;
        events.push({
          id: `evt-${iso}-${rowIdx}`,
          date: iso,
          amountUsd: diff,
          category: categorizeComment(comment),
          comment: comment || undefined,
        });
      }
      prevInvested = invested;
    } else if (prevInvested === null && cols.invested !== undefined) {
      prevInvested = toNum(row[cols.invested]);
    }
  });

  entries.sort((a, b) => a.date.localeCompare(b.date));
  events.sort((a, b) => a.date.localeCompare(b.date));

  // Strategy config from first row.
  const suggestedConfig: StrategyConfig = { ...DEFAULT_STRATEGY_CONFIG };
  if (entries.length > 0) {
    const first = entries[0];
    suggestedConfig.startDate = first.date;
    // Use the explicit "Инвестировано" column on the first row if present,
    // otherwise fall back to the computed total.
    const firstRow = rows.find((r) => {
      const d = cols.date !== undefined ? toIsoDate(r[cols.date]) : null;
      return d === first.date;
    });
    if (firstRow && cols.invested !== undefined) {
      const v = toNum(firstRow[cols.invested]);
      suggestedConfig.initialInvested = Math.round(v);
    } else {
      suggestedConfig.initialInvested = Math.round(first.totalUsd ?? 0);
    }
  }

  return {
    entries,
    events,
    brokers,
    suggestedConfig,
    warnings,
    errors,
    diagnostics: buildDiagnostics(headers, cols, entries, events),
  };
}

// ── Diagnostics builders ────────────────────────────────────────────────

function emptyDiagnostics(headers: string[]): ImportDiagnostics {
  return {
    headers,
    detected: {
      date: null,
      invested: null,
      plan10pct: null,
      overProfitPct: null,
      total: null,
      eventAmount: null,
      comment: null,
      currentLira: null,
      eur: null,
      btc: null,
      try_: null,
      rub: null,
      brokers: {},
    },
    counts: {
      importedInvested: 0,
      importedPlan: 0,
      importedOverProfitPct: 0,
      capitalEvents: 0,
    },
  };
}

function buildDiagnostics(
  headers: string[],
  cols: ColumnIndex,
  entries: DiaryEntry[],
  events: CapitalEvent[],
): ImportDiagnostics {
  // Map broker col indices → "label → header" for display
  const brokerHeaderMap: Record<string, string> = {};
  for (const [labelLc, idx] of Object.entries(cols.brokers)) {
    brokerHeaderMap[labelLc] = headers[idx] ?? "";
  }
  return {
    headers,
    detected: {
      date: cols.date !== undefined ? headers[cols.date] : null,
      invested: cols.invested !== undefined ? headers[cols.invested] : null,
      plan10pct: cols.plan10pct !== undefined ? headers[cols.plan10pct] : null,
      overProfitPct: cols.overProfitPct !== undefined ? headers[cols.overProfitPct] : null,
      total: cols.total !== undefined ? headers[cols.total] : null,
      eventAmount: cols.eventAmount !== undefined ? headers[cols.eventAmount] : null,
      comment: cols.comment !== undefined ? headers[cols.comment] : null,
      currentLira: cols.currentLira !== undefined ? headers[cols.currentLira] : null,
      eur: cols.eur !== undefined ? headers[cols.eur] : null,
      btc: cols.btc !== undefined ? headers[cols.btc] : null,
      try_: cols.try_ !== undefined ? headers[cols.try_] : null,
      rub: cols.rub !== undefined ? headers[cols.rub] : null,
      brokers: brokerHeaderMap,
    },
    counts: {
      importedInvested: entries.filter((e) => e.importedInvested !== undefined).length,
      importedPlan: entries.filter((e) => e.importedPlan !== undefined).length,
      importedOverProfitPct: entries.filter((e) => e.importedOverProfitPct !== undefined).length,
      capitalEvents: events.length,
    },
  };
}
