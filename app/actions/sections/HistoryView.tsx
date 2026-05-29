"use client";

import type { Dispatch, SetStateAction } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { completedActions } from "@/lib/mockData";
import {
  HISTORY_PERIODS, HISTORY_TYPES, PAGE_SIZE, TYPE_BG, TYPE_COLOR,
} from "../constants";
import type { SortField } from "../types";

interface HistoryStats {
  totalOps: number;
  bought: number;
  sold: number;
  realizedPnl: number;
  totalComm: number;
  bestDeal: (typeof completedActions)[number] | undefined;
}

interface HistoryViewProps {
  filteredHistory: typeof completedActions;
  pagedHistory: typeof completedActions;
  cumulativePnl: { date: string; cum: number }[];
  stats: HistoryStats;

  histSearch: string;
  setHistSearch: Dispatch<SetStateAction<string>>;
  histType: string;
  setHistType: Dispatch<SetStateAction<string>>;
  histPeriod: string;
  setHistPeriod: Dispatch<SetStateAction<string>>;

  sortField: SortField;
  sortAsc: boolean;
  onSort: (field: SortField) => void;

  histPage: number;
  setHistPage: Dispatch<SetStateAction<number>>;
  totalPages: number;

  onExportCsv: () => void;
}

export function HistoryView({
  filteredHistory,
  pagedHistory,
  cumulativePnl,
  stats,
  histSearch,
  setHistSearch,
  histType,
  setHistType,
  histPeriod,
  setHistPeriod,
  sortField,
  sortAsc,
  onSort,
  histPage,
  setHistPage,
  totalPages,
  onExportCsv,
}: HistoryViewProps) {
  const statsCards = [
    { label: "Всего операций",    value: stats.totalOps.toString(),                                                       sub: "в истории" },
    { label: "Куплено",           value: `$${stats.bought.toLocaleString("en-US")}`,                                      sub: "суммарно вложено",  color: "#22c55e" },
    { label: "Продано",           value: `$${stats.sold.toLocaleString("en-US")}`,                                        sub: "суммарно продано",  color: "#ef4444" },
    { label: "Реализ. прибыль",   value: `${stats.realizedPnl >= 0 ? "+" : ""}$${stats.realizedPnl.toLocaleString("en-US")}`, sub: "P&L по закрытым",   color: stats.realizedPnl >= 0 ? "#22c55e" : "#ef4444" },
    { label: "Комиссии уплачено", value: `$${stats.totalComm.toFixed(2)}`,                                                sub: "брокерские расходы", color: "#f59e0b" },
    { label: "Лучшая сделка",     value: stats.bestDeal ? stats.bestDeal.ticker : "–",                                    sub: stats.bestDeal ? `+$${stats.bestDeal.pnl.toLocaleString("en-US")}` : "", color: "#22c55e" },
  ];

  const tableCols: { label: string; field: SortField | null }[] = [
    { label: "Дата",       field: "date" },
    { label: "Тип",        field: "type" },
    { label: "Тикер",      field: "ticker" },
    { label: "Инструмент", field: null },
    { label: "Кол-во",     field: "qty" },
    { label: "Цена",       field: "price" },
    { label: "Сумма",      field: "amount" },
    { label: "Комиссия",   field: "commission" },
    { label: "P&L",        field: "pnl" },
    { label: "Брокер",     field: null },
    { label: "Заметка",    field: null },
    { label: "Статус",     field: null },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
        {statsCards.map((m) => (
          <div key={m.label} className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 3 }}>{m.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: m.color ?? "var(--text-primary)" }}>{m.value}</div>
            <div style={{ fontSize: 11, color: m.color ?? "var(--text-secondary)" }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div className="card-title" style={{ margin: 0 }}>Накопленная реализованная прибыль</div>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#22c55e" }}>
            +${stats.realizedPnl.toLocaleString("en-US")}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={110}>
          <AreaChart data={cumulativePnl} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradPnl" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#555577" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: "#555577" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} width={40} />
            <Tooltip
              contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }}
              formatter={(v) => [`$${Number(v).toLocaleString("en-US")}`, "Накопл. P&L"]}
            />
            <Area type="monotone" dataKey="cum" stroke="#22c55e" strokeWidth={2} fill="url(#gradPnl)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="card" style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={histSearch}
            onChange={(e) => { setHistSearch(e.target.value); setHistPage(1); }}
            placeholder="Поиск по тикеру или названию…"
            style={{
              padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12, width: 220,
            }}
          />
          <div style={{ display: "flex", gap: 5 }}>
            {HISTORY_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => { setHistType(t); setHistPage(1); }}
                style={{
                  padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
                  background: histType === t ? (TYPE_COLOR[t] ?? "var(--accent)") : "var(--bg-secondary)",
                  color: histType === t ? "white" : "var(--text-secondary)",
                }}
              >{t}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
            {HISTORY_PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => { setHistPeriod(p); setHistPage(1); }}
                style={{
                  padding: "6px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
                  background: histPeriod === p ? "var(--accent)" : "var(--bg-secondary)",
                  color: histPeriod === p ? "white" : "var(--text-secondary)",
                }}
              >{p}</button>
            ))}
          </div>
          <button
            onClick={onExportCsv}
            style={{
              padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer",
              fontSize: 11, fontWeight: 600, background: "transparent", color: "var(--text-secondary)",
            }}
          >↓ CSV</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                {tableCols.map(({ label, field }) => (
                  <th
                    key={label}
                    onClick={() => field && onSort(field)}
                    style={{
                      padding: "8px 10px", textAlign: "left", fontWeight: 600, fontSize: 11,
                      whiteSpace: "nowrap", cursor: field ? "pointer" : "default", userSelect: "none",
                    }}
                  >
                    {label}
                    {field && sortField === field && (
                      <span style={{ marginLeft: 3, fontSize: 9 }}>{sortAsc ? "▲" : "▼"}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedHistory.map((a) => (
                <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 10px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {a.date}<br /><span style={{ fontSize: 10, color: "var(--text-muted)" }}>{a.time}</span>
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{
                      padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                      background: TYPE_BG[a.type] ?? "var(--bg-secondary)",
                      color: TYPE_COLOR[a.type] ?? "var(--text-primary)",
                    }}>{a.type}</span>
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%", background: a.color,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 7, fontWeight: 700, color: "white", flexShrink: 0,
                      }}>
                        {a.ticker.slice(0, 2)}
                      </div>
                      <span style={{ fontWeight: 700 }}>{a.ticker}</span>
                    </div>
                  </td>
                  <td style={{
                    padding: "8px 10px", color: "var(--text-secondary)", fontSize: 11,
                    maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{a.name}</td>
                  <td style={{ padding: "8px 10px" }}>{a.qty > 0 ? a.qty : "—"}</td>
                  <td style={{ padding: "8px 10px" }}>{a.price > 0 ? `$${a.price.toLocaleString("en-US")}` : "—"}</td>
                  <td style={{
                    padding: "8px 10px", fontWeight: 600,
                    color: a.type === "Покупка" ? "#ef4444" : "#22c55e",
                  }}>
                    {a.type === "Покупка" ? "-" : a.type === "Продажа" || a.type === "Дивиденды" ? "+" : ""}
                    {a.amount > 0 ? `$${a.amount.toLocaleString("en-US")}` : "—"}
                  </td>
                  <td style={{ padding: "8px 10px", color: "var(--text-secondary)" }}>
                    {a.commission > 0 ? `$${a.commission.toFixed(2)}` : "—"}
                  </td>
                  <td style={{
                    padding: "8px 10px", fontWeight: 600,
                    color: a.pnl > 0 ? "#22c55e" : a.pnl < 0 ? "#ef4444" : "var(--text-secondary)",
                  }}>
                    {a.pnl > 0 ? "+" : ""}{a.pnl !== 0 ? `$${a.pnl.toLocaleString("en-US")}` : "—"}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 20, fontSize: 10,
                      background: "rgba(34,197,94,0.12)", color: "#22c55e", fontWeight: 600,
                    }}>{a.broker}</span>
                  </td>
                  <td style={{
                    padding: "8px 10px", color: "var(--text-secondary)", fontSize: 11,
                    maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {a.note || "—"}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 20, fontSize: 10,
                      background: "rgba(34,197,94,0.12)", color: "#22c55e", fontWeight: 600,
                    }}>{a.status}</span>
                  </td>
                </tr>
              ))}
              {pagedHistory.length === 0 && (
                <tr>
                  <td colSpan={12} style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
                    Нет операций по заданным фильтрам
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 12,
          }}>
            <span style={{ color: "var(--text-secondary)" }}>
              {filteredHistory.length} операций · страница {histPage} из {totalPages}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={() => setHistPage(Math.max(1, histPage - 1))}
                disabled={histPage === 1}
                style={{
                  padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)",
                  background: "transparent", color: "var(--text-secondary)",
                  cursor: histPage === 1 ? "default" : "pointer", opacity: histPage === 1 ? 0.4 : 1,
                }}
              >←</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setHistPage(p)}
                  style={{
                    padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontWeight: p === histPage ? 700 : 400,
                    background: p === histPage ? "var(--accent)" : "transparent",
                    color: p === histPage ? "white" : "var(--text-secondary)",
                  }}
                >{p}</button>
              ))}
              <button
                onClick={() => setHistPage(Math.min(totalPages, histPage + 1))}
                disabled={histPage === totalPages}
                style={{
                  padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)",
                  background: "transparent", color: "var(--text-secondary)",
                  cursor: histPage === totalPages ? "default" : "pointer", opacity: histPage === totalPages ? 0.4 : 1,
                }}
              >→</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export PAGE_SIZE so page.tsx can use the same value
export { PAGE_SIZE };
