"use client";

import { Tooltip as UITooltip } from "@/components/ui/Tooltip";
import { formatEtTime, type MarketStatus } from "@/lib/marketStatus";
import { brokerColor } from "../utils";
import type { Position } from "../types";

type TickDirection = "up" | "down" | null;
type QuoteStatus = "idle" | "loading" | "ok" | "error";

interface PositionsTableProps {
  // Data
  positions: Position[];
  sorted: Position[];
  filteredCount: number;
  total: number;
  totalPnl: number;
  totalPnlPct: number;

  // Market header
  market: MarketStatus;
  lastPriceT: number;
  quoteStatus: QuoteStatus;

  // Sort
  sortKey: keyof Position | "";
  sortDir: "asc" | "desc";
  onSort: (key: keyof Position) => void;

  // Live price flash
  lastTick: Record<number, TickDirection>;
  priceColor: (id: number) => string;

  // Inline name editing
  editingNameId: number | null;
  editingNameValue: string;
  onStartEditName: (id: number, name: string) => void;
  onChangeEditName: (value: string) => void;
  onCommitEditName: (id: number) => void;
  onCancelEditName: () => void;

  // Row actions
  onOpenEdit: (p: Position) => void;
  onAskDelete: (p: Position) => void;
  onAskTakeProfit: (p: Position) => void;
}

const HEADER_COLUMNS: { label: string; key: keyof Position | "" }[] = [
  { label: "#",                key: "" },
  { label: "Тикер",            key: "ticker" },
  { label: "Инструмент",       key: "name" },
  { label: "Тип",              key: "type" },
  { label: "Дата покупки",     key: "purchaseDate" },
  { label: "Кол-во",           key: "qty" },
  { label: "Ср.цена",          key: "avgPrice" },
  { label: "Тек.цена",         key: "currentPrice" },
  { label: "Стоимость",        key: "value" },
  { label: "Прибыль / Убыток", key: "pnl" },
  { label: "Доля",             key: "share" },
  { label: "",                 key: "" },
];

