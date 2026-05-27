"use client";

// Financial Diary — Sprint 2.
//
// Tabs:
//   1. Журнал — Excel-like table with dynamic brokers, sticky first column,
//      column visibility menu, capital events panel, snapshot-now button.
//   2. Настройки — strategy config editor + broker manager.
//
// Storage: localStorage. Cloud sync lands in Sprint 5.

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Settings as SettingsIcon, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import BrokerManagerModal from "@/components/diary/BrokerManagerModal";
import ColumnVisibilityMenu from "@/components/diary/ColumnVisibilityMenu";
import {
  clearDiaryStorage,
  loadBrokers,
  loadCapitalEvents,
  loadColumnVisibility,
  loadDiaryEntries,
  loadImportDiagnostics,
  loadStrategyConfig,
  saveBrokers,
  saveCapitalEvents,
  saveColumnVisibility,
  saveDiaryEntries,
  saveImportDiagnostics,
  saveStrategyConfig,
  upsertDiaryEntry,
} from "@/lib/diary/storage";
import { importDiaryCsv } from "@/lib/diary/import";
import type { ImportDiagnostics } from "@/lib/diary/import";
import { isExcelFile, isNumbersFile, NUMBERS_EXPORT_INSTRUCTIONS, xlsxFileToCsv } from "@/lib/diary/excel";
import { computeEntryMetrics } from "@/lib/diary/compute";
import { fetchCurrentRates } from "@/lib/diary/fx";
import { buildSnapshotFromPositions } from "@/lib/diary/positions-snapshot";
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

type Tab = "journal" | "settings";

