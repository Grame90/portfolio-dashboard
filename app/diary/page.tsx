"use client";

// Financial Diary — clean rebuild.
//
// Three tabs: Журнал · Аналитика · Настройки.
//
// Behaviour:
//   • Daily entries auto-populate from /positions. The latest row is "live"
//     (refreshes every render + every minute via interval) — its balances
//     mirror current positions and cannot be edited.
//   • At midnight Istanbul, today rolls over: a new live row is created and
//     yesterday becomes frozen. Frozen rows are editable (balances, transfers,
//     comment, manual invested).
//   • Storage schema v2: old data is wiped on first mount of this code via
//     `migrateDiaryStorage()`.

import { useEffect, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import BrokerManagerModal from "@/components/diary/BrokerManagerModal";
import JournalView from "@/components/diary/JournalView";
import AnalyticsView from "@/components/diary/AnalyticsView";
import SettingsView from "@/components/diary/SettingsView";
import ExcelView from "@/components/diary/ExcelView";
import {
  ensureTodayEntry,
  isEntryLive,
} from "@/lib/diary/auto-snapshot";
import {
  fetchHistoricalFxMap,
  pickRatesForDate,
  runBackfill,
} from "@/lib/diary/backfill";
import { fetchCurrentRates } from "@/lib/diary/fx";
import { importDiaryCsv } from "@/lib/diary/import";
import type { ImportDiagnostics } from "@/lib/diary/import";
import {
  isExcelFile,
  isNumbersFile,
  NUMBERS_EXPORT_INSTRUCTIONS,
  xlsxFileToCsv,
} from "@/lib/diary/excel";
import {
  clearDiaryStorage,
  loadBrokers,
  loadCapitalEvents,
  loadColumnVisibility,
  loadDiaryEntries,
  loadImportDiagnostics,
  loadStrategyConfig,
  migrateDiaryStorage,
  saveBrokers,
  saveCapitalEvents,
  saveColumnVisibility,
  saveDiaryEntries,
  saveStrategyConfig,
} from "@/lib/diary/storage";
import {
  CAPITAL_EVENT_LABELS,
  DEFAULT_COLUMN_VISIBILITY,
  DEFAULT_STRATEGY_CONFIG,
  makeDefaultBrokers,
} from "@/lib/diary/types";
import type {
  CapitalEvent,
  ColumnVisibilityState,
  DiaryBroker,
  DiaryEntry,
  StrategyConfig,
} from "@/lib/diary/types";
import { usePortfolioStore } from "@/lib/store/usePortfolioStore";
import { useQuotesStore } from "@/lib/store/useQuotesStore";

type Tab = "journal" | "analytics" | "excel" | "settings";

// Re-check daily snapshot every minute. Cheap; keeps the live row fresh.
const REFRESH_INTERVAL_MS = 60_000;

// Shallow-compare two entry arrays for "material" changes that warrant a
// localStorage write + re-render. We only check fields that the auto-snapshot
// loop is allowed to mutate (date, balances, rates, isLive flag). Manual
// edit fields (transfers/comment/manualInvested) are managed by separate
// handlers so they never appear as "changed" here.
function hasMaterialChange(prev: DiaryEntry[], next: DiaryEntry[]): boolean {
  if (prev === next) return false;
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (a === b) continue;
    if (a.date !== b.date) return true;
    if ((a as { isLive?: boolean }).isLive !== (b as { isLive?: boolean }).isLive) return true;
    if (!shallowRecordEqual(a.balances, b.balances)) return true;
    if (!shallowRecordEqual(a.rates as Record<string, number | undefined>, b.rates as Record<string, number | undefined>)) return true;
  }
  return false;
}
function shallowRecordEqual(
  a: Record<string, number | undefined>,
  b: Record<string, number | undefined>,
): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a[k] !== b[k]) return false;
  return true;
}

