"use client";

import { useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { formatEtTime, type MarketStatus } from "@/lib/marketStatus";
import { ALL_COLS, DEFAULT_COLS, TICKER_BETA, PURCHASE_DATES } from "../constants";
import type { ColId, LivePosition } from "../types";

type QuoteStatus = "idle" | "loading" | "ok" | "error";
export type ActionTooltipState = { id: number; x: number; y: number } | null;
export type TickDirection = "up" | "down" | null;

interface PositionsTableProps {
  isMobile: boolean;
  positions: LivePosition[];
  displayPositions: LivePosition[];

  market: MarketStatus;
  lastPriceT: number;
  quoteStatus: QuoteStatus;

  colOrder: ColId[];
  setColOrder: Dispatch<SetStateAction<ColId[]>>;
  visibleCols: Set<ColId>;
  setVisibleCols: Dispatch<SetStateAction<Set<ColId>>>;
  colPickerOpen: boolean;
  setColPickerOpen: Dispatch<SetStateAction<boolean>>;
  colOrderSaved: boolean;
  saveColView: () => void;
  toggleCol: (id: ColId) => void;
  mergeByTicker: boolean;
  setMergeByTicker: Dispatch<SetStateAction<boolean>>;

  lastTick: Record<number, TickDirection>;
  setActionTooltip: (state: ActionTooltipState) => void;
}

export function PositionsTable({
  isMobile,
  positions,
  displayPositions,
  market,
  lastPriceT,
  quoteStatus,
  colOrder,
  setColOrder,
  visibleCols,
  setVisibleCols,
  colPickerOpen,
  setColPickerOpen,
  colOrderSaved,
  saveColView,
  toggleCol,
  mergeByTicker,
  setMergeByTicker,
  lastTick,
  setActionTooltip,
}: PositionsTableProps) {
  const dragColRef = useRef<ColId | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColId | null>(null);

  const orderedVisible = colOrder
    .map((id) => ALL_COLS.find((c) => c.id === id)!)
    .filter((c) => c && visibleCols.has(c.id));

  return (
    <div className="card" style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Текущие позиции</div>
        <div style={{ display: "flex", gap: isMobile ? 4 : 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
            background: `${market.color}18`, color: market.color, display: "flex", alignItems: "center", gap: 4,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: market.color, display: "inline-block",
              animation: market.state === "open" ? "pulse 1.5s infinite" : "none",
            }} />
            {market.label}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{market.etTime} ET</span>
          {lastPriceT > 0 && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>· {formatEtTime(lastPriceT)}</span>}
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
            background: quoteStatus === "ok" ? "rgba(34,197,94,0.12)" : quoteStatus === "error" ? "rgba(239,68,68,0.12)" : "rgba(124,58,237,0.12)",
            color: quoteStatus === "ok" ? "#22c55e" : quoteStatus === "error" ? "#ef4444" : "var(--accent-light)",
          }}>
            {quoteStatus === "ok" ? "✓" : quoteStatus === "loading" ? "…" : quoteStatus === "error" ? "✗" : "–"}
          </span>

          {!isMobile && (
            <button
              onClick={saveColView}
              title="Сохранить текущее расположение столбцов"
              style={{
                fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, cursor: "pointer",
                background: colOrderSaved ? "rgba(34,197,94,0.15)" : "var(--bg-secondary)",
                border: `1px solid ${colOrderSaved ? "#22c55e" : "var(--border)"}`,
                color: colOrderSaved ? "#22c55e" : "var(--text-secondary)",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              {colOrderSaved ? "✓ Сохранено" : "💾 Сохранить вид"}
            </button>
          )}

          <button
            onClick={() => setMergeByTicker((v) => !v)}
            title={mergeByTicker ? "Показать по брокерам" : "Объединить одинаковые тикеры"}
            style={{
              fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, cursor: "pointer",
              background: mergeByTicker ? "rgba(124,58,237,0.15)" : "var(--bg-secondary)",
              border: `1px solid ${mergeByTicker ? "var(--accent)" : "var(--border)"}`,
              color: mergeByTicker ? "var(--accent-light)" : "var(--text-secondary)",
              whiteSpace: "nowrap",
            }}
          >
            {isMobile ? "⊕" : mergeByTicker ? "⊕ Объединено" : "⊕ По брокерам"}
          </button>

          <div style={{ position: "relative" }}>
            <button
              onClick={() => setColPickerOpen((o) => !o)}
              style={{
                fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, cursor: "pointer",
                background: colPickerOpen ? "var(--accent)" : "var(--bg-secondary)",
                border: "1px solid var(--border)",
                color: colPickerOpen ? "white" : "var(--text-secondary)",
              }}
            >
              {isMobile ? "⚙" : "⚙ Столбцы"}
            </button>

            {colPickerOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200,
                background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10,
                boxShadow: "0 8px 32px rgba(0,0,0,0.4)", padding: 12, minWidth: 200,
              }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 8 }}>ОСНОВНЫЕ</div>
                {ALL_COLS.filter((c) => !c.extra).map((c) => (
                  <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer", fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={visibleCols.has(c.id)}
                      onChange={() => toggleCol(c.id)}
                      style={{ accentColor: "var(--accent)", cursor: "pointer" }}
                    />
                    <span style={{ color: visibleCols.has(c.id) ? "var(--text-primary)" : "var(--text-secondary)" }}>{c.label}</span>
                  </label>
                ))}
                <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.08em", margin: "10px 0 8px" }}>ДОПОЛНИТЕЛЬНЫЕ</div>
                {ALL_COLS.filter((c) => c.extra).map((c) => (
                  <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer", fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={visibleCols.has(c.id)}
                      onChange={() => toggleCol(c.id)}
                      style={{ accentColor: "var(--accent)", cursor: "pointer" }}
                    />
                    <span style={{ color: visibleCols.has(c.id) ? "var(--accent-light)" : "var(--text-secondary)" }}>{c.label}</span>
                  </label>
                ))}
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border)", display: "flex", gap: 6 }}>
                  <button
                    onClick={() => { setVisibleCols(DEFAULT_COLS); setColOrder(ALL_COLS.map((c) => c.id)); }}
                    style={{ flex: 1, fontSize: 10, padding: "4px", borderRadius: 5, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
                  >Сброс</button>
                  <button
                    onClick={() => setVisibleCols(new Set(ALL_COLS.map((c) => c.id)))}
                    style={{ flex: 1, fontSize: 10, padding: "4px", borderRadius: 5, border: "1px solid var(--border)", background: "transparent", color: "var(--accent-light)", cursor: "pointer" }}
                  >Все</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
              {orderedVisible.map((c) => {
                const isOver = dragOverCol === c.id;
                return (
                  <th
                    key={c.id}
                    draggable
                    onDragStart={() => { dragColRef.current = c.id; }}
                    onDragOver={(e) => { e.preventDefault(); if (dragColRef.current !== c.id) setDragOverCol(c.id); }}
                    onDragLeave={() => setDragOverCol(null)}
                    onDrop={() => {
                      const from = dragColRef.current;
                      if (!from || from === c.id) { setDragOverCol(null); return; }
                      setColOrder((prev) => {
                        const next = [...prev];
                        const fi = next.indexOf(from);
                        const ti = next.indexOf(c.id);
                        next.splice(fi, 1);
                        next.splice(ti, 0, from);
                        return next;
                      });
                      dragColRef.current = null;
                      setDragOverCol(null);
                    }}
                    onDragEnd={() => { dragColRef.current = null; setDragOverCol(null); }}
                    style={{
                      padding: "6px 8px", textAlign: "left", fontWeight: 600, fontSize: 11,
                      whiteSpace: "nowrap", cursor: "grab", userSelect: "none",
                      color: c.extra ? "var(--accent-light)" : isOver ? "var(--accent-light)" : undefined,
                      borderLeft: isOver ? "2px solid var(--accent)" : "2px solid transparent",
                      background: isOver ? "rgba(124,58,237,0.08)" : undefined,
                      transition: "background 0.15s, border-color 0.15s",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 9, opacity: 0.4, letterSpacing: "-1px" }}>⠿</span>
                      {c.label}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayPositions.map((p, i) => {
              const tick = lastTick[p.id];
              const tickBg = tick === "up" ? "rgba(34,197,94,0.15)" : tick === "down" ? "rgba(239,68,68,0.15)" : "transparent";
              const dayUsd = p.previousClose > 0 ? Math.round(p.qty * (p.currentPrice - p.previousClose)) : 0;
              const dayPct = p.previousClose > 0 ? ((p.currentPrice - p.previousClose) / p.previousClose) * 100 : 0;
              const beta = TICKER_BETA[p.ticker] ?? null;
              const stopLoss = p.avgPrice > 0 ? p.avgPrice * 0.85 : null;
              const purchaseDate = PURCHASE_DATES[p.ticker];
              const holdDays = purchaseDate ? Math.max(1, Math.round((Date.now() - new Date(purchaseDate).getTime()) / 86400000)) : 0;
              const annReturn = holdDays > 0 && p.pnlPct !== 0 ? (p.pnlPct / (holdDays / 365)) : null;

              const cell = (id: ColId): ReactNode => {
                switch (id) {
                  case "idx":          return <span style={{ color: "var(--text-secondary)" }}>{i + 1}</span>;
                  case "ticker":       return <span style={{ fontWeight: 700, color: p.color }}>{p.ticker}</span>;
                  case "name":         return <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{p.name}</span>;
                  case "qty":          return p.qty > 0 ? p.qty.toFixed(2) : "–";
                  case "avgPrice":     return p.avgPrice > 0 ? p.avgPrice.toFixed(2) : "–";
                  case "currentPrice": {
                    const fmtPrice = (v: number) =>
                      v <= 0 ? "–" : v < 0.01 ? v.toFixed(8) : v < 1 ? v.toFixed(6) : v.toFixed(2);
                    const flashCls = tick === "up" ? "price-flash-up" : tick === "down" ? "price-flash-down" : "";
                    return (
                      <span
                        className={flashCls}
                        style={{ fontWeight: 600, display: "inline-block", padding: "0 3px",
                          color: tick === "up" ? "#22c55e" : tick === "down" ? "#ef4444" : "var(--text-primary)" }}
                      >
                        {fmtPrice(p.currentPrice)}
                        {tick === "up" && <span style={{ marginLeft: 3, fontSize: 9 }}>▲</span>}
                        {tick === "down" && <span style={{ marginLeft: 3, fontSize: 9 }}>▼</span>}
                      </span>
                    );
                  }
                  case "value":        return <span style={{ fontWeight: 600 }}>{p.value.toLocaleString("en-US")}</span>;
                  case "pnl":          return <span style={{ color: p.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{p.pnl >= 0 ? "+" : ""}{p.pnl.toLocaleString("en-US")}</span>;
                  case "pnlPct":       return <span style={{ color: p.pnlPct >= 0 ? "#22c55e" : "#ef4444" }}>{p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(2)}%</span>;
                  case "share":        return `${p.share.toFixed(2)}%`;
                  case "targetShare":  return <span style={{ color: "var(--text-secondary)" }}>{p.targetShare.toFixed(2)}%</span>;
                  case "deviation": {
                    const d = p.share - p.targetShare;
                    return <span style={{ color: d >= 0 ? "#22c55e" : "#ef4444" }}>{d >= 0 ? "+" : ""}{d.toFixed(2)}%</span>;
                  }
                  case "action": {
                    const actionColor =
                      p.action === "ДОКУПИТЬ" ? "#22c55e" :
                      p.action === "СОКРАТИТЬ" ? "#ef4444" :
                      p.action === "ФИКСИРОВАТЬ" ? "#f59e0b" :
                      "var(--accent-light)";
                    return (
                      <span
                        style={{ color: actionColor, fontSize: 11, cursor: "help", textDecoration: "underline dotted", textUnderlineOffset: 3 }}
                        onMouseEnter={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          setActionTooltip({ id: p.id, x: r.left, y: r.bottom + 6 });
                        }}
                        onMouseLeave={() => setActionTooltip(null)}
                      >
                        {p.action}
                      </span>
                    );
                  }
                  case "type":         return <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "rgba(124,58,237,0.12)", color: "var(--accent-light)" }}>{p.type}</span>;
                  case "dayUsd":       return p.previousClose > 0 ? <span style={{ color: dayUsd >= 0 ? "#22c55e" : "#ef4444" }}>{dayUsd >= 0 ? "+" : ""}{dayUsd.toLocaleString("en-US")}</span> : "–";
                  case "dayPct":       return p.previousClose > 0 ? <span style={{ color: dayPct >= 0 ? "#22c55e" : "#ef4444" }}>{dayPct >= 0 ? "+" : ""}{dayPct.toFixed(2)}%</span> : "–";
                  case "beta":         return beta !== null ? <span style={{ color: beta > 1.2 ? "#ef4444" : beta < 0 ? "#3b82f6" : "var(--text-primary)" }}>{beta.toFixed(2)}</span> : "–";
                  case "stopLoss":     return stopLoss !== null ? <span style={{ color: "#ef4444" }}>{stopLoss.toFixed(2)}</span> : "–";
                  case "annReturn":    return annReturn !== null ? <span style={{ color: annReturn >= 0 ? "#22c55e" : "#ef4444" }}>{annReturn >= 0 ? "+" : ""}{annReturn.toFixed(2)}%</span> : "–";
                  case "broker":       return <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{p.broker ?? "–"}</span>;
                  default:             return null;
                }
              };

              return (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--border)", background: tickBg, transition: "background 0.6s" }}>
                  {orderedVisible.map((c) => (
                    <td key={c.id} style={{ padding: "6px 8px", borderLeft: dragOverCol === c.id ? "2px solid var(--accent)" : "2px solid transparent" }}>
                      {cell(c.id)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {(() => {
              const totalValue = positions.reduce((s, p) => s + p.value, 0);
              const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
              const totalCostAll = positions.reduce((s, p) => s + p.qty * p.avgPrice, 0);
              const totalPnlPct = totalCostAll > 0 ? (totalPnl / totalCostAll) * 100 : 0;
              const totalDayUsd = positions.reduce((s, p) => p.previousClose > 0 ? s + Math.round(p.qty * (p.currentPrice - p.previousClose)) : s, 0);
              const prevTotalVal = positions.reduce((s, p) => p.previousClose > 0 ? s + p.qty * p.previousClose : s + p.value, 0);
              const totalDayPct = prevTotalVal > 0 ? (totalDayUsd / prevTotalVal) * 100 : 0;

              const footerCell = (id: ColId): ReactNode => {
                switch (id) {
                  case "ticker":  return <span style={{ fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>ИТОГО</span>;
                  case "value":   return <span style={{ fontWeight: 700 }}>{totalValue.toLocaleString("en-US")}</span>;
                  case "pnl":     return <span style={{ fontWeight: 700, color: totalPnl >= 0 ? "#22c55e" : "#ef4444" }}>{totalPnl >= 0 ? "+" : ""}{totalPnl.toLocaleString("en-US")}</span>;
                  case "pnlPct":  return <span style={{ fontWeight: 700, color: totalPnlPct >= 0 ? "#22c55e" : "#ef4444" }}>{totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%</span>;
                  case "share":   return <span style={{ color: "var(--text-secondary)" }}>100%</span>;
                  case "dayUsd":  return <span style={{ fontWeight: 700, color: totalDayUsd >= 0 ? "#22c55e" : "#ef4444" }}>{totalDayUsd >= 0 ? "+" : ""}{totalDayUsd.toLocaleString("en-US")}</span>;
                  case "dayPct":  return <span style={{ fontWeight: 700, color: totalDayPct >= 0 ? "#22c55e" : "#ef4444" }}>{totalDayPct >= 0 ? "+" : ""}{totalDayPct.toFixed(2)}%</span>;
                  default:        return null;
                }
              };

              return (
                <tr style={{ borderTop: "2px solid var(--border)", background: "var(--bg-secondary)" }}>
                  {orderedVisible.map((c) => (
                    <td key={c.id} style={{ padding: "7px 8px" }}>{footerCell(c.id)}</td>
                  ))}
                </tr>
              );
            })()}
          </tfoot>
        </table>
      </div>
    </div>
  );
}