function ApiStatusBadge({ status }: { status: QuoteStatus }) {
  const cfg = {
    ok:      { label: "Finnhub ✓",   bg: "rgba(34,197,94,0.12)",  color: "#22c55e" },
    loading: { label: "Обновление…",  bg: "rgba(148,163,184,0.12)", color: "#94a3b8" },
    error:   { label: "Ошибка API",   bg: "rgba(239,68,68,0.12)",  color: "#ef4444" },
    idle:    { label: "Finnhub",      bg: "rgba(148,163,184,0.12)", color: "#94a3b8" },
  }[status];
  return (
    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, fontWeight: 600, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

export function PositionsTable({
  positions,
  sorted,
  filteredCount,
  total,
  totalPnl,
  totalPnlPct,
  market,
  lastPriceT,
  quoteStatus,
  sortKey,
  sortDir,
  onSort,
  lastTick,
  priceColor,
  editingNameId,
  editingNameValue,
  onStartEditName,
  onChangeEditName,
  onCommitEditName,
  onCancelEditName,
  onOpenEdit,
  onAskDelete,
  onAskTakeProfit,
}: PositionsTableProps) {
  return (
    <div className="card" style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 6 }}>
        <div className="card-title">Текущие позиции</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
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
          <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>{market.etTime} ET</span>
          <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>· {market.localTime} Местное</span>
          {market.nextLabel && market.state !== "open" && (
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500 }}>· {market.nextLabel}</span>
          )}
          {lastPriceT > 0 && (
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>· цены {formatEtTime(lastPriceT)}</span>
          )}
          <ApiStatusBadge status={quoteStatus} />
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
              {HEADER_COLUMNS.map((h, i) => (
                <th
                  key={`${h.label}-${i}`}
                  onClick={h.key ? () => onSort(h.key as keyof Position) : undefined}
                  style={{
                    padding: "6px 8px", textAlign: "left", fontWeight: 600, fontSize: 11, whiteSpace: "nowrap",
                    cursor: h.key ? "pointer" : "default", userSelect: "none",
                    color: sortKey === h.key ? "var(--accent-light)" : "var(--text-secondary)",
                  }}
                >
                  {h.label}
                  {h.key && (
                    <span style={{ marginLeft: 3, fontSize: 9, opacity: sortKey === h.key ? 1 : 0.3 }}>
                      {sortKey === h.key ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.3s" }}>
                <td style={{ padding: "7px 8px", color: "var(--text-secondary)" }}>{i + 1}</td>
                <td style={{ padding: "7px 8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: p.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "white", flexShrink: 0 }}>
                      {p.ticker.slice(0, 2)}
                    </div>
                    <span style={{ fontWeight: 700 }}>{p.ticker}</span>
                  </div>
                </td>
                <td
                  style={{ padding: "7px 8px", fontSize: 11, maxWidth: 160 }}
                  title="Двойной клик — переименовать"
                  onDoubleClick={() => onStartEditName(p.id, p.name)}
                >
                  {editingNameId === p.id ? (
                    <input
                      autoFocus
                      value={editingNameValue}
                      onChange={(e) => onChangeEditName(e.target.value)}
                      onBlur={() => onCommitEditName(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onCommitEditName(p.id);
                        if (e.key === "Escape") onCancelEditName();
                      }}
                      style={{ width: "100%", padding: "2px 6px", borderRadius: 5, border: "1px solid var(--accent)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 11, outline: "none" }}
                    />
                  ) : (
                    <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", cursor: "text" }}>
                      {p.name}
                    </span>
                  )}
                </td>
                <td style={{ padding: "7px 8px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span className="badge badge-purple">{p.type}</span>
                    {p.broker && (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 4, background: `${brokerColor(p.broker)}22`, color: brokerColor(p.broker), whiteSpace: "nowrap" }}>{p.broker}</span>
                    )}
                  </div>
                </td>
                <td style={{ padding: "7px 8px", color: "var(--text-secondary)", fontSize: 11, whiteSpace: "nowrap" }}>
                  {p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–"}
                </td>
                <td style={{ padding: "7px 8px" }}>{p.qty > 0 ? p.qty.toFixed(2) : "–"}</td>
                <td style={{ padding: "7px 8px" }}>{p.avgPrice > 0 ? p.avgPrice.toFixed(2) : "–"}</td>
                <td style={{ padding: "7px 8px", fontWeight: 700, color: priceColor(p.id), transition: "color 0.5s" }}>
                  {p.currentPrice > 0 ? p.currentPrice.toFixed(2) : "–"}
                  {p.live && lastTick[p.id] === "up" && <span style={{ fontSize: 9, marginLeft: 2 }}>▲</span>}
                  {p.live && lastTick[p.id] === "down" && <span style={{ fontSize: 9, marginLeft: 2 }}>▼</span>}
                </td>
                <td style={{ padding: "7px 8px", fontWeight: 700 }}>{p.value.toLocaleString("en-US")}</td>
                <td style={{ padding: "6px 8px" }}>
                  {p.pnl === 0 ? (
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                  ) : (() => {
                    const isPos = p.pnl > 0;
                    const color = isPos ? "#22c55e" : "#ef4444";
                    const bg = isPos ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)";
                    const border = isPos ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)";
                    return (
                      <div style={{
                        display: "inline-flex", flexDirection: "column",
                        background: bg, border: `1px solid ${border}`,
                        borderRadius: 8, padding: "4px 9px", minWidth: 90,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 11, color, fontWeight: 700 }}>{isPos ? "▲" : "▼"}</span>
                          <span style={{ fontSize: 12, color, fontWeight: 700 }}>
                            {isPos ? "+" : ""}{Math.round(p.pnl).toLocaleString("en-US")} $
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color, opacity: 0.85, paddingLeft: 14 }}>
                          {isPos ? "+" : ""}{p.pnlPct.toFixed(2)}%
                        </div>
                      </div>
                    );
                  })()}
                </td>
                <td style={{ padding: "7px 8px" }}>{p.share.toFixed(2)}%</td>
                <td style={{ padding: "7px 8px" }}>
                  <div style={{ display: "flex", gap: 2 }}>
                    {p.type !== "Кэш" && (
                      <button
                        onClick={() => onAskTakeProfit(p)}
                        title="Зафиксировать позицию"
                        style={{
                          background: p.pnl >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.10)",
                          border: p.pnl >= 0 ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(239,68,68,0.3)",
                          cursor: "pointer", color: p.pnl >= 0 ? "#22c55e" : "#ef4444",
                          fontSize: 10, padding: "2px 6px",
                          borderRadius: 5, fontWeight: 700, whiteSpace: "nowrap",
                        }}
                      >💰</button>
                    )}
                    <UITooltip content="Редактировать позицию" side="top">
                      <button onClick={() => onOpenEdit(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-light)", fontSize: 13, padding: "2px 5px", borderRadius: 4, opacity: 0.7 }}>✎</button>
                    </UITooltip>
                    <UITooltip content="Удалить позицию" side="top">
                      <button onClick={() => onAskDelete(p)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 14, padding: "2px 5px", borderRadius: 4, opacity: 0.6 }}>✕</button>
                    </UITooltip>
                  </div>
                </td>
              </tr>
            ))}
            {filteredCount === 0 && (
              <tr><td colSpan={13} style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}>Нет позиций в этой категории</td></tr>
            )}
            <tr style={{ fontWeight: 700, background: "var(--bg-secondary)" }}>
              <td colSpan={8} style={{ padding: "8px", color: "var(--text-secondary)", fontSize: 12 }}>ИТОГО</td>
              <td style={{ padding: "8px" }}>{Math.round(total).toLocaleString("en-US")}</td>
              <td style={{ padding: "8px", color: totalPnl >= 0 ? "#22c55e" : "#ef4444" }}>
                {totalPnl >= 0 ? "+" : ""}{totalPnl.toLocaleString("en-US")}
              </td>
              <td style={{ padding: "8px", color: totalPnlPct >= 0 ? "#22c55e" : "#ef4444" }}>
                {totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%
              </td>
              <td style={{ padding: "8px" }}>100.00%</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
