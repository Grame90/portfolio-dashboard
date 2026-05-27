"use client";

// Diary "Журнал" tab — table of daily snapshots.
//
// Invariants (maintained by the parent via ensureTodayEntry):
//   • Latest row = today (isLive). Balances refresh from /positions.
//   • All other rows = frozen.
//   • Editing rules:
//       - Today (isLive): only Переводы + Комент editable
//       - Past (frozen): balances, Переводы, manualInvested, Комент editable

import { useMemo } from "react";
import { isEntryLive } from "@/lib/diary/auto-snapshot";
import { computeEntryMetrics } from "@/lib/diary/compute";
import type {
  CapitalEvent,
  ColumnVisibilityState,
  DiaryBroker,
  DiaryEntry,
  StrategyConfig,
} from "@/lib/diary/types";
import {
  EditableBalanceCell,
  EditableCommentCell,
  EditableUsdCell,
} from "./EditableCells";
import ColumnVisibilityMenu from "./ColumnVisibilityMenu";

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

function isColVisible(state: ColumnVisibilityState, id: string, defaultOn: boolean): boolean {
  const v = state.visible[id];
  return v === undefined ? defaultOn : v;
}

type EditField = "manualInvested" | "transfersUsd" | "comment";

export type JournalViewProps = {
  entries: DiaryEntry[];
  brokers: DiaryBroker[];
  cfg: StrategyConfig;
  events: CapitalEvent[];
  visibility: ColumnVisibilityState;
  onChangeVisibility: (v: ColumnVisibilityState) => void;
  onEditField: (entryId: string, field: EditField, value: number | string | undefined, formula?: string) => void;
  onEditBalance: (entryId: string, brokerId: string, value: number | undefined, formula?: string) => void;
  onOpenBrokers: () => void;
};

