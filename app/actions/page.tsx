"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area,
} from "recharts";
import { actionItems, completedActions } from "@/lib/mockData";
import { useApp } from "@/lib/AppContext";

const tabs = ["ВСЕ ДЕЙСТВИЯ", "ПРИОРИТЕТНЫЕ", "ЗАПЛАНИРОВАННЫЕ", "ИСТОРИЯ"];

const priorityColor: Record<string, string> = {
  "Высокий": "#ef4444",
  "Средний": "#f59e0b",
  "Низкий": "#94a3b8",
  "Критический": "#7c3aed",
};
const priorityBg: Record<string, string> = {
  "Высокий": "rgba(239,68,68,0.12)",
  "Средний": "rgba(245,158,11,0.12)",
  "Низкий": "rgba(148,163,184,0.12)",
  "Критический": "rgba(124,58,237,0.12)",
};

const TYPE_COLOR: Record<string, string> = {
  "Покупка":       "#22c55e",
  "Продажа":       "#ef4444",
  "Дивиденды":     "#f59e0b",
  "Ребалансировка":"#7c3aed",
};
const TYPE_BG: Record<string, string> = {
  "Покупка":       "rgba(34,197,94,0.12)",
  "Продажа":       "rgba(239,68,68,0.12)",
  "Дивиденды":     "rgba(245,158,11,0.12)",
  "Ребалансировка":"rgba(124,58,237,0.12)",
};
const SORT_FIELDS = ["date","type","ticker","qty","price","amount","commission","pnl"] as const;
type SortField = typeof SORT_FIELDS[number];

const LS_TARGET = "target-structure";

type TargetRow = { ticker: string; target: number };

