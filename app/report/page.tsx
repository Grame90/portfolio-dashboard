"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import { useApp } from "@/lib/useApp";

type SnapshotRow = {
  id: string;
  date: string;
  tryRate: number;
  eurRate: number;
  rubRate: number;
  btcPrice: number;
  dailyPnl: number;
  totalPnl: number;
  balanceUSD: number;
  balanceEUR: number;
  balanceTRY: number;
  balanceRUB: number;
  balanceBTC: number;
  invested: number;
  returnPct: number;
  benchmark10pct: number;
  note: string;
};

const LS_KEY = "report-snapshots";

function loadSnapshots(): SnapshotRow[] {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveSnapshots(rows: SnapshotRow[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(rows)); } catch {}
}

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export default function ReportPage() {
  const app = useApp();
  const [rows, setRows] = useState<SnapshotRow[]>([]);
  const [lockedRows, setLockedRows] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof SnapshotRow } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [rates, setRates] = useState<{ TRY: number; EUR: number; RUB: number }>({ TRY: 32.5, EUR: 0.92, RUB: 93 });
  const [snapping, setSnapping] = useState(false);
  const [lastSnap, setLastSnap] = useState<string | null>(null);

  useEffect(() => {
    setRows(loadSnapshots());
    // fetch exchange rates
    fetch("/api/rates").then(r => r.json()).then(d => {
      setRates({ TRY: d.TRY ?? 32.5, EUR: d.EUR ?? 0.92, RUB: d.RUB ?? 93 });
    }).catch(() => {});
  }, []);

  const takeSnapshot = useCallback(async () => {
    setSnapping(true);
    let tryRate = rates.TRY, eurRate = rates.EUR, rubRate = rates.RUB;
    try {
      const r = await fetch("/api/rates"); const d = await r.json();
      tryRate = d.TRY ?? tryRate; eurRate = d.EUR ?? eurRate; rubRate = d.RUB ?? rubRate;
      setRates({ TRY: tryRate, EUR: eurRate, RUB: rubRate });
    } catch {}

    const btcPrice = app.liveQuotes["BTC"]?.current ?? 0;
    const balanceUSD = app.portfolioTotal;
    const balanceEUR = eurRate > 0 ? balanceUSD * eurRate : 0;
    const balanceTRY = tryRate > 0 ? balanceUSD * tryRate : 0;
    const balanceRUB = rubRate > 0 ? balanceUSD * rubRate : 0;
    const balanceBTC = btcPrice > 0 ? balanceUSD / btcPrice : 0;
    const invested = app.totalCost;
    const totalPnl = app.totalPnl;
    const returnPct = app.totalPnlPct;
    const dailyPnl = app.dailyChange;

    const existingRows = loadSnapshots();
    const daysSinceStart = existingRows.length;
    const benchmark10pct = invested > 0 ? invested * Math.pow(1 + 0.10, daysSinceStart / 365) - invested : 0;

    const row: SnapshotRow = {
      id: Date.now().toString(),
      date: todayStr(),
      tryRate, eurRate, rubRate, btcPrice,
      dailyPnl, totalPnl, balanceUSD, balanceEUR, balanceTRY, balanceRUB, balanceBTC,
      invested, returnPct, benchmark10pct,
      note: "",
    };

    const updated = [row, ...existingRows];
    saveSnapshots(updated);
    setRows(updated);
    setLastSnap(row.date);
    setSnapping(false);
  }, [app, rates]);

  // Auto-snapshot at 22:00 Istanbul time.
  // Read current portfolio state via ref to avoid re-creating the interval on
  // every quote tick (liveQuotes changes ~3×/sec). Without the ref we'd tear
  // down and re-arm the 60s timer constantly, racing the takeSnapshot call.
  const takeSnapshotRef = useRef(takeSnapshot);
  takeSnapshotRef.current = takeSnapshot;
  const portfolioTotalRef = useRef(app.portfolioTotal);
  portfolioTotalRef.current = app.portfolioTotal;

  useEffect(() => {
    function checkAutoSnap() {
      const hour = parseInt(new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul", hour: "numeric", hour12: false }));
      const stored = loadSnapshots();
      const today = todayStr();
      const alreadyToday = stored.some(r => r.date === today);
      if (hour >= 22 && !alreadyToday && portfolioTotalRef.current > 0) {
        takeSnapshotRef.current();
      }
    }
    checkAutoSnap();
    const id = setInterval(checkAutoSnap, 60000);
    return () => clearInterval(id);
  }, []);

  function toggleLock(id: string) {
    setLockedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function startEdit(id: string, field: keyof SnapshotRow, currentValue: any) {
    if (lockedRows.has(id)) return;
    setEditingCell({ id, field });
    setEditValue(String(currentValue));
  }

  

  function commitEdit() {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const updated = rows.map(r => {
      if (r.id !== id) return r;
      let val: any = editValue;
      if (field !== "note" && field !== "date") {
        val = Number(editValue.replace(/[^0-9.-]/g, ""));
        if (isNaN(val)) val = r[field];
      }
      return { ...r, [field]: val };
    });
    saveSnapshots(updated);
    setRows(updated);
    setEditingCell(null);
  }

  function deleteRow(id: string) {
    if (lockedRows.has(id)) return;
    const updated = rows.filter(r => r.id !== id);
    saveSnapshots(updated);
    setRows(updated);
  }

  function exportCSV() {
    const header = ["Дата","Курс TRY","Курс EUR","Курс RUB","Цена BTC","Дневной P&L","Общий P&L","Доходность %","Бенчмарк 10%","Баланс USD","Баланс EUR","Баланс TRY","Баланс RUB","Баланс BTC","Инвестировано","Заметка"];
    const csvRows = rows.map(r => [
      r.date, r.tryRate.toFixed(2), r.eurRate.toFixed(4), r.rubRate.toFixed(2),
      r.btcPrice.toFixed(0), r.dailyPnl.toFixed(2), r.totalPnl.toFixed(2),
      r.returnPct.toFixed(2), r.benchmark10pct.toFixed(2),
      r.balanceUSD.toFixed(2), r.balanceEUR.toFixed(2), r.balanceTRY.toFixed(0),
      r.balanceRUB.toFixed(0), r.balanceBTC.toFixed(6),
      r.invested.toFixed(2), `"${r.note}"`,
    ].join(","));
    const blob = new Blob([[header.join(","), ...csvRows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "portfolio_report.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const pnlColor = (v: number) => v >= 0 ? "#22c55e" : "#ef4444";
  const fmt = (v: number, dec = 2) => v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader title="ОТЧЁТ" subtitle="Ежедневные снэпшоты портфеля — автосохранение в 22:00 по Стамбулу" />

      <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          {[
            { label: "Баланс (USD)", value: `$${fmt(app.portfolioTotal, 0)}`, color: "var(--text-primary)" },
            { label: "Общий P&L", value: `${app.totalPnl >= 0 ? "+" : ""}$${fmt(app.totalPnl, 0)}`, color: pnlColor(app.totalPnl) },
            { label: "Доходность", value: `${app.totalPnlPct >= 0 ? "+" : ""}${app.totalPnlPct.toFixed(2)}%`, color: pnlColor(app.totalPnlPct) },
            { label: "Дневной P&L", value: `${app.dailyChange >= 0 ? "+" : ""}$${fmt(app.dailyChange, 0)}`, color: pnlColor(app.dailyChange) },
            { label: "Снэпшотов", value: rows.length.toString(), color: "var(--text-primary)" },
          ].map(m => (
            <div key={m.label} className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Current rates */}
        <div className="card" style={{ padding: "10px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 24, fontSize: 12 }}>
              <span style={{ color: "var(--text-secondary)" }}>Курсы USD: <b style={{ color: "var(--text-primary)" }}>TRY {rates.TRY.toFixed(2)}</b> · <b style={{ color: "var(--text-primary)" }}>EUR {rates.EUR.toFixed(4)}</b> · <b style={{ color: "var(--text-primary)" }}>RUB {rates.RUB.toFixed(2)}</b> · <b style={{ color: "var(--text-primary)" }}>BTC {app.liveQuotes["BTC"]?.current ? `$${fmt(app.liveQuotes["BTC"].current, 0)}` : "–"}</b></span>
              {lastSnap && <span style={{ color: "#22c55e", fontSize: 11 }}>✓ Последний снэпшот: {lastSnap}</span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={takeSnapshot}
                disabled={snapping}
                style={{
                  padding: "6px 14px", borderRadius: 7, border: "none", cursor: snapping ? "wait" : "pointer",
                  background: "var(--accent)", color: "white", fontSize: 12, fontWeight: 600,
                }}
              >
                {snapping ? "Сохранение…" : "+ Снэпшот сейчас"}
              </button>
              <button
                onClick={exportCSV}
                style={{
                  padding: "6px 14px", borderRadius: 7, border: "1px solid var(--border)", cursor: "pointer",
                  background: "transparent", color: "var(--text-primary)", fontSize: 12, fontWeight: 600,
                }}
              >
                ↓ CSV
              </button>
            </div>
          </div>
        </div>

        {/* Main table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "var(--bg-secondary)" }}>
                  {["Дата","TRY","Дн. P&L","Общий P&L","Доход %","Бенч 10%","USD","EUR","TRY","RUB","BTC","Инвест.","Заметка",""].map((h, i) => (
                    <th key={i} style={{ padding: "8px 10px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 600, fontSize: 10, whiteSpace: "nowrap", borderBottom: "1px solid var(--border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary)" }}>
                      Снэпшотов пока нет. Первый создастся автоматически в 22:00 по Стамбулу, или нажмите «+ Снэпшот сейчас».
                    </td>
                  </tr>
                ) : rows.map((row, idx) => {
                  const locked = lockedRows.has(row.id);
                  const isEditing = editingCell?.id === row.id;
                  return (
                    <tr
                      key={row.id}
                      style={{
                        background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <td style={{ padding: "7px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>{row.date}</td>
                      <td style={{ padding: "7px 10px", color: "var(--text-secondary)" }}>{row.tryRate.toFixed(1)}</td>
                      {editingCell?.id === row.id && editingCell?.field === "dailyPnl" ? (
     <td style={{ padding: "7px 10px" }}><input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={e=>{if(e.key==="Enter")commitEdit();if(e.key==="Escape")setEditingCell(null);}} style={{ width:"60px", background:"var(--bg-secondary)", border:"1px solid var(--accent)", color:"var(--text-primary)"}} /></td>
   ) : (
     <td onClick={() => startEdit(row.id, "dailyPnl", row.dailyPnl)} style={{ cursor: locked ? "default" : "text", padding: "7px 10px", color: pnlColor(row.dailyPnl), fontWeight: 600 }}>{row.dailyPnl >= 0 ? "+" : ""}${fmt(row.dailyPnl, 0)}</td>
   )}
                      {editingCell?.id === row.id && editingCell?.field === "totalPnl" ? (
     <td style={{ padding: "7px 10px" }}><input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={e=>{if(e.key==="Enter")commitEdit();if(e.key==="Escape")setEditingCell(null);}} style={{ width:"60px", background:"var(--bg-secondary)", border:"1px solid var(--accent)", color:"var(--text-primary)"}} /></td>
   ) : (
     <td onClick={() => startEdit(row.id, "totalPnl", row.totalPnl)} style={{ cursor: locked ? "default" : "text", padding: "7px 10px", color: pnlColor(row.totalPnl), fontWeight: 600 }}>{row.totalPnl >= 0 ? "+" : ""}${fmt(row.totalPnl, 0)}</td>
   )}
                      <td style={{ padding: "7px 10px", color: pnlColor(row.returnPct) }}>{row.returnPct >= 0 ? "+" : ""}{row.returnPct.toFixed(2)}%</td>
                      <td style={{ padding: "7px 10px", color: "var(--text-secondary)" }}>{row.benchmark10pct >= 0 ? "+" : ""}${fmt(row.benchmark10pct, 0)}</td>
                      {editingCell?.id === row.id && editingCell?.field === "balanceUSD" ? (
     <td style={{ padding: "7px 10px" }}><input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={e=>{if(e.key==="Enter")commitEdit();if(e.key==="Escape")setEditingCell(null);}} style={{ width:"60px", background:"var(--bg-secondary)", border:"1px solid var(--accent)", color:"var(--text-primary)"}} /></td>
   ) : (
     <td onClick={() => startEdit(row.id, "balanceUSD", row.balanceUSD)} style={{ cursor: locked ? "default" : "text", padding: "7px 10px" }}>${fmt(row.balanceUSD, 0)}</td>
   )}
                      <td style={{ padding: "7px 10px", color: "var(--text-secondary)" }}>€{fmt(row.balanceEUR, 0)}</td>
                      <td style={{ padding: "7px 10px", color: "var(--text-secondary)" }}>₺{fmt(row.balanceTRY, 0)}</td>
                      <td style={{ padding: "7px 10px", color: "var(--text-secondary)" }}>₽{fmt(row.balanceRUB, 0)}</td>
                      <td style={{ padding: "7px 10px", color: "var(--text-secondary)" }}>₿{row.balanceBTC.toFixed(5)}</td>
                      {editingCell?.id === row.id && editingCell?.field === "invested" ? (
     <td style={{ padding: "7px 10px" }}><input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)} onBlur={commitEdit} onKeyDown={e=>{if(e.key==="Enter")commitEdit();if(e.key==="Escape")setEditingCell(null);}} style={{ width:"60px", background:"var(--bg-secondary)", border:"1px solid var(--accent)", color:"var(--text-primary)"}} /></td>
   ) : (
     <td onClick={() => startEdit(row.id, "invested", row.invested)} style={{ cursor: locked ? "default" : "text", padding: "7px 10px", color: "var(--text-secondary)" }}>${fmt(row.invested, 0)}</td>
   )}
                      <td style={{ padding: "7px 10px", minWidth: 120 }}>
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingCell(null); }}
                            style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--accent)", borderRadius: 4, color: "var(--text-primary)", padding: "2px 4px", fontSize: 11 }}
                          />
                        ) : (
                          <span
                            onClick={() => startEdit(row.id, "note", row.note)}
                            style={{ cursor: locked ? "default" : "text", color: row.note ? "var(--text-primary)" : "var(--text-muted)", fontStyle: row.note ? "normal" : "italic" }}
                          >
                            {row.note || (locked ? "–" : "Добавить заметку…")}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "7px 6px", whiteSpace: "nowrap" }}>
                        <button
                          onClick={() => toggleLock(row.id)}
                          title={locked ? "Разблокировать" : "Заблокировать"}
                          style={{ background: "transparent", border: "none", cursor: "pointer", color: locked ? "#f59e0b" : "var(--text-muted)", fontSize: 14, padding: "0 2px" }}
                        >
                          {locked ? "🔒" : "🔓"}
                        </button>
                        {!locked && (
                          <button
                            onClick={() => deleteRow(row.id)}
                            title="Удалить"
                            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 13, padding: "0 2px" }}
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr style={{ background: "var(--bg-secondary)", fontWeight: 700 }}>
                    <td style={{ padding: "7px 10px", fontSize: 10, color: "var(--text-secondary)" }}>ИТОГО</td>
                    <td />
                    <td style={{ padding: "7px 10px", color: pnlColor(rows.reduce((s, r) => s + r.dailyPnl, 0)) }}>
                      {rows.reduce((s, r) => s + r.dailyPnl, 0) >= 0 ? "+" : ""}${fmt(rows.reduce((s, r) => s + r.dailyPnl, 0), 0)}
                    </td>
                    <td style={{ padding: "7px 10px", color: pnlColor(rows[0]?.totalPnl ?? 0) }}>
                      {(rows[0]?.totalPnl ?? 0) >= 0 ? "+" : ""}${fmt(rows[0]?.totalPnl ?? 0, 0)}
                    </td>
                    <td colSpan={10} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Снэпшоты фиксируются автоматически в 22:00 по московскому/стамбульскому времени (UTC+3). Заметки редактируются двойным кликом (строки без замка).
        </div>
      </div>
    </div>
  );
}