export default function JournalView(props: JournalViewProps) {
  const {
    entries,
    brokers,
    cfg,
    events,
    visibility,
    onChangeVisibility,
    onEditField,
    onEditBalance,
    onOpenBrokers,
  } = props;

  const sortedBrokers = useMemo(
    () => [...brokers].sort((a, b) => a.order - b.order),
    [brokers],
  );

  // Cumulative transfers up to and including each entry's date.
  const cumulativeTransfersByDate = useMemo(() => {
    const map: Record<string, number> = {};
    let running = 0;
    for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
      running += e.transfersUsd ?? 0;
      map[e.date] = running;
    }
    return map;
  }, [entries]);

  // Sort: latest at top. Precompute each row's metrics AND its predecessor's
  // total so the "Δ за день" column can show day-over-day change.
  const rows = useMemo(() => {
    const sortedDesc = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    const allMetrics = sortedDesc.map((e) =>
      computeEntryMetrics({
        entry: e,
        brokers,
        cfg,
        events,
        cumulativeTransfersUsd: cumulativeTransfersByDate[e.date] ?? 0,
      }),
    );
    return sortedDesc.map((e, idx) => ({
      entry: e,
      live: isEntryLive(e),
      metrics: allMetrics[idx],
      // Predecessor = next index in desc-sorted array (earlier date).
      prevTotalUsd: allMetrics[idx + 1]?.totalUsd,
    }));
  }, [entries, brokers, cfg, events, cumulativeTransfersByDate]);

  return (
    <>
      {/* Slim toolbar */}
      <div style={toolbar}>
        <button onClick={onOpenBrokers} style={btnSecondary}>⚙ Брокеры</button>
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

      <section>
        {entries.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={tableWrap}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...th, ...stickyFirstCol }}>Дата</th>
                  {sortedBrokers.map(
                    (b) =>
                      isColVisible(visibility, `broker:${b.id}`, true) && (
                        <th key={b.id} style={{ ...th, textAlign: "right" }}>
                          {b.label}
                          <div style={{ fontSize: 9, fontWeight: 400, color: "var(--text-muted)", textTransform: "none" }}>
                            {b.currency}
                          </div>
                        </th>
                      ),
                  )}
                  {isColVisible(visibility, "totalUsd", true) && <th style={thRight}>Total USD</th>}
                  {isColVisible(visibility, "deltaDayPct", true) && <th style={thRight}>Δ за день</th>}
                  {isColVisible(visibility, "earnedUsd", true) && <th style={thRight}>Чистая прибыль</th>}
                  {isColVisible(visibility, "returnPct", true) && <th style={thRight}>Доходность % (всего)</th>}
                  {isColVisible(visibility, "overProfitPct", true) && <th style={thRight}>Сверх %</th>}
                  {isColVisible(visibility, "investedFromPositions", true) && <th style={thRight}>Инвестировано</th>}
                  {isColVisible(visibility, "transfersUsd", true) && <th style={thRight}>Переводы</th>}
                  {isColVisible(visibility, "comment", true) && <th style={th}>Комент</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ entry: e, live, metrics: m, prevTotalUsd }) => (
                  <tr key={e.id} style={live ? { background: "rgba(34, 197, 94, 0.06)" } : undefined}>
                    <td style={{ ...td, ...stickyFirstCol, fontWeight: 600 }}>
                      {e.date}
                      {live && <span style={liveBadge}>LIVE</span>}
                    </td>
                    {sortedBrokers.map(
                      (b) =>
                        isColVisible(visibility, `broker:${b.id}`, true) && (
                          <td key={b.id} style={{ ...td, textAlign: "right", padding: "4px 8px", minWidth: 110 }}>
                            <EditableBalanceCell
                              amount={e.balances[b.id] || 0}
                              currency={b.currency}
                              usdEquivalent={
                                b.currency === "USD"
                                  ? e.balances[b.id] || 0
                                  : (() => {
                                      const r =
                                        b.currency === "TRY"
                                          ? e.rates?.usdPerTry
                                          : b.currency === "RUB"
                                          ? e.rates?.usdPerRub
                                          : b.currency === "EUR"
                                          ? e.rates?.usdPerEur
                                          : undefined;
                                      return r && r > 0 ? (e.balances[b.id] || 0) * r : null;
                                    })()
                              }
                              rate={
                                b.currency === "TRY"
                                  ? e.rates?.usdPerTry
                                  : b.currency === "RUB"
                                  ? e.rates?.usdPerRub
                                  : b.currency === "EUR"
                                  ? e.rates?.usdPerEur
                                  : undefined
                              }
                              formula={e.formulas?.[`balance:${b.id}`]}
                              disabled={live}
                              onSave={(v, f) => onEditBalance(e.id, b.id, v, f)}
                            />
                          </td>
                        ),
                    )}
                    {isColVisible(visibility, "totalUsd", true) && (
                      <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmtUsd(m.totalUsd)}</td>
                    )}
                    {isColVisible(visibility, "deltaDayPct", true) && (
                      <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>
                        {(() => {
                          if (prevTotalUsd === undefined || prevTotalUsd === 0) {
                            return <span style={{ color: "var(--text-muted)" }}>—</span>;
                          }
                          const deltaUsd = m.totalUsd - prevTotalUsd;
                          const deltaPct = (deltaUsd / prevTotalUsd) * 100;
                          const color = deltaUsd >= 0 ? "#22c55e" : "#ef4444";
                          return (
                            <span style={{ color }}>
                              {deltaUsd > 0 ? "+" : deltaUsd < 0 ? "−" : ""}
                              {Math.abs(deltaPct).toFixed(2)}%
                              <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.7 }}>
                                ({deltaUsd > 0 ? "+" : "−"}${Math.round(Math.abs(deltaUsd)).toLocaleString("ru-RU")})
                              </span>
                            </span>
                          );
                        })()}
                      </td>
                    )}
                    {isColVisible(visibility, "earnedUsd", true) && (
                      <td style={{ ...td, textAlign: "right", fontWeight: 600, color: m.earnedUsd >= 0 ? "#22c55e" : "#ef4444" }}>
                        {fmtUsd(m.earnedUsd)}
                      </td>
                    )}
                    {isColVisible(visibility, "returnPct", true) && (
                      <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>
                        {(() => {
                          // Доходность = Total ÷ Инвестировано-этой-строки × 100.
                          // 100% = на уровне инвестированной суммы; >100 — прибыль; <100 — просадка.
                          const base = m.positionInvested;
                          if (!base || base <= 0) return "—";
                          const ret = (m.totalUsd / base) * 100;
                          const color = ret >= 100 ? "#22c55e" : "#ef4444";
                          return <span style={{ color }}>{ret.toFixed(1)}%</span>;
                        })()}
                      </td>
                    )}
                    {isColVisible(visibility, "overProfitPct", true) && (
                      <td style={{ ...td, textAlign: "right", fontWeight: 600, color: m.overProfitPct >= 0 ? "#22c55e" : "#ef4444" }}>
                        {fmtPct(m.overProfitPct)}
                      </td>
                    )}
                    {isColVisible(visibility, "investedFromPositions", true) && (
                      <td style={{ ...td, textAlign: "right", color: "var(--text-muted)", padding: "4px 8px" }}>
                        <EditableUsdCell
                          value={e.manualInvested}
                          formula={e.formulas?.manualInvested}
                          placeholder={Math.round(m.positionInvested).toString()}
                          emphasis={e.manualInvested !== undefined ? { fontWeight: 700, color: "#facc15" } : undefined}
                          onSave={(v, f) => onEditField(e.id, "manualInvested", v, f)}
                        />
                      </td>
                    )}
                    {isColVisible(visibility, "transfersUsd", true) && (
                      <td style={{ ...td, textAlign: "right", padding: "4px 8px" }}>
                        <EditableUsdCell
                          value={e.transfersUsd}
                          formula={e.formulas?.transfersUsd}
                          placeholder="—"
                          emphasis={
                            e.transfersUsd !== undefined && e.transfersUsd !== 0
                              ? {
                                  fontWeight: 600,
                                  color: e.transfersUsd > 0 ? "#22c55e" : "#ef4444",
                                }
                              : undefined
                          }
                          onSave={(v, f) => onEditField(e.id, "transfersUsd", v, f)}
                        />
                      </td>
                    )}
                    {isColVisible(visibility, "comment", true) && (
                      <td style={{ ...td, padding: "4px 8px", minWidth: 140 }}>
                        <EditableCommentCell
                          value={e.comment}
                          onSave={(v) => onEditField(e.id, "comment", v)}
                        />
                      </td>
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

// ── Empty state ─────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      style={{
        padding: "48px 24px",
        textAlign: "center",
        background: "var(--bg-card)",
        border: "1px dashed var(--border)",
        borderRadius: 12,
        color: "var(--text-muted)",
        fontSize: 13,
      }}
    >
      Пока нет записей. Добавь брокеров и позиции в портфеле — сегодня появится
      первый автоматический снапшот.
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const toolbar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 14,
  flexWrap: "wrap",
};

const btnSecondary: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const tableWrap: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  overflow: "auto",
  maxHeight: "70vh",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
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
const thRight: React.CSSProperties = { ...th, textAlign: "right" };

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

const liveBadge: React.CSSProperties = {
  display: "inline-block",
  marginLeft: 8,
  padding: "1px 6px",
  borderRadius: 4,
  background: "rgba(34, 197, 94, 0.18)",
  color: "#22c55e",
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 0.4,
};