export default function DiaryPage() {
  const [tab, setTab] = useState<Tab>("journal");
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [events, setEvents] = useState<CapitalEvent[]>([]);
  const [brokers, setBrokers] = useState<DiaryBroker[]>([]);
  const [cfg, setCfg] = useState<StrategyConfig>(DEFAULT_STRATEGY_CONFIG);
  const [visibility, setVisibility] = useState<ColumnVisibilityState>(DEFAULT_COLUMN_VISIBILITY);
  const [diag, setDiag] = useState<ImportDiagnostics | null>(null);
  const [brokerModalOpen, setBrokerModalOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [refreshingFx, setRefreshingFx] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const positions = usePortfolioStore((s) => s.positions);
  const liveQuotes = useQuotesStore((s) => s.liveQuotes);
  // Refs so the interval reads latest positions/quotes without re-arming
  // on every quote tick (quotes update sub-second; without refs we'd refresh
  // snapshot on every tick → hammering /api/rates + localStorage).
  const positionsRef = useRef(positions);
  const quotesRef = useRef(liveQuotes);
  useEffect(() => {
    positionsRef.current = positions;
    quotesRef.current = liveQuotes;
  }, [positions, liveQuotes]);

  // First-mount: migrate schema (wipe v1 keys), then load v2 state.
  useEffect(() => {
    migrateDiaryStorage();
    setEntries(loadDiaryEntries());
    setEvents(loadCapitalEvents());
    setBrokers(loadBrokers());
    setCfg(loadStrategyConfig());
    setVisibility(loadColumnVisibility());
    setDiag(loadImportDiagnostics());
  }, []);

  // Auto-fill missing historical FX once per session: if any entry has a
  // non-USD broker balance but lacks the corresponding rate, fetch the
  // historical rate from Yahoo so totals add up correctly when user edits
  // cash amounts on frozen rows.
  const fxAutofillDone = useRef(false);
  useEffect(() => {
    if (fxAutofillDone.current) return;
    if (entries.length === 0 || brokers.length === 0) return;
    fxAutofillDone.current = true;
    const usedCcy = new Set(brokers.map((b) => b.currency));
    const needs = (e: DiaryEntry) => {
      const r = e.rates ?? {};
      if (usedCcy.has("TRY") && !r.usdPerTry) return true;
      if (usedCcy.has("RUB") && !r.usdPerRub) return true;
      if (usedCcy.has("EUR") && !r.usdPerEur) return true;
      return false;
    };
    if (!entries.some(needs)) return;
    (async () => {
      try {
        const dates = entries.map((e) => e.date).sort();
        const { ratesByDate } = await fetchHistoricalFxMap(
          dates[0],
          dates[dates.length - 1],
          {
            TRY: usedCcy.has("TRY"),
            RUB: usedCcy.has("RUB"),
            EUR: usedCcy.has("EUR"),
            BTC: brokers.some((b) => b.isCrypto),
          },
        );
        setEntries((prev) => {
          const next = prev.map((e) => {
            const r = pickRatesForDate(e.date, ratesByDate);
            const merged = { ...(e.rates ?? {}), ...r };
            if (JSON.stringify(merged) === JSON.stringify(e.rates ?? {})) return e;
            return { ...e, rates: merged };
          });
          if (next === prev) return prev;
          saveDiaryEntries(next);
          return next;
        });
      } catch (err) {
        console.warn("Auto FX fill failed:", err);
        fxAutofillDone.current = false; // allow retry on next render cycle
      }
    })();
  }, [entries, brokers]);

  // Auto-snapshot: runs once on mount (and when brokers change) + every 60s.
  // Uses refs so live quote ticks don't re-arm the interval.
  // Skips localStorage writes when the next snapshot is value-equivalent.
  useEffect(() => {
    if (brokers.length === 0) return;
    let cancelled = false;
    const refresh = async () => {
      let rates;
      try {
        rates = await fetchCurrentRates();
      } catch {
        rates = {};
      }
      if (cancelled) return;
      setEntries((prev) => {
        const next = ensureTodayEntry(
          prev,
          positionsRef.current,
          quotesRef.current,
          brokers,
          rates,
        );
        if (!hasMaterialChange(prev, next)) return prev;
        saveDiaryEntries(next);
        return next;
      });
    };
    refresh();
    const id = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [brokers]);

  // ── Helpers ────────────────────────────────────────────────────────────
  function showToast(msg: string, color = "#22c55e") {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3500);
  }

  function updateBrokers(next: DiaryBroker[]) {
    saveBrokers(next);
    setBrokers(next);
  }
  function updateVisibility(next: ColumnVisibilityState) {
    saveColumnVisibility(next);
    setVisibility(next);
  }
  function updateConfig(next: StrategyConfig) {
    saveStrategyConfig(next);
    setCfg(next);
  }

  // Edit a single non-balance field on an entry.
  // `formula` is the original "=expr" text — preserved so the user sees it
  // on next focus. Cleared when value is cleared or input is a plain number.
  function updateEntryField(
    entryId: string,
    field: "manualInvested" | "transfersUsd" | "comment",
    value: number | string | undefined,
    formula?: string,
  ) {
    const next = entries.map((e) => {
      if (e.id !== entryId) return e;
      const updated = { ...e };
      if (value === undefined || value === "") delete updated[field];
      else (updated as Record<string, unknown>)[field] = value;
      // Update formulas map for this field
      if (field !== "comment") {
        const formulas = { ...(e.formulas ?? {}) };
        if (formula) formulas[field] = formula;
        else delete formulas[field];
        if (Object.keys(formulas).length > 0) updated.formulas = formulas;
        else delete updated.formulas;
      }
      return updated;
    });
    saveDiaryEntries(next);
    setEntries(next);
  }

  // Edit a single broker balance on a FROZEN entry. Live entries reject
  // balance edits at the UI layer (EditableBalanceCell disabled prop).
  // If the entry lacks an FX rate for the broker's non-USD currency, fetch
  // the historical rate so Total recomputes correctly.
  async function updateBrokerBalance(
    entryId: string,
    brokerId: string,
    value: number | undefined,
    formula?: string,
  ) {
    const formulaKey = `balance:${brokerId}`;
    const next = entries.map((e) => {
      if (e.id !== entryId) return e;
      if (isEntryLive(e)) return e;
      const nextBalances = { ...(e.balances ?? {}) };
      if (value === undefined || value === 0) delete nextBalances[brokerId];
      else nextBalances[brokerId] = value;
      const formulas = { ...(e.formulas ?? {}) };
      if (formula) formulas[formulaKey] = formula;
      else delete formulas[formulaKey];
      const updated: typeof e = { ...e, balances: nextBalances };
      if (Object.keys(formulas).length > 0) updated.formulas = formulas;
      else delete updated.formulas;
      return updated;
    });
    saveDiaryEntries(next);
    setEntries(next);

    // Trigger FX fetch if the edited broker's currency lacks a rate on this date.
    if (!value || value <= 0) return;
    const broker = brokers.find((b) => b.id === brokerId);
    const target = next.find((e) => e.id === entryId);
    if (!broker || !target || broker.currency === "USD") return;
    const r = target.rates ?? {};
    const hasRate =
      broker.currency === "TRY" ? !!r.usdPerTry :
      broker.currency === "RUB" ? !!r.usdPerRub :
      broker.currency === "EUR" ? !!r.usdPerEur :
      true;
    if (hasRate) return;
    try {
      const { ratesByDate } = await fetchHistoricalFxMap(
        target.date,
        target.date,
        {
          TRY: broker.currency === "TRY",
          RUB: broker.currency === "RUB",
          EUR: broker.currency === "EUR",
          BTC: false,
        },
      );
      const fetched = pickRatesForDate(target.date, ratesByDate);
      if (Object.keys(fetched).length === 0) return;
      setEntries((prev) => {
        const updated = prev.map((e) =>
          e.id === entryId
            ? { ...e, rates: { ...(e.rates ?? {}), ...fetched } }
            : e,
        );
        saveDiaryEntries(updated);
        return updated;
      });
    } catch (err) {
      console.warn("On-demand FX fetch failed:", err);
    }
  }

  // ── Action handlers (passed to Settings) ──────────────────────────────
  async function handleSnapshotNow() {
    if (positions.length === 0) {
      showToast("Позиций нет — снимок будет пустым", "#f59e0b");
    }
    const rates = await fetchCurrentRates();
    setEntries((prev) => {
      const next = ensureTodayEntry(prev, positions, liveQuotes, brokers, rates);
      saveDiaryEntries(next);
      return next;
    });
    showToast("Снимок обновлён");
  }

  async function handleBackfill() {
    if (positions.length === 0) {
      showToast("Нет позиций — нечего пересчитывать", "#ef4444");
      return;
    }
    const ok = confirm(
      "Перезаписать ВСЕ записи дневника из исторических цен и FX?\n\nЕсли в Стратегии не задана дата начала — возьму самую раннюю purchaseDate.\n\nСобытия капитала сохранятся.",
    );
    if (!ok) return;
    setBackfilling(true);
    try {
      const result = await runBackfill({ positions, brokers, cfg });
      saveDiaryEntries(result.entries);
      setEntries(result.entries);
      const w = result.warnings.length > 0 ? ` · ${result.warnings.length} предупр.` : "";
      showToast(
        `Сгенерировано ${result.entries.length} записей с ${result.meta.startDate} (тикеры ${result.meta.tickersFetched}/${result.meta.tickersRequested}, FX: ${result.meta.fxFetched.join(",") || "—"})${w}`,
      );
      if (result.warnings.length > 0) console.warn("Backfill warnings:", result.warnings);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
      showToast(`Ошибка бэкфилла: ${msg}`, "#ef4444");
      console.error(err);
    } finally {
      setBackfilling(false);
    }
  }

  async function handleRefreshFx() {
    if (entries.length === 0) {
      showToast("Нет записей — нечего обновлять", "#ef4444");
      return;
    }
    setRefreshingFx(true);
    try {
      const dates = entries.map((e) => e.date).sort();
      const used = new Set(brokers.map((b) => b.currency));
      const { ratesByDate, fetched, missing } = await fetchHistoricalFxMap(
        dates[0],
        dates[dates.length - 1],
        {
          TRY: used.has("TRY"),
          RUB: used.has("RUB"),
          EUR: used.has("EUR"),
          BTC: brokers.some((b) => b.isCrypto),
        },
      );
      let updated = 0;
      const next = entries.map((e) => {
        const r = pickRatesForDate(e.date, ratesByDate);
        const merged = { ...(e.rates ?? {}), ...r };
        if (JSON.stringify(merged) === JSON.stringify(e.rates ?? {})) return e;
        updated += 1;
        return { ...e, rates: merged };
      });
      saveDiaryEntries(next);
      setEntries(next);
      const m = missing.length > 0 ? ` · нет: ${missing.join(",")}` : "";
      showToast(`Курсы обновлены для ${updated}/${entries.length} (FX: ${fetched.join(",") || "—"})${m}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
      showToast(`Ошибка обновления курсов: ${msg}`, "#ef4444");
      console.error(err);
    } finally {
      setRefreshingFx(false);
    }
  }

  async function handleImport(file: File) {
    if (isNumbersFile(file)) {
      showToast(NUMBERS_EXPORT_INSTRUCTIONS, "#f59e0b");
      return;
    }
    let text: string;
    try {
      text = isExcelFile(file) ? await xlsxFileToCsv(file) : await file.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Не удалось прочитать файл";
      showToast(`Ошибка чтения файла: ${msg}`, "#ef4444");
      return;
    }
    const result = importDiaryCsv(text, brokers);
    if (result.errors.length > 0) {
      showToast(result.errors.join(" · "), "#ef4444");
      return;
    }
    const existingByDate = new Map(entries.map((e) => [e.date, e]));
    const merged = [...entries];
    for (const e of result.entries) {
      const ex = existingByDate.get(e.date);
      if (ex) {
        const idx = merged.indexOf(ex);
        merged[idx] = { ...ex, ...e };
      } else {
        merged.push(e);
      }
    }
    merged.sort((a, b) => a.date.localeCompare(b.date));
    saveDiaryEntries(merged);
    setEntries(merged);

    const eventByDateCat = new Set(events.map((ev) => `${ev.date}|${ev.category}`));
    const newEvents = result.events.filter((ev) => !eventByDateCat.has(`${ev.date}|${ev.category}`));
    if (newEvents.length > 0) {
      const mergedEvents = [...events, ...newEvents];
      saveCapitalEvents(mergedEvents);
      setEvents(mergedEvents);
    }
    setDiag(result.diagnostics);
    showToast(`Импорт: ${result.entries.length} записей, +${newEvents.length} событий`);
  }

  function handleClear() {
    if (!confirm("Удалить ВСЕ записи, события, брокеров и стратегию? Действие необратимо.")) return;
    clearDiaryStorage();
    setEntries([]);
    setEvents([]);
    setBrokers(makeDefaultBrokers());
    setCfg(DEFAULT_STRATEGY_CONFIG);
    setVisibility(DEFAULT_COLUMN_VISIBILITY);
    showToast("Дневник очищен", "#f59e0b");
  }

  return (
    <div style={{ padding: "0 24px 32px" }}>
      <PageHeader title="Финансовый дневник" subtitle="Авто-снимки из портфеля, план, фактическая доходность" />

      {toast && <ToastView msg={toast.msg} color={toast.color} />}

      <div style={tabsBar}>
        <button onClick={() => setTab("journal")} style={tabBtn(tab === "journal")}>Журнал</button>
        <button onClick={() => setTab("analytics")} style={tabBtn(tab === "analytics")}>Аналитика</button>
        <button onClick={() => setTab("excel")} style={tabBtn(tab === "excel")}>Excel</button>
        <button onClick={() => setTab("settings")} style={tabBtn(tab === "settings")}>Настройки</button>
      </div>

      {tab === "journal" && (
        <JournalView
          entries={entries}
          brokers={brokers}
          cfg={cfg}
          events={events}
          visibility={visibility}
          onChangeVisibility={updateVisibility}
          onEditField={updateEntryField}
          onEditBalance={updateBrokerBalance}
          onOpenBrokers={() => setBrokerModalOpen(true)}
        />
      )}

      {tab === "analytics" && (
        <AnalyticsView entries={entries} brokers={brokers} cfg={cfg} events={events} />
      )}

      {tab === "excel" && (
        <ExcelView positions={positions} liveQuotes={liveQuotes} brokers={brokers} />
      )}

      {tab === "settings" && (
        <SettingsView
          cfg={cfg}
          onChangeConfig={updateConfig}
          brokers={brokers}
          onOpenBrokerModal={() => setBrokerModalOpen(true)}
          onClear={handleClear}
          diag={diag}
          onSnapshot={handleSnapshotNow}
          onBackfill={handleBackfill}
          backfilling={backfilling}
          onRefreshFx={handleRefreshFx}
          refreshingFx={refreshingFx}
          onImport={() => fileRef.current?.click()}
          onFileChange={handleImport}
          fileRef={fileRef}
          entriesCount={entries.length}
        />
      )}

      {/* Capital events panel — always visible above the table on the journal tab */}
      {tab === "journal" && events.length > 0 && (
        <section style={{ marginTop: 18 }}>
          <h3 style={sectionTitle}>События капитала ({events.length})</h3>
          <div style={eventsTableWrap}>
            <table style={eventsTable}>
              <thead>
                <tr>
                  <th style={evTh}>Дата</th>
                  <th style={evTh}>Категория</th>
                  <th style={{ ...evTh, textAlign: "right" }}>Сумма USD</th>
                  <th style={evTh}>Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td style={evTd}>{ev.date}</td>
                    <td style={evTd}>{CAPITAL_EVENT_LABELS[ev.category]}</td>
                    <td
                      style={{
                        ...evTd,
                        textAlign: "right",
                        color: ev.amountUsd >= 0 ? "#22c55e" : "#ef4444",
                        fontWeight: 600,
                      }}
                    >
                      {ev.amountUsd >= 0 ? "+" : "−"}${Math.abs(ev.amountUsd).toLocaleString("ru-RU")}
                    </td>
                    <td style={evTd}>{ev.comment ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {brokerModalOpen && (
        <BrokerManagerModal
          brokers={brokers}
          onChange={updateBrokers}
          onClose={() => setBrokerModalOpen(false)}
        />
      )}
    </div>
  );
}

// ── Small helpers / styles ──────────────────────────────────────────────

function ToastView({ msg, color }: { msg: string; color: string }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 80,
        right: 24,
        zIndex: 1000,
        padding: "12px 18px",
        borderRadius: 10,
        background: color,
        color: "white",
        fontSize: 13,
        fontWeight: 600,
        boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        maxWidth: 460,
      }}
    >
      {msg}
    </div>
  );
}

const tabsBar: React.CSSProperties = {
  display: "flex",
  gap: 6,
  marginBottom: 18,
  borderBottom: "1px solid var(--border)",
};
const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: "10px 16px",
  background: "transparent",
  border: "none",
  borderBottom: active ? "2px solid var(--accent, #3b82f6)" : "2px solid transparent",
  color: active ? "var(--text-primary)" : "var(--text-muted)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
});

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--text-muted)",
  marginBottom: 8,
};
const eventsTableWrap: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  overflow: "auto",
};
const eventsTable: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};
const evTh: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  background: "var(--bg-secondary)",
  borderBottom: "1px solid var(--border)",
  color: "var(--text-muted)",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};
const evTd: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid var(--border)",
  color: "var(--text-primary)",
  whiteSpace: "nowrap",
};