function loadTargetStructure(): TargetRow[] {
  try {
    const raw = localStorage.getItem(LS_TARGET);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveTargetStructure(rows: TargetRow[]) {
  try { localStorage.setItem(LS_TARGET, JSON.stringify(rows)); } catch {}
}

function buildActionList(
  positions: ReturnType<typeof useApp>["positions"],
  liveQuotes: ReturnType<typeof useApp>["liveQuotes"],
  portfolioTotal: number,
  structure: TargetRow[],
  fallback: typeof actionItems,
): typeof actionItems {
  if (!positions.length || !portfolioTotal) return fallback;
  const generated = structure
    .map(t => {
      const isCash = t.ticker === "КЭШ(USD)";
      const pos = isCash
        ? positions.find(p => p.type === "Кэш")
        : positions.find(p => p.ticker === t.ticker);
      const liveShare = pos ? (pos.qty * (liveQuotes[pos.ticker]?.current || pos.avgPrice) / portfolioTotal) * 100 : 0;
      const dev = parseFloat((liveShare - t.target).toFixed(2));
      if (Math.abs(dev) < 1) return null;
      const displayTicker = isCash ? "КЭШ" : t.ticker;
      return {
        id: t.ticker.charCodeAt(0) * 31 + (t.ticker.charCodeAt(1) || 0),
        ticker: displayTicker,
        action: dev > 0 ? `Фиксировать прибыль ${displayTicker}` : `Докупить ${displayTicker}`,
        amount: Math.round(Math.abs(dev / 100) * portfolioTotal),
        qty: 0,
        priority: Math.abs(dev) > 5 ? "Высокий" : "Средний",
        reason: `Отклонение от цели ${dev > 0 ? "+" : ""}${dev.toFixed(2)}%. Целевая доля: ${t.target}%, текущая: ${liveShare.toFixed(2)}%.`,
        status: "Ожидание",
        deadline: "",
        color: dev > 0 ? "#ef4444" : "#7c3aed",
      };
    })
    .filter(Boolean) as typeof actionItems;
  return generated.length > 0 ? generated : fallback;
}

export default function ActionsPage() {
  const app = useApp();
  const [activeTab, setActiveTab] = useState("ВСЕ ДЕЙСТВИЯ");
  const [stagedActionList, setStagedActionList] = useState<typeof actionItems>([]);
  const [executed, setExecuted] = useState<number[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const initialized = useRef(false);

  // Target structure (persisted in localStorage)
  const [targetRows, setTargetRows] = useState<TargetRow[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editRows, setEditRows] = useState<TargetRow[]>([]);

  useEffect(() => {
    const rows = loadTargetStructure();
    setTargetRows(rows);
  }, []);

  // Build action list once when live data is ready; never auto-regenerate
  useEffect(() => {
    if (initialized.current) return;
    if (!app.portfolioTotal || !app.positions.length || !targetRows.length) return;
    setStagedActionList(buildActionList(app.positions, app.liveQuotes, app.portfolioTotal, targetRows, actionItems));
    initialized.current = true;
  }, [app.portfolioTotal, app.positions, app.liveQuotes, targetRows]);

  function refreshActionList(rows?: TargetRow[]) {
    const structure = rows ?? targetRows;
    initialized.current = false;
    setExecuted([]);
    setDismissed([]);
    setStagedActionList(buildActionList(app.positions, app.liveQuotes, app.portfolioTotal, structure, actionItems));
    initialized.current = true;
  }

  function openEditor() {
    setEditRows(targetRows.map(r => ({ ...r })));
    setEditOpen(true);
  }

  function saveEditor() {
    const cleaned = editRows.filter(r => r.ticker.trim() !== "");
    saveTargetStructure(cleaned);
    setTargetRows(cleaned);
    setEditOpen(false);
    refreshActionList(cleaned);
  }

  function addEditRow() {
    setEditRows(prev => [...prev, { ticker: "", target: 0 }]);
  }

  function removeEditRow(i: number) {
    setEditRows(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateEditRow(i: number, field: keyof TargetRow, value: string) {
    setEditRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: field === "target" ? parseFloat(value) || 0 : value } : r));
  }

  // History filters
  const [histSearch, setHistSearch]     = useState("");
  const [histType, setHistType]         = useState("Все");
  const [histPeriod, setHistPeriod]     = useState("Всё");
  const [sortField, setSortField]       = useState<SortField>("date");
  const [sortAsc, setSortAsc]           = useState(false);
  const [histPage, setHistPage]         = useState(1);
  const PAGE_SIZE = 10;

  function executeAction(id: number) {
    const a = stagedActionList.find(item => item.id === id);
    if (a) {
      const isBuy = a.action.startsWith("Докупить");
      const ticker = a.ticker === "КЭШ" ? null : a.ticker;
      if (ticker && a.amount > 0) {
        try {
          const stored = localStorage.getItem("positions-data");
          const positions: any[] = stored ? JSON.parse(stored) : [];
          const idx = positions.findIndex((p: any) => p.ticker === ticker);
          if (idx >= 0) {
            const currentPrice = app.liveQuotes[ticker]?.current || positions[idx].avgPrice || 1;
            const qtyChange = a.amount / currentPrice;
            if (isBuy) {
              const oldTotal = positions[idx].qty * positions[idx].avgPrice;
              const newQty = positions[idx].qty + qtyChange;
              positions[idx].avgPrice = (oldTotal + a.amount) / newQty;
              positions[idx].qty = newQty;
            } else {
              positions[idx].qty = Math.max(0, positions[idx].qty - qtyChange);
            }
            localStorage.setItem("positions-data", JSON.stringify(positions));
            window.dispatchEvent(new CustomEvent("positions-updated"));
          }
        } catch {}
      }
    }
    setExecuted((prev) => [...prev, id]);
  }
  function dismissAction(id: number) {
    setDismissed((prev) => [...prev, id]);
  }

  const liveActionList = stagedActionList;

  // Keep executed cards visible (showing ✓) but separate from pending counts
  const visibleActions = liveActionList.filter((a) => {
    if (dismissed.includes(a.id)) return false;
    if (activeTab === "ПРИОРИТЕТНЫЕ") return (a.priority === "Высокий" || a.priority === "Критический") && !executed.includes(a.id);
    if (activeTab === "ЗАПЛАНИРОВАННЫЕ") return a.status === "Запланировано" && !executed.includes(a.id);
    if (activeTab === "ИСТОРИЯ") return false;
    return true;
  });

  const highCount    = liveActionList.filter((a) => !executed.includes(a.id) && (a.priority === "Высокий" || a.priority === "Критический")).length;
  const pendingCount = visibleActions.filter((a) => !executed.includes(a.id)).length;
  const doneCount    = executed.length + completedActions.length;

  const liveDeviationData = (() => {
    if (!app.portfolioTotal || !app.positions.length) return [];
    const nonCash = app.positions.filter(p => p.type !== "Кэш");
    const eqTarget = nonCash.length > 0 ? 100 / app.positions.length : 0;
    return app.positions.map(p => {
      const val = p.qty * (app.liveQuotes[p.ticker]?.current || p.avgPrice);
      const liveShare = (val / app.portfolioTotal) * 100;
      // Use saved target if available, else equal-weight; cash positions target = their live share (no deviation)
      const savedTarget = targetRows.find(r => r.ticker === p.ticker || (r.ticker === "КЭШ(USD)" && p.type === "Кэш"));
      const target = savedTarget ? savedTarget.target : (p.type === "Кэш" ? liveShare : eqTarget);
      return { ticker: p.ticker, deviation: parseFloat((liveShare - target).toFixed(2)) };
    });
  })();

  const maxDeviation = liveDeviationData.length > 0 ? Math.max(...liveDeviationData.map(d => Math.abs(d.deviation))) : 0;

  const liveRecommendations = useMemo(() => {
    if (!app.positions.length) return [];
    const recs: { action: string; reason: string; priority: string }[] = [];
    const assetTypes = new Set(app.positions.filter(p => p.type !== "Кэш").map(p => p.type));
    if (assetTypes.size < 3) {
      recs.push({ action: "Диверсифицировать портфель", reason: `Только ${assetTypes.size} класс(а) активов — добавьте ETF, облигации или другие инструменты`, priority: "Средний" });
    }
    app.positions.forEach(p => {
      const price = app.liveQuotes[p.ticker]?.current || p.avgPrice;
      const pnlPct = ((price - p.avgPrice) / p.avgPrice) * 100;
      if (pnlPct < -15) {
        recs.push({ action: `Пересмотреть позицию ${p.ticker}`, reason: `Просадка ${pnlPct.toFixed(1)}% — оцените целесообразность удержания`, priority: "Высокий" });
      } else if (pnlPct > 25) {
        recs.push({ action: `Зафиксировать часть прибыли ${p.ticker}`, reason: `Рост +${pnlPct.toFixed(1)}% — рассмотрите частичную продажу`, priority: "Средний" });
      }
    });
    liveDeviationData.filter(d => Math.abs(d.deviation) > 5).forEach(d => {
      recs.push({
        action: d.deviation > 0 ? `Сократить ${d.ticker}` : `Докупить ${d.ticker}`,
        reason: `Отклонение от целевой доли ${d.deviation > 0 ? "+" : ""}${d.deviation.toFixed(1)}%`,
        priority: Math.abs(d.deviation) > 10 ? "Высокий" : "Средний",
      });
    });
    return recs.slice(0, 5);
  }, [app.positions, app.liveQuotes, liveDeviationData]);

  // ── History logic ──────────────────────────────────────────────────────────
  const parseDMY = (s: string) => {
    const [d, m, y] = s.split(".");
    return new Date(`${y}-${m}-${d}`).getTime();
  };

  const filteredHistory = useMemo(() => {
    const now = new Date("2024-05-21").getTime();
    const periodMs: Record<string, number> = {
      "1М": 30, "3М": 90, "6М": 180, "1Г": 365, "Всё": 99999,
    };
    const days = periodMs[histPeriod] ?? 99999;
    const cutoff = now - days * 86400000;

    return [...completedActions]
      .filter((a) => {
        if (histType !== "Все" && a.type !== histType) return false;
        if (histSearch && !a.ticker.toLowerCase().includes(histSearch.toLowerCase()) &&
            !a.name.toLowerCase().includes(histSearch.toLowerCase())) return false;
        if (parseDMY(a.date) < cutoff) return false;
        return true;
      })
      .sort((a, b) => {
        let va: any, vb: any;
        if (sortField === "date")       { va = parseDMY(a.date); vb = parseDMY(b.date); }
        else if (sortField === "type")  { va = a.type;     vb = b.type; }
        else if (sortField === "ticker"){ va = a.ticker;   vb = b.ticker; }
        else                            { va = (a as any)[sortField] ?? 0; vb = (b as any)[sortField] ?? 0; }
        if (va < vb) return sortAsc ? -1 : 1;
        if (va > vb) return sortAsc ?  1 : -1;
        return 0;
      });
  }, [histSearch, histType, histPeriod, sortField, sortAsc]);

  const totalPages    = Math.ceil(filteredHistory.length / PAGE_SIZE);
  const pagedHistory  = filteredHistory.slice((histPage - 1) * PAGE_SIZE, histPage * PAGE_SIZE);

  // Summary stats
  const histStats = useMemo(() => {
    const all = completedActions;
    const totalOps    = all.length;
    const bought      = all.filter(a => a.type === "Покупка").reduce((s, a) => s + a.amount, 0);
    const sold        = all.filter(a => a.type === "Продажа").reduce((s, a) => s + a.amount, 0);
    const realizedPnl = all.reduce((s, a) => s + (a.pnl ?? 0), 0);
    const totalComm   = all.reduce((s, a) => s + (a.commission ?? 0), 0);
    const bestDeal    = all.filter(a => a.pnl > 0).sort((a, b) => b.pnl - a.pnl)[0];
    return { totalOps, bought, sold, realizedPnl, totalComm, bestDeal };
  }, []);

  // Cumulative P&L chart data (chronological)
  const cumulativePnl = useMemo(() => {
    const sorted = [...completedActions].sort((a, b) => parseDMY(a.date) - parseDMY(b.date));
    let cum = 0;
    return sorted.map((a) => {
      cum += a.pnl ?? 0;
      return { date: a.date.slice(0, 5), cum };
    });
  }, []);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
    setHistPage(1);
  }

  function exportHistory() {
    const csv = [
      ["Дата","Время","Тип","Тикер","Инструмент","Кол-во","Цена","Сумма","Комиссия","P&L","Брокер","Заметка"],
      ...filteredHistory.map(a => [a.date,a.time,a.type,a.ticker,a.name,a.qty,a.price,a.amount,a.commission,a.pnl,a.broker,a.note]),
    ].map(r => r.join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const el   = document.createElement("a");
    el.href = url; el.download = `history_${Date.now()}.csv`; el.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader title="ДЕЙСТВИЯ" subtitle="Рекомендуемые торговые операции и план ребалансировки" showSnapshot />

      <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { label: "Всего действий", value: pendingCount, sub: "требует внимания" },
            { label: "Высокий приоритет", value: highCount, sub: "срочно", color: "#ef4444" },
            { label: "Выполнено (всего)", value: doneCount, sub: "операций", color: "#22c55e" },
            { label: "Отклонение портфеля", value: `${maxDeviation.toFixed(2)}%`, sub: "от целей", color: "#f59e0b" },
          ].map((m) => (
            <div key={m.label} className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: m.color ?? "var(--text-primary)" }}>{m.value}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Tabs + refresh */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: activeTab === t ? "var(--accent)" : "var(--bg-card)",
                color: activeTab === t ? "white" : "var(--text-secondary)",
                transition: "all 0.15s",
              }}
            >
              {t}
            </button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              onClick={openEditor}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "1px solid var(--accent)",
                cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: "rgba(124,58,237,0.1)", color: "var(--accent)",
              }}
            >
              ✎ Редактировать инструменты
            </button>
            <button
              onClick={() => refreshActionList()}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)",
                cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: "transparent", color: "var(--text-secondary)",
              }}
            >
              ↻ Обновить список
            </button>
          </div>
        </div>

        {/* Edit instruments modal */}
        {editOpen && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
          }} onClick={(e) => { if (e.target === e.currentTarget) setEditOpen(false); }}>
            <div style={{
              background: "var(--bg-card)", borderRadius: 16, padding: 28, width: 520,
              maxHeight: "80vh", display: "flex", flexDirection: "column", gap: 16,
              border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Редактировать инструменты</div>
                <button onClick={() => setEditOpen(false)} style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>

              {/* Total indicator */}
              {(() => {
                const total = editRows.reduce((s, r) => s + r.target, 0);
                const ok = Math.abs(total - 100) < 0.01;
                return (
                  <div style={{ fontSize: 12, color: ok ? "#22c55e" : "#f59e0b", fontWeight: 600 }}>
                    Сумма целей: {total.toFixed(2)}% {ok ? "✓" : `(должно быть 100%)`}
                  </div>
                );
              })()}

              {/* Table */}
              <div style={{ overflowY: "auto", flex: 1 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600 }}>Тикер</th>
                      <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>Целевая доля, %</th>
                      <th style={{ width: 36 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editRows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            value={row.ticker}
                            onChange={e => updateEditRow(i, "ticker", e.target.value)}
                            placeholder="TICKER"
                            style={{
                              width: "100%", padding: "5px 8px", borderRadius: 6,
                              border: "1px solid var(--border)", background: "var(--bg-secondary)",
                              color: "var(--text-primary)", fontSize: 13, fontWeight: 600,
                            }}
                          />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={row.target}
                            onChange={e => updateEditRow(i, "target", e.target.value)}
                            style={{
                              width: "100%", padding: "5px 8px", borderRadius: 6, textAlign: "right",
                              border: "1px solid var(--border)", background: "var(--bg-secondary)",
                              color: "var(--text-primary)", fontSize: 13,
                            }}
                          />
                        </td>
                        <td style={{ padding: "6px 4px", textAlign: "center" }}>
                          <button
                            onClick={() => removeEditRow(i)}
                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
                          >✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  onClick={addEditRow}
                  style={{
                    padding: "7px 14px", borderRadius: 8, border: "1px dashed var(--border)",
                    background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12,
                  }}
                >
                  + Добавить инструмент
                </button>
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => setEditOpen(false)}
                  style={{
                    padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)",
                    background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13,
                  }}
                >
                  Отмена
                </button>
                <button
                  onClick={saveEditor}
                  style={{
                    padding: "8px 22px", borderRadius: 8, border: "none",
                    background: "var(--accent)", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700,
                  }}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab !== "ИСТОРИЯ" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }}>
            {/* Action cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visibleActions.map((a) => (
                <div key={a.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: a.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "white", flexShrink: 0 }}>
                        {a.ticker.slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{a.action}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{a.ticker} · Срок: {a.deadline}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: priorityBg[a.priority], color: priorityColor[a.priority],
                      }}>{a.priority}</span>
                      <span style={{
                        padding: "2px 8px", borderRadius: 20, fontSize: 10,
                        background: "var(--bg-secondary)", color: "var(--text-secondary)",
                      }}>{a.status}</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{a.reason}</div>

                  {(a.amount > 0 || a.qty > 0) && (
                    <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                      {a.amount > 0 && (
                        <div>
                          <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>Сумма</div>
                          <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>${a.amount.toLocaleString("en-US")}</div>
                        </div>
                      )}
                      {a.qty > 0 && (
                        <div>
                          <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>Количество</div>
                          <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{Number(a.qty).toFixed(2)} шт.</div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    {executed.includes(a.id) ? (
                      <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>✓ Выполнено</div>
                    ) : (
                      <>
                        <button
                          onClick={() => executeAction(a.id)}
                          style={{
                            padding: "6px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                            background: "var(--accent)", color: "white",
                          }}
                        >
                          Выполнить
                        </button>
                        <button
                          onClick={() => dismissAction(a.id)}
                          style={{
                            padding: "6px 18px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", fontSize: 12, fontWeight: 600,
                            background: "transparent", color: "var(--text-secondary)",
                          }}
                        >
                          Отложить
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {visibleActions.length === 0 && (
                <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
                  Нет действий в этой категории
                </div>
              )}
            </div>

            {/* Right panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Deviation chart */}
              <div className="card">
                <div className="card-title">Отклонение от цели</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={liveDeviationData} layout="vertical" barSize={10}>
                    <XAxis type="number" tick={{ fontSize: 9, fill: "#555577" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="ticker" tick={{ fontSize: 9, fill: "#aaaacc" }} tickLine={false} axisLine={false} width={45} />
                    <Tooltip
                      contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }}
                      formatter={(v: any) => [`${v > 0 ? "+" : ""}${v.toFixed(2)}%`, "Отклонение"]}
                    />
                    <Bar dataKey="deviation" radius={[0, 4, 4, 0]}>
                      {liveDeviationData.map((d, i) => (
                        <Cell key={i} fill={d.deviation >= 0 ? "#ef4444" : "#22c55e"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Recommended quick actions */}
              <div className="card">
                <div className="card-title">AI-рекомендации</div>
                {liveRecommendations.length === 0 ? (
                  <div style={{ color: "var(--text-muted)", fontSize: 12, padding: "8px 0" }}>
                    {app.positions.length === 0 ? "Добавьте позиции для получения рекомендаций" : "Портфель в хорошем состоянии — отклонений нет"}
                  </div>
                ) : liveRecommendations.map((r, i) => (
                  <div key={i} style={{ borderBottom: "1px solid var(--border)", padding: "10px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>{r.action}</div>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{r.reason}</div>
                    </div>
                    <span style={{
                      padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600, flexShrink: 0,
                      color: priorityColor[r.priority], background: priorityBg[r.priority],
                    }}>{r.priority}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── ИСТОРИЯ ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
              {[
                { label: "Всего операций",    value: histStats.totalOps.toString(),                                    sub: "в истории" },
                { label: "Куплено",           value: `$${histStats.bought.toLocaleString("en-US")}`,                  sub: "суммарно вложено",  color: "#22c55e" },
                { label: "Продано",           value: `$${histStats.sold.toLocaleString("en-US")}`,                    sub: "суммарно продано",  color: "#ef4444" },
                { label: "Реализ. прибыль",   value: `${histStats.realizedPnl >= 0 ? "+" : ""}$${histStats.realizedPnl.toLocaleString("en-US")}`, sub: "P&L по закрытым", color: histStats.realizedPnl >= 0 ? "#22c55e" : "#ef4444" },
                { label: "Комиссии уплачено", value: `$${histStats.totalComm.toFixed(2)}`,                            sub: "брокерские расходы", color: "#f59e0b" },
                { label: "Лучшая сделка",     value: histStats.bestDeal ? histStats.bestDeal.ticker : "–",            sub: histStats.bestDeal ? `+$${histStats.bestDeal.pnl.toLocaleString("en-US")}` : "",  color: "#22c55e" },
              ].map((m) => (
                <div key={m.label} className="card" style={{ padding: 12 }}>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 3 }}>{m.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: (m as any).color ?? "var(--text-primary)" }}>{m.value}</div>
                  <div style={{ fontSize: 11, color: (m as any).color ?? "var(--text-secondary)" }}>{m.sub}</div>
                </div>
              ))}
            </div>

            {/* Cumulative P&L chart */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div className="card-title" style={{ margin: 0 }}>Накопленная реализованная прибыль</div>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#22c55e" }}>
                  +${histStats.realizedPnl.toLocaleString("en-US")}
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
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }}
                    formatter={(v: any) => [`$${Number(v).toLocaleString("en-US")}`, "Накопл. P&L"]} />
                  <Area type="monotone" dataKey="cum" stroke="#22c55e" strokeWidth={2} fill="url(#gradPnl)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Filters */}
            <div className="card" style={{ padding: "12px 16px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {/* Search */}
                <input
                  value={histSearch}
                  onChange={(e) => { setHistSearch(e.target.value); setHistPage(1); }}
                  placeholder="Поиск по тикеру или названию…"
                  style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12, width: 220 }}
                />
                {/* Type */}
                <div style={{ display: "flex", gap: 5 }}>
                  {["Все","Покупка","Продажа","Дивиденды","Ребалансировка"].map((t) => (
                    <button key={t} onClick={() => { setHistType(t); setHistPage(1); }} style={{
                      padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
                      background: histType === t ? (TYPE_COLOR[t] ?? "var(--accent)") : "var(--bg-secondary)",
                      color: histType === t ? "white" : "var(--text-secondary)",
                    }}>{t}</button>
                  ))}
                </div>
                {/* Period */}
                <div style={{ display: "flex", gap: 5, marginLeft: "auto" }}>
                  {["1М","3М","6М","1Г","Всё"].map((p) => (
                    <button key={p} onClick={() => { setHistPeriod(p); setHistPage(1); }} style={{
                      padding: "6px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
                      background: histPeriod === p ? "var(--accent)" : "var(--bg-secondary)",
                      color: histPeriod === p ? "white" : "var(--text-secondary)",
                    }}>{p}</button>
                  ))}
                </div>
                {/* Export */}
                <button onClick={exportHistory} style={{
                  padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", fontSize: 11, fontWeight: 600,
                  background: "transparent", color: "var(--text-secondary)",
                }}>↓ CSV</button>
              </div>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0 }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                      {([
                        { label: "Дата",       field: "date"       },
                        { label: "Тип",        field: "type"       },
                        { label: "Тикер",      field: "ticker"     },
                        { label: "Инструмент", field: null         },
                        { label: "Кол-во",     field: "qty"        },
                        { label: "Цена",       field: "price"      },
                        { label: "Сумма",      field: "amount"     },
                        { label: "Комиссия",   field: "commission" },
                        { label: "P&L",        field: "pnl"        },
                        { label: "Брокер",     field: null         },
                        { label: "Заметка",    field: null         },
                        { label: "Статус",     field: null         },
                      ] as { label: string; field: SortField | null }[]).map(({ label, field }) => (
                        <th
                          key={label}
                          onClick={() => field && toggleSort(field)}
                          style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, fontSize: 11, whiteSpace: "nowrap", cursor: field ? "pointer" : "default", userSelect: "none" }}
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
                          <span style={{ padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: TYPE_BG[a.type] ?? "var(--bg-secondary)", color: TYPE_COLOR[a.type] ?? "var(--text-primary)" }}>
                            {a.type}
                          </span>
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 22, height: 22, borderRadius: "50%", background: a.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, color: "white", flexShrink: 0 }}>
                              {a.ticker.slice(0, 2)}
                            </div>
                            <span style={{ fontWeight: 700 }}>{a.ticker}</span>
                          </div>
                        </td>
                        <td style={{ padding: "8px 10px", color: "var(--text-secondary)", fontSize: 11, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</td>
                        <td style={{ padding: "8px 10px" }}>{a.qty > 0 ? a.qty : "—"}</td>
                        <td style={{ padding: "8px 10px" }}>{a.price > 0 ? `$${a.price.toLocaleString("en-US")}` : "—"}</td>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: a.type === "Покупка" ? "#ef4444" : "#22c55e" }}>
                          {a.type === "Покупка" ? "-" : a.type === "Продажа" || a.type === "Дивиденды" ? "+" : ""}
                          {a.amount > 0 ? `$${a.amount.toLocaleString("en-US")}` : "—"}
                        </td>
                        <td style={{ padding: "8px 10px", color: "var(--text-secondary)" }}>
                          {a.commission > 0 ? `$${a.commission.toFixed(2)}` : "—"}
                        </td>
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: a.pnl > 0 ? "#22c55e" : a.pnl < 0 ? "#ef4444" : "var(--text-secondary)" }}>
                          {a.pnl > 0 ? "+" : ""}{a.pnl !== 0 ? `$${a.pnl.toLocaleString("en-US")}` : "—"}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, background: "rgba(34,197,94,0.12)", color: "#22c55e", fontWeight: 600 }}>{a.broker}</span>
                        </td>
                        <td style={{ padding: "8px 10px", color: "var(--text-secondary)", fontSize: 11, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.note || "—"}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, background: "rgba(34,197,94,0.12)", color: "#22c55e", fontWeight: 600 }}>{a.status}</span>
                        </td>
                      </tr>
                    ))}
                    {pagedHistory.length === 0 && (
                      <tr><td colSpan={12} style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>Нет операций по заданным фильтрам</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 12 }}>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {filteredHistory.length} операций · страница {histPage} из {totalPages}
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => setHistPage(Math.max(1, histPage - 1))} disabled={histPage === 1}
                      style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: histPage === 1 ? "default" : "pointer", opacity: histPage === 1 ? 0.4 : 1 }}>←</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button key={p} onClick={() => setHistPage(p)}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: p === histPage ? 700 : 400,
                          background: p === histPage ? "var(--accent)" : "transparent",
                          color: p === histPage ? "white" : "var(--text-secondary)" }}>{p}</button>
                    ))}
                    <button onClick={() => setHistPage(Math.min(totalPages, histPage + 1))} disabled={histPage === totalPages}
                      style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: histPage === totalPages ? "default" : "pointer", opacity: histPage === totalPages ? 0.4 : 1 }}>→</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