function fmtUsd(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ru-RU", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function fmtPct(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

function fmtNative(n: number, currency: string): string {
  if (!n) return "—";
  const symbol = currency === "USD"
    ? "$"
    : currency === "TRY"
    ? "₺"
    : currency === "RUB"
    ? "₽"
    : currency === "EUR"
    ? "€"
    : "";
  return `${symbol}${n.toLocaleString("ru-RU", { maximumFractionDigits: 0 })}`;
}

function isColVisible(state: ColumnVisibilityState, id: string, defaultOn: boolean): boolean {
  const v = state.visible[id];
  return v === undefined ? defaultOn : v;
}

export default function DiaryPage() {
  const [tab, setTab] = useState<Tab>("journal");
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [events, setEvents] = useState<CapitalEvent[]>([]);
  const [brokers, setBrokers] = useState<DiaryBroker[]>([]);
  const [cfg, setCfg] = useState<StrategyConfig>(DEFAULT_STRATEGY_CONFIG);
  const [visibility, setVisibility] = useState<ColumnVisibilityState>(
    DEFAULT_COLUMN_VISIBILITY,
  );
  const [diag, setDiag] = useState<ImportDiagnostics | null>(null);
  const [brokerModalOpen, setBrokerModalOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; color: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const positions = usePortfolioStore((s) => s.positions);
  const liveQuotes = useQuotesStore((s) => s.liveQuotes);

  useEffect(() => {
    setEntries(loadDiaryEntries());
    setEvents(loadCapitalEvents());
    setBrokers(loadBrokers());
    setCfg(loadStrategyConfig());
    setVisibility(loadColumnVisibility());
    setDiag(loadImportDiagnostics());
  }, []);

  function showToast(msg: string, color = "#22c55e") {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Persistent setters ────────────────────────────────────────────────
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

  // ── Actions ───────────────────────────────────────────────────────────
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
      showToast(`Ошибки: ${result.errors.join("; ")}`, "#ef4444");
      return;
    }
    if (result.entries.length === 0) {
      showToast("Не найдено ни одной строки", "#f59e0b");
      return;
    }
    // Merge with existing data instead of replacing.
    // - entries: upsert by date (new wins on conflict)
    // - capital events: dedupe by date+amountUsd+category
    // - brokers: keep existing, append unknown labels
    // - strategy config: keep existing if startDate already set, else apply suggested
    const existingEntries = loadDiaryEntries();
    const byDate = new Map(existingEntries.map((e) => [e.date, e]));
    for (const ne of result.entries) byDate.set(ne.date, ne);
    const mergedEntries = Array.from(byDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const existingEvents = loadCapitalEvents();
    const eventKey = (e: CapitalEvent) =>
      `${e.date}|${Math.round(e.amountUsd)}|${e.category}`;
    const seenEvents = new Set(existingEvents.map(eventKey));
    const mergedEvents = [...existingEvents];
    for (const ev of result.events) {
      if (!seenEvents.has(eventKey(ev))) {
        seenEvents.add(eventKey(ev));
        mergedEvents.push(ev);
      }
    }
    mergedEvents.sort((a, b) => a.date.localeCompare(b.date));

    const existingBrokerLabels = new Set(brokers.map((b) => b.label.toLowerCase()));
    const newBrokersToAdd = result.brokers.filter(
      (b) => !existingBrokerLabels.has(b.label.toLowerCase()),
    );
    const mergedBrokers = newBrokersToAdd.length > 0
      ? [...brokers, ...newBrokersToAdd]
      : brokers;

    const mergedCfg = cfg.startDate ? cfg : result.suggestedConfig;

    saveDiaryEntries(mergedEntries);
    saveCapitalEvents(mergedEvents);
    saveBrokers(mergedBrokers);
    saveStrategyConfig(mergedCfg);
    saveImportDiagnostics(result.diagnostics);
    setEntries(mergedEntries);
    setEvents(mergedEvents);
    setBrokers(mergedBrokers);
    setCfg(mergedCfg);
    setDiag(result.diagnostics);

    const addedRows = result.entries.length;
    const newRows = result.entries.filter((e) => !existingEntries.some((x) => x.date === e.date)).length;
    const updatedRows = addedRows - newRows;
    const addedEvents = mergedEvents.length - existingEvents.length;
    const withInvested = result.entries.filter((e) => e.importedInvested !== undefined).length;
    const withPlan = result.entries.filter((e) => e.importedPlan !== undefined).length;
    const withOverPct = result.entries.filter((e) => e.importedOverProfitPct !== undefined).length;
    const w = result.warnings.length > 0
      ? ` · ${result.warnings.length} предупр.`
      : "";
    showToast(
      `+${newRows} новых, ${updatedRows} обновлено, +${addedEvents} событий (Инв:${withInvested} План:${withPlan} Сверх%:${withOverPct})${w}`,
    );
    if (result.warnings.length > 0) {
      console.warn("Diary import warnings:", result.warnings);
    }
  }

  async function handleSnapshotNow() {
    if (positions.length === 0) {
      showToast("Позиций нет — фиксирую пустую запись", "#f59e0b");
    }
    const rates = await fetchCurrentRates();
    const snap = buildSnapshotFromPositions({
      positions,
      quotes: liveQuotes,
      brokers,
      rates,
    });
    const today = new Date().toISOString().slice(0, 10);
    const entry: DiaryEntry = {
      id: `diary-${today}`,
      date: today,
      balances: snap.balances,
      rates,
      comment: undefined,
    };
    const next = upsertDiaryEntry(entry);
    setEntries(next);
    let msg = `Снимок сохранён за ${today}`;
    if (snap.unmappedBrokers.length > 0) {
      msg += ` · не привязаны: ${snap.unmappedBrokers.join(", ")}`;
    }
    if (snap.missingRates.length > 0) {
      msg += ` · нет курса для ${snap.missingRates.join(", ")}`;
    }
    showToast(msg);
  }

  function handleClear() {
    if (!confirm("Удалить ВСЕ записи дневника, события и брокеров? Это действие необратимо.")) {
      return;
    }
    clearDiaryStorage();
    setEntries([]);
    setEvents([]);
    setBrokers(makeDefaultBrokers());
    setCfg(DEFAULT_STRATEGY_CONFIG);
    showToast("Дневник очищен", "#f59e0b");
  }

  // ── Derived ───────────────────────────────────────────────────────────
  const latestMetrics = useMemo(() => {
    if (entries.length === 0 || brokers.length === 0) return null;
    const last = entries[entries.length - 1];
    return computeEntryMetrics({ entry: last, brokers, cfg, events });
  }, [entries, brokers, cfg, events]);

  return (
    <div style={{ padding: "0 24px 32px" }}>
      <PageHeader
        title="Финансовый дневник"
        subtitle="Ежедневные снапшоты, план vs факт, события капитала"
      />

      {toast && (
        <div
          style={{
            position: "fixed",
            top: 80,
            right: 24,
            zIndex: 1000,
            padding: "12px 18px",
            borderRadius: 10,
            background: toast.color,
            color: "white",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            maxWidth: 460,
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div style={tabsBar}>
        <button onClick={() => setTab("journal")} style={tabBtn(tab === "journal")}>
          Журнал
        </button>
        <button onClick={() => setTab("settings")} style={tabBtn(tab === "settings")}>
          Настройки
        </button>
      </div>

      {tab === "journal"
        ? (
          <JournalTab
            entries={entries}
            events={events}
            brokers={brokers}
            cfg={cfg}
            visibility={visibility}
            onChangeVisibility={updateVisibility}
            onImport={() => fileRef.current?.click()}
            onSnapshot={handleSnapshotNow}
            latestMetrics={latestMetrics}
            fileRef={fileRef}
            onFileChange={handleImport}
          />
        )
        : (
          <SettingsTab
            cfg={cfg}
            onChangeConfig={updateConfig}
            brokers={brokers}
            onOpenBrokerModal={() => setBrokerModalOpen(true)}
            onClear={handleClear}
            diag={diag}
          />
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

// ── Journal tab ─────────────────────────────────────────────────────────

function JournalTab({
  entries,
  events,
  brokers,
  cfg,
  visibility,
  onChangeVisibility,
  onImport,
  onSnapshot,
  latestMetrics,
  fileRef,
  onFileChange,
}: {
  entries: DiaryEntry[];
  events: CapitalEvent[];
  brokers: DiaryBroker[];
  cfg: StrategyConfig;
  visibility: ColumnVisibilityState;
  onChangeVisibility: (v: ColumnVisibilityState) => void;
  onImport: () => void;
  onSnapshot: () => void;
  latestMetrics: ReturnType<typeof computeEntryMetrics> | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (f: File) => void;
}) {
  const sortedBrokers = useMemo(
    () => [...brokers].sort((a, b) => a.order - b.order),
    [brokers],
  );

  const rows = useMemo(() => {
    return [...entries].reverse().map((e) => ({
      entry: e,
      metrics: computeEntryMetrics({ entry: e, brokers, cfg, events }),
    }));
  }, [entries, brokers, cfg, events]);

  return (
    <>
      {/* Hero */}
      {latestMetrics && (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr 1fr 1fr",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <HeroCard
            label="Сверх прибыль"
            primary={fmtPct(latestMetrics.overProfitPct)}
            secondary={`${
              latestMetrics.overProfitUsd >= 0 ? "+" : "−"
            }${fmtUsd(Math.abs(latestMetrics.overProfitUsd))} над планом`}
            accent={latestMetrics.overProfitPct >= 0 ? "#22c55e" : "#ef4444"}
            big
          />
          <HeroCard
            label="Total сейчас"
            primary={fmtUsd(latestMetrics.totalUsd)}
            secondary={latestMetrics.missingRates.length > 0
              ? `Не хватает курсов: ${latestMetrics.missingRates.join(", ")}`
              : `на ${latestMetrics.date}`}
          />
          <HeroCard
            label="План (стратегия)"
            primary={fmtUsd(latestMetrics.strategyPlan)}
            secondary={`Инвестировано ${fmtUsd(latestMetrics.strategyInvested)}`}
          />
          <HeroCard
            label="Заработано"
            primary={fmtUsd(latestMetrics.earnedUsd)}
            secondary={`Цель 10%: ${fmtUsd(latestMetrics.target10Pct)}`}
            accent={latestMetrics.earnedUsd >= 0 ? "#22c55e" : "#ef4444"}
          />
        </section>
      )}

      {/* Action bar */}
      <div style={actionBar}>
        <button onClick={onSnapshot} style={btnPrimary}>
          <Camera size={14} /> Снять снимок сейчас
        </button>
        <button onClick={onImport} style={btnSecondary}>
          Импорт Excel / CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.xlsm,.numbers,.csv,.tsv,.txt"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFileChange(f);
            e.target.value = "";
          }}
        />
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {entries.length > 0
              ? `${entries.length} записей · с ${entries[0].date} по ${entries[entries.length - 1].date}`
              : "Нет данных"}
          </span>
          <ColumnVisibilityMenu
            brokers={brokers}
            visibility={visibility}
            onChange={onChangeVisibility}
          />
        </div>
      </div>

      {/* Capital events */}
      {events.length > 0 && (
        <section style={{ marginBottom: 16 }}>
          <h3 style={sectionTitle}>События капитала ({events.length})</h3>
          <div style={tableWrap}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={th}>Дата</th>
                  <th style={th}>Категория</th>
                  <th style={{ ...th, textAlign: "right" }}>Сумма USD</th>
                  <th style={th}>Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td style={td}>{ev.date}</td>
                    <td style={td}>{CAPITAL_EVENT_LABELS[ev.category]}</td>
                    <td
                      style={{
                        ...td,
                        textAlign: "right",
                        color: ev.amountUsd >= 0 ? "#22c55e" : "#ef4444",
                        fontWeight: 600,
                      }}
                    >
                      {ev.amountUsd >= 0 ? "+" : "−"}
                      {fmtUsd(Math.abs(ev.amountUsd))}
                    </td>
                    <td style={td}>{ev.comment ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Journal table */}
      <section>
        <h3 style={sectionTitle}>Журнал ({entries.length})</h3>
        {entries.length === 0
          ? <EmptyState />
          : (
            <div style={{ ...tableWrap, maxHeight: "65vh" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...th, ...stickyFirstCol }}>Дата</th>
                    {sortedBrokers.map((b) =>
                      isColVisible(visibility, `broker:${b.id}`, true) && (
                        <th key={b.id} style={{ ...th, textAlign: "right" }}>
                          {b.label}
                          <div style={{ fontSize: 9, fontWeight: 400, color: "var(--text-muted)", textTransform: "none" }}>
                            {b.currency}
                          </div>
                        </th>
                      )
                    )}
                    {isColVisible(visibility, "totalUsd", true) && <th style={{ ...th, textAlign: "right" }}>Total USD</th>}
                    {isColVisible(visibility, "investedFromPositions", true) && <th style={{ ...th, textAlign: "right" }}>Инвестировано</th>}
                    {isColVisible(visibility, "target10Pct", true) && <th style={{ ...th, textAlign: "right" }}>Цель 10%</th>}
                    {isColVisible(visibility, "earnedUsd", true) && <th style={{ ...th, textAlign: "right" }}>Заработано</th>}
                    {isColVisible(visibility, "strategyPlan", true) && <th style={{ ...th, textAlign: "right" }}>План</th>}
                    {isColVisible(visibility, "overProfitPct", true) && <th style={{ ...th, textAlign: "right" }}>Сверх %</th>}
                    {isColVisible(visibility, "balanceEur", false) && <th style={{ ...th, textAlign: "right" }}>EUR</th>}
                    {isColVisible(visibility, "balanceBtc", false) && <th style={{ ...th, textAlign: "right" }}>BTC</th>}
                    {isColVisible(visibility, "balanceTry", false) && <th style={{ ...th, textAlign: "right" }}>TRY</th>}
                    {isColVisible(visibility, "balanceRub", false) && <th style={{ ...th, textAlign: "right" }}>RUB</th>}
                    {isColVisible(visibility, "comment", true) && <th style={th}>Комент</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ entry: e, metrics: m }) => (
                    <tr key={e.id}>
                      <td style={{ ...td, ...stickyFirstCol, fontWeight: 600 }}>{e.date}</td>
                      {sortedBrokers.map((b) =>
                        isColVisible(visibility, `broker:${b.id}`, true) && (
                          <td key={b.id} style={{ ...td, textAlign: "right" }}>
                            {fmtNative(e.balances[b.id] || 0, b.currency)}
                          </td>
                        )
                      )}
                      {isColVisible(visibility, "totalUsd", true) && (
                        <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>
                          {fmtUsd(m.totalUsd)}
                        </td>
                      )}
                      {isColVisible(visibility, "investedFromPositions", true) && (
                        <td style={{ ...td, textAlign: "right", color: "var(--text-muted)" }}>
                          {fmtUsd(m.positionInvested)}
                        </td>
                      )}
                      {isColVisible(visibility, "target10Pct", true) && (
                        <td style={{ ...td, textAlign: "right", color: "var(--text-muted)" }}>
                          {fmtUsd(m.target10Pct)}
                        </td>
                      )}
                      {isColVisible(visibility, "earnedUsd", true) && (
                        <td
                          style={{
                            ...td,
                            textAlign: "right",
                            color: m.earnedUsd >= 0 ? "#22c55e" : "#ef4444",
                            fontWeight: 600,
                          }}
                        >
                          {fmtUsd(m.earnedUsd)}
                        </td>
                      )}
                      {isColVisible(visibility, "strategyPlan", true) && (
                        <td style={{ ...td, textAlign: "right", color: "var(--text-muted)" }}>
                          {fmtUsd(m.strategyPlan)}
                        </td>
                      )}
                      {isColVisible(visibility, "overProfitPct", true) && (
                        <td
                          style={{
                            ...td,
                            textAlign: "right",
                            color: m.overProfitPct >= 0 ? "#22c55e" : "#ef4444",
                            fontWeight: 600,
                          }}
                        >
                          {fmtPct(m.overProfitPct)}
                        </td>
                      )}
                      {isColVisible(visibility, "balanceEur", false) && (
                        <td style={{ ...td, textAlign: "right" }}>{e.balanceEur ? `€${e.balanceEur.toLocaleString("ru-RU", { maximumFractionDigits: 0 })}` : "—"}</td>
                      )}
                      {isColVisible(visibility, "balanceBtc", false) && (
                        <td style={{ ...td, textAlign: "right" }}>{e.balanceBtc ? `₿${e.balanceBtc.toFixed(4)}` : "—"}</td>
                      )}
                      {isColVisible(visibility, "balanceTry", false) && (
                        <td style={{ ...td, textAlign: "right" }}>{e.balanceTry ? `₺${e.balanceTry.toLocaleString("ru-RU", { maximumFractionDigits: 0 })}` : "—"}</td>
                      )}
                      {isColVisible(visibility, "balanceRub", false) && (
                        <td style={{ ...td, textAlign: "right" }}>{e.balanceRub ? `₽${e.balanceRub.toLocaleString("ru-RU", { maximumFractionDigits: 0 })}` : "—"}</td>
                      )}
                      {isColVisible(visibility, "comment", true) && (
                        <td style={{ ...td, fontSize: 11, color: "var(--text-muted)" }}>{e.comment ?? ""}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
    </>
  );
}

// ── Settings tab ────────────────────────────────────────────────────────

function SettingsTab({
  cfg,
  onChangeConfig,
  brokers,
  onOpenBrokerModal,
  onClear,
  diag,
}: {
  cfg: StrategyConfig;
  onChangeConfig: (next: StrategyConfig) => void;
  brokers: DiaryBroker[];
  onOpenBrokerModal: () => void;
  onClear: () => void;
  diag: ImportDiagnostics | null;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
      {/* Strategy */}
      <section style={settingsCard}>
        <h3 style={sectionTitle}>Стратегия baseline</h3>
        <p style={subline}>
          План = «Инвестировано» × 10% годовых × (дней с начала / 365). Меняется
          при capital events. Считаем по календарным дням, выходные включены.
        </p>
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <FieldRow label="Дата старта">
            <input
              type="date"
              value={cfg.startDate}
              onChange={(e) => onChangeConfig({ ...cfg, startDate: e.target.value })}
              style={inputStyle}
            />
          </FieldRow>
          <FieldRow label="Стартовая сумма (USD)">
            <input
              type="number"
              value={cfg.initialInvested}
              onChange={(e) => onChangeConfig({ ...cfg, initialInvested: Number(e.target.value) })}
              style={inputStyle}
            />
          </FieldRow>
          <FieldRow label="Годовая ставка">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="number"
                step="0.01"
                value={cfg.annualRate * 100}
                onChange={(e) => onChangeConfig({ ...cfg, annualRate: Number(e.target.value) / 100 })}
                style={inputStyle}
              />
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>%</span>
            </div>
          </FieldRow>
          <FieldRow label="Дней в году">
            <input
              type="number"
              value={cfg.calendarDaysPerYear}
              onChange={(e) => onChangeConfig({ ...cfg, calendarDaysPerYear: Number(e.target.value) })}
              style={inputStyle}
            />
          </FieldRow>
        </div>
      </section>

      {/* Brokers */}
      <section style={settingsCard}>
        <h3 style={sectionTitle}>Брокеры ({brokers.length})</h3>
        <p style={subline}>
          Каждый брокер = колонка в журнале. Маппинг привязывает имена из{" "}
          <code style={code}>/positions</code> к этому брокеру.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: "12px 0" }}>
          {brokers.map((b) => (
            <li key={b.id} style={brokerRowShort}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{b.label}</span>
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
                {b.currency}
              </span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
                {b.positionBrokers.length > 0 ? `${b.positionBrokers.length} имён` : "не настроен"}
              </span>
            </li>
          ))}
        </ul>
        <button onClick={onOpenBrokerModal} style={btnPrimary}>
          <SettingsIcon size={13} /> Открыть управление
        </button>
      </section>

      {/* Import diagnostics — always visible so user can find it after import */}
      <section style={{ ...settingsCard, gridColumn: "1 / -1" }}>
        <h3 style={sectionTitle}>Диагностика последнего импорта</h3>
        <p style={subline}>
          Показывает что было распознано в файле. Если поле <b>null</b> — regex
          не нашёл колонку и значение в журнале будет пустым.
        </p>
        {diag
          ? <DiagnosticsPanel diag={diag} />
          : (
            <div style={{
              marginTop: 12,
              padding: 16,
              background: "var(--bg-secondary)",
              borderRadius: 8,
              border: "1px dashed var(--border)",
              textAlign: "center",
              fontSize: 12,
              color: "var(--text-muted)",
            }}>
              Импорта ещё не было. Перейди на вкладку «Журнал», нажми «Импорт
              Excel / CSV» и выбери файл — здесь появится отчёт.
            </div>
          )}
      </section>

      {/* Danger zone */}
      <section style={{ ...settingsCard, gridColumn: "1 / -1" }}>
        <h3 style={{ ...sectionTitle, color: "#ef4444" }}>Опасная зона</h3>
        <p style={subline}>
          Удалит все записи дневника, capital events и брокеров (брокеры
          вернутся к дефолтным). Колонки видимости останутся.
        </p>
        <button onClick={onClear} style={{ ...btnDanger, marginTop: 12 }}>
          <Trash2 size={13} /> Очистить дневник полностью
        </button>
      </section>
    </div>
  );
}

function DiagnosticsPanel({ diag }: { diag: ImportDiagnostics }) {
  const fields: { key: string; label: string; value: string | null }[] = [
    { key: "date", label: "Дата", value: diag.detected.date },
    { key: "invested", label: "Инвестировано", value: diag.detected.invested },
    { key: "plan10pct", label: "По стоку 10%", value: diag.detected.plan10pct },
    { key: "overProfitPct", label: "Сверх %", value: diag.detected.overProfitPct },
    { key: "total", label: "Total", value: diag.detected.total },
    { key: "eventAmount", label: "Перевод (USD event)", value: diag.detected.eventAmount },
    { key: "comment", label: "Комментарий", value: diag.detected.comment },
    { key: "currentLira", label: "Курс лиры", value: diag.detected.currentLira },
    { key: "eur", label: "Баланс EUR", value: diag.detected.eur },
    { key: "btc", label: "Баланс BTC", value: diag.detected.btc },
    { key: "try_", label: "Баланс TRY", value: diag.detected.try_ },
    { key: "rub", label: "Баланс RUB", value: diag.detected.rub },
  ];
  return (
    <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
      {/* Counts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <CountBox label="Инв." value={diag.counts.importedInvested} />
        <CountBox label="План" value={diag.counts.importedPlan} />
        <CountBox label="Сверх %" value={diag.counts.importedOverProfitPct} />
        <CountBox label="События" value={diag.counts.capitalEvents} />
      </div>

      {/* Detected columns */}
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 700, textTransform: "uppercase" }}>
          Сопоставленные колонки
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {fields.map((f) => (
            <div key={f.key} style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "6px 10px",
              background: "var(--bg-secondary)",
              borderLeft: `3px solid ${f.value ? "#22c55e" : "#ef4444"}`,
              borderRadius: 4,
              fontSize: 11,
            }}>
              <span style={{ color: "var(--text-secondary)" }}>{f.label}</span>
              <span style={{
                fontFamily: "ui-monospace, monospace",
                color: f.value ? "var(--text-primary)" : "#ef4444",
                fontWeight: 600,
              }}>
                {f.value ?? "null"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Broker columns */}
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 700, textTransform: "uppercase" }}>
          Брокеры ({Object.keys(diag.detected.brokers).length})
        </div>
        {Object.keys(diag.detected.brokers).length === 0
          ? <div style={{ fontSize: 11, color: "#ef4444" }}>Ни один броker не сматчился</div>
          : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Object.entries(diag.detected.brokers).map(([label, header]) => (
                <span key={label} style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 4,
                  background: "rgba(34,197,94,0.12)",
                  color: "#22c55e",
                  fontFamily: "ui-monospace, monospace",
                }}>
                  {label} → {header}
                </span>
              ))}
            </div>
          )}
      </div>

      {/* All headers */}
      <details>
        <summary style={{
          cursor: "pointer",
          fontSize: 11,
          color: "var(--text-muted)",
          fontWeight: 700,
          textTransform: "uppercase",
        }}>
          Все заголовки файла ({diag.headers.length})
        </summary>
        <div style={{
          marginTop: 8,
          padding: 10,
          background: "var(--bg-secondary)",
          borderRadius: 6,
          fontSize: 11,
          fontFamily: "ui-monospace, monospace",
          color: "var(--text-secondary)",
          lineHeight: 1.6,
          maxHeight: 200,
          overflow: "auto",
        }}>
          {diag.headers.map((h, i) => (
            <div key={i}>
              <span style={{ color: "var(--text-muted)" }}>[{i}]</span> {h || <em style={{ color: "#ef4444" }}>пусто</em>}
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function CountBox({ label, value }: { label: string; value: number }) {
  const color = value > 0 ? "#22c55e" : "#ef4444";
  return (
    <div style={{
      padding: "10px 12px",
      background: "var(--bg-secondary)",
      borderRadius: 8,
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

// ── Small components ────────────────────────────────────────────────────

function HeroCard(props: {
  label: string;
  primary: string;
  secondary?: string;
  accent?: string;
  big?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: props.big ? "20px 22px" : "16px 18px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 6,
        }}
      >
        {props.label}
      </div>
      <div
        style={{
          fontSize: props.big ? 34 : 22,
          fontWeight: 700,
          color: props.accent ?? "var(--text-primary)",
          lineHeight: 1.1,
        }}
      >
        {props.primary}
      </div>
      {props.secondary && (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-secondary)",
            marginTop: 6,
          }}
        >
          {props.secondary}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px dashed var(--border)",
        borderRadius: 12,
        padding: "40px 24px",
        textAlign: "center",
        color: "var(--text-muted)",
      }}
    >
      <div style={{ fontSize: 14, marginBottom: 6 }}>Дневник пуст</div>
      <div style={{ fontSize: 12 }}>
        Нажмите «Импорт Excel/CSV» и выберите файл (.xlsx, .xls или .csv).
        Или «Снять снимок сейчас» — соберёт балансы из ваших позиций.
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 8, alignItems: "center" }}>
      <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</label>
      <div>{children}</div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const tabsBar: React.CSSProperties = {
  display: "flex",
  gap: 4,
  borderBottom: "1px solid var(--border)",
  marginBottom: 18,
};

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: "10px 18px",
    border: "none",
    background: "transparent",
    color: active ? "var(--text-primary)" : "var(--text-muted)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
    marginBottom: -1,
  };
}

const actionBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 14,
  flexWrap: "wrap",
};

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 14px",
  borderRadius: 8,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "white",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-secondary)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnDanger: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 14px",
  borderRadius: 8,
  border: "1px solid rgba(239,68,68,0.3)",
  background: "rgba(239,68,68,0.08)",
  color: "#ef4444",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  margin: "0 0 10px",
};

const tableWrap: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  overflow: "auto",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  fontSize: 12,
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  background: "var(--bg-secondary)",
  borderBottom: "1px solid var(--border)",
  color: "var(--text-muted)",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.3,
  position: "sticky",
  top: 0,
  zIndex: 2,
};

const td: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid var(--border)",
  color: "var(--text-primary)",
  whiteSpace: "nowrap",
};

const stickyFirstCol: React.CSSProperties = {
  position: "sticky",
  left: 0,
  background: "var(--bg-card)",
  zIndex: 1,
  borderRight: "1px solid var(--border)",
};

const settingsCard: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 18,
};

const subline: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "var(--text-muted)",
  lineHeight: 1.5,
};

const code: React.CSSProperties = {
  background: "var(--bg-secondary)",
  padding: "1px 5px",
  borderRadius: 4,
  fontSize: 11,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-secondary)",
  color: "var(--text-primary)",
  fontSize: 13,
};

const brokerRowShort: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  background: "var(--bg-secondary)",
  borderRadius: 6,
  marginBottom: 4,
};
