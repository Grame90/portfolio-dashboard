"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
const LS_IMPORT_KEY = "report-imported-rows-v1";

type ImportedRow = {
  id: string;
  date: string;
  portfolio: string;
  broker: string;
  instrument: string;
  ticker: string;
  currency: string;
  qty: number;
  avgPrice: number;
  currentPrice: number;
  invested: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
  note: string;
};
type ImportedEditableField = "date" | "portfolio" | "broker" | "instrument" | "ticker" | "currency" | "qty" | "avgPrice" | "currentPrice" | "invested" | "marketValue" | "pnl" | "pnlPct" | "note";

function loadSnapshots(): SnapshotRow[] {
  try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveSnapshots(rows: SnapshotRow[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(rows)); } catch {}
}
function loadImportedRows(): ImportedRow[] {
  try { const r = localStorage.getItem(LS_IMPORT_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveImportedRows(rows: ImportedRow[]) {
  try { localStorage.setItem(LS_IMPORT_KEY, JSON.stringify(rows)); } catch {}
}

function normalizeHeader(v: string) {
  return v
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[^\p{L}\p{N}%()+./\s-]/gu, "")
    .replace(/\s+/g, " ");
}
function toNum(v: unknown) {
  if (v == null) return 0;
  const s = String(v).replace(/\s+/g, "").replace(/,/g, ".").replace(/[^0-9.+-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function detectDelimiter(text: string) {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
  const variants = [",", ";", "\t", "|"];
  let best = ",";
  let count = -1;
  for (const d of variants) {
    const c = line.split(d).length;
    if (c > count) { count = c; best = d; }
  }
  return best;
}
function parseDelimited(text: string) {
  const delimiter = detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { headers: [] as string[], rows: [] as string[][] };
  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === "\"") {
        if (q && line[i + 1] === "\"") { cur += "\""; i++; continue; }
        q = !q; continue;
      }
      if (!q && ch === delimiter) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map((v) => v.trim());
  };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine).filter((r) => r.some((x) => x !== ""));
  return { headers, rows };
}
function pick(map: Record<string, number>, variants: string[]) {
  for (const v of variants) {
    const nv = normalizeHeader(v);
    if (map[nv] != null) return map[nv];
  }
  const keys = Object.keys(map);
  for (const key of keys) {
    if (!key || key.length < 2) continue;
    for (const v of variants) {
      const nv = normalizeHeader(v);
      if (!nv || nv.length < 2) continue;
      if (key.includes(nv) || nv.includes(key)) return map[key];
    }
  }
  return -1;
}
function mapImported(headers: string[], rows: string[][]): ImportedRow[] {
  const hm: Record<string, number> = {};
  headers.forEach((h, i) => { hm[normalizeHeader(h)] = i; });
  const idx = {
    date: pick(hm, ["date", "дата", "день"]),
    portfolio: pick(hm, ["portfolio", "портфель"]),
    broker: pick(hm, ["broker", "брокер"]),
    instrument: pick(hm, ["instrument", "инструмент", "name", "название"]),
    ticker: pick(hm, ["ticker", "тикер", "symbol"]),
    currency: pick(hm, ["currency", "валюта"]),
    qty: pick(hm, ["qty", "quantity", "кол-во", "количество"]),
    avgPrice: pick(hm, ["avg price", "average price", "ср.цена", "средняя цена"]),
    currentPrice: pick(hm, ["current price", "тек.цена", "цена"]),
    invested: pick(hm, ["invested", "вложено", "инвестировано", "cost"]),
    marketValue: pick(hm, ["market value", "value", "стоимость", "total", "usd", "баланс (usd)", "баланс usd"]),
    pnl: pick(hm, ["pnl", "p/l", "прибыль", "убыток", "чистая приб", "сверх прибылиразница (usd)", "сверх прибыли"]),
    pnlPct: pick(hm, ["pnl %", "доходность %", "p/l %", "доходность (%)"]),
    note: pick(hm, ["note", "заметка", "комментарий"]),
    close: pick(hm, ["close"]),
  };
  return rows.map((r, i) => {
    const qty = idx.qty >= 0 ? toNum(r[idx.qty]) : 0;
    const avgPrice = idx.avgPrice >= 0 ? toNum(r[idx.avgPrice]) : 0;
    const currentPrice = idx.currentPrice >= 0 ? toNum(r[idx.currentPrice]) : (idx.close >= 0 ? toNum(r[idx.close]) : 0);
    const invested = idx.invested >= 0 ? toNum(r[idx.invested]) : qty * avgPrice;
    const marketValue = idx.marketValue >= 0 ? toNum(r[idx.marketValue]) : qty * (currentPrice || avgPrice);
    const pnl = idx.pnl >= 0 ? toNum(r[idx.pnl]) : marketValue - invested;
    const pnlPct = idx.pnlPct >= 0 ? toNum(r[idx.pnlPct]) : (invested > 0 ? (pnl / invested) * 100 : 0);
    const resolvedDate = idx.date >= 0 ? (r[idx.date] || "") : "";
    const firstCol = r[0] || "";
    const date = resolvedDate || firstCol || todayStr();
    const instrument = idx.instrument >= 0 ? (r[idx.instrument] || "Срез портфеля") : "Срез портфеля";
    return {
      id: `${Date.now()}-${i}`,
      date,
      portfolio: idx.portfolio >= 0 ? (r[idx.portfolio] || "Общий портфель") : "Общий портфель",
      broker: idx.broker >= 0 ? (r[idx.broker] || "Свод") : "Свод",
      instrument,
      ticker: idx.ticker >= 0 ? (r[idx.ticker] || "TOTAL") : "TOTAL",
      currency: idx.currency >= 0 ? (r[idx.currency] || "USD") : "USD",
      qty,
      avgPrice,
      currentPrice,
      invested,
      marketValue,
      pnl,
      pnlPct,
      note: idx.note >= 0 ? (r[idx.note] || "") : "",
    };
  }).filter((x) => x.marketValue !== 0 || x.invested !== 0 || x.pnl !== 0);
}

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export default function ReportPage() {
  const app = useApp();
  const importRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<SnapshotRow[]>(() => loadSnapshots());
  const [importedRows, setImportedRows] = useState<ImportedRow[]>(() => loadImportedRows());
  const [lockedRows, setLockedRows] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof SnapshotRow } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [rates, setRates] = useState<{ TRY: number; EUR: number; RUB: number }>({ TRY: 32.5, EUR: 0.92, RUB: 93 });
  const [snapping, setSnapping] = useState(false);
  const [lastSnap, setLastSnap] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importEdit, setImportEdit] = useState<{ id: string; field: ImportedEditableField } | null>(null);
  const [importEditValue, setImportEditValue] = useState("");
  const [portfolioFilter, setPortfolioFilter] = useState("ALL");
  const [brokerFilter, setBrokerFilter] = useState("ALL");
  const [currencyFilter, setCurrencyFilter] = useState("ALL");
  const [periodDays, setPeriodDays] = useState("ALL");

  useEffect(() => {
    // fetch exchange rates
    fetch("/api/rates").then(r => r.json()).then(d => {
      setRates({ TRY: d.TRY ?? 32.5, EUR: d.EUR ?? 0.92, RUB: d.RUB ?? 93 });
    }).catch(() => {});
  }, []);

  function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = String(ev.target?.result ?? "");
        const parsed = parseDelimited(text);
        const mapped = mapImported(parsed.headers, parsed.rows);
        setImportedRows(mapped);
        saveImportedRows(mapped);
        setImportMessage(mapped.length > 0 ? `Импортировано строк: ${mapped.length}` : "Файл прочитан, но подходящие строки не найдены");
      } catch {}
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  const filteredImported = useMemo(() => {
    let arr = importedRows;
    if (portfolioFilter !== "ALL") arr = arr.filter((r) => r.portfolio === portfolioFilter);
    if (brokerFilter !== "ALL") arr = arr.filter((r) => r.broker === brokerFilter);
    if (currencyFilter !== "ALL") arr = arr.filter((r) => r.currency === currencyFilter);
    if (periodDays !== "ALL") {
      const d = Number(periodDays);
      const now = new Date();
      arr = arr.filter((r) => {
        const dt = new Date(r.date.split(".").reverse().join("-"));
        if (Number.isNaN(dt.getTime())) return true;
        const diff = (now.getTime() - dt.getTime()) / 86400000;
        return diff <= d;
      });
    }
    return arr;
  }, [importedRows, portfolioFilter, brokerFilter, currencyFilter, periodDays]);

  function startImportEdit(id: string, field: ImportedEditableField, value: string | number) {
    setImportEdit({ id, field });
    setImportEditValue(String(value ?? ""));
  }

  function commitImportEdit() {
    if (!importEdit) return;
    const { id, field } = importEdit;
    const numericFields: ImportedEditableField[] = ["qty", "avgPrice", "currentPrice", "invested", "marketValue", "pnl", "pnlPct"];
    const next = importedRows.map((row) => {
      if (row.id !== id) return row;
      const updated = { ...row };
      if (numericFields.includes(field)) {
        const n = toNum(importEditValue);
        (updated as ImportedRow)[field] = n as never;
      } else {
        (updated as ImportedRow)[field] = importEditValue as never;
      }
      return updated;
    });
    setImportedRows(next);
    saveImportedRows(next);
    setImportEdit(null);
    setImportEditValue("");
  }

  function deleteImportedRow(id: string) {
    const next = importedRows.filter((r) => r.id !== id);
    setImportedRows(next);
    saveImportedRows(next);
  }

  const importedStats = useMemo(() => {
    const invested = filteredImported.reduce((s, r) => s + r.invested, 0);
    const value = filteredImported.reduce((s, r) => s + r.marketValue, 0);
    const pnl = filteredImported.reduce((s, r) => s + r.pnl, 0);
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    return { invested, value, pnl, pnlPct, count: filteredImported.length };
  }, [filteredImported]);

  const portfolios = useMemo(() => ["ALL", ...Array.from(new Set(importedRows.map((r) => r.portfolio)))], [importedRows]);
  const brokers = useMemo(() => ["ALL", ...Array.from(new Set(importedRows.map((r) => r.broker)))], [importedRows]);
  const currencies = useMemo(() => ["ALL", ...Array.from(new Set(importedRows.map((r) => r.currency)))], [importedRows]);

  async function takeSnapshot() {
    setSnapping(true);
    let tryRate = rates.TRY, eurRate = rates.EUR, rubRate = rates.RUB;
    try {
      const r = await fetch("/api/rates"); const d = await r.json();
      tryRate = d.TRY ?? tryRate; eurRate = d.EUR ?? eurRate; rubRate = d.RUB ?? rubRate;
      setRates({ TRY: tryRate, EUR: eurRate, RUB: rubRate });
    } catch {}

    // Fold imported file rows ("История из файла") into the snapshot. Rates are
    // "1 USD = X foreign", so to convert foreign -> USD we divide by the rate.
    // Unknown currencies fall back to 1:1 (treat as USD).
    function toUsd(amount: number, currency: string): number {
      const cur = (currency || "USD").toUpperCase();
      if (cur === "USD" || !amount) return amount;
      if (cur === "EUR") return eurRate > 0 ? amount / eurRate : amount;
      if (cur === "TRY") return tryRate > 0 ? amount / tryRate : amount;
      if (cur === "RUB") return rubRate > 0 ? amount / rubRate : amount;
      return amount;
    }

    const importedInvested = importedRows.reduce((s, r) => s + toUsd(r.invested, r.currency), 0);
    const importedMarketValue = importedRows.reduce((s, r) => s + toUsd(r.marketValue, r.currency), 0);
    const importedPnl = importedRows.reduce((s, r) => s + toUsd(r.pnl, r.currency), 0);

    const btcPrice = app.liveQuotes["BTC"]?.current ?? 0;
    const liveBalance = app.portfolioTotal;
    const balanceUSD = liveBalance + importedMarketValue;
    const balanceEUR = eurRate > 0 ? balanceUSD * eurRate : 0;
    const balanceTRY = tryRate > 0 ? balanceUSD * tryRate : 0;
    const balanceRUB = rubRate > 0 ? balanceUSD * rubRate : 0;
    const balanceBTC = btcPrice > 0 ? balanceUSD / btcPrice : 0;
    const invested = app.totalCost + importedInvested;
    const totalPnl = app.totalPnl + importedPnl;
    const returnPct = invested > 0 ? (totalPnl / invested) * 100 : 0;
    // Daily P&L stays live-only: imported rows have no day-over-day delta.
    const dailyPnl = app.dailyChange;

    const existingRows = loadSnapshots();
    const daysSinceStart = existingRows.length;
    const benchmark10pct = invested > 0 ? invested * Math.pow(1 + 0.10, daysSinceStart / 365) - invested : 0;

    const note = importedRows.length > 0
      ? `Файл: ${importedRows.length} стр. (+$${fmt(importedMarketValue, 0)} рынок / +$${fmt(importedInvested, 0)} вложено)`
      : "";

    const row: SnapshotRow = {
      id: Date.now().toString(),
      date: todayStr(),
      tryRate, eurRate, rubRate, btcPrice,
      dailyPnl, totalPnl, balanceUSD, balanceEUR, balanceTRY, balanceRUB, balanceBTC,
      invested, returnPct, benchmark10pct,
      note,
    };

    const updated = [row, ...existingRows];
    saveSnapshots(updated);
    setRows(updated);
    setLastSnap(row.date);
    setSnapping(false);
  }

  // Auto-snapshot at 03:00 Istanbul time.
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
      if (hour === 3 && !alreadyToday && portfolioTotalRef.current > 0) {
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startEdit(id: string, field: keyof SnapshotRow, currentValue: string | number) {
    if (lockedRows.has(id)) return;
    setEditingCell({ id, field });
    setEditValue(String(currentValue));
  }

  

  function commitEdit() {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const updated = rows.map(r => {
      if (r.id !== id) return r;
      let val: string | number = editValue;
      if (field !== "note" && field !== "date") {
        const parsed = Number(editValue.replace(/[^0-9.-]/g, ""));
        val = Number.isNaN(parsed) ? (r[field] as number) : parsed;
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
      <PageHeader title="ОТЧЁТ" subtitle="Ежедневные снэпшоты портфеля — автосохранение в 03:00 по Стамбулу" />

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

        <div className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => importRef.current?.click()} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Загрузить CSV/Excel-CSV
            </button>
            {importedRows.length > 0 && (
              <button onClick={() => { setImportedRows([]); saveImportedRows([]); setImportMessage("Импорт очищен"); }} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #ef4444", background: "transparent", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Очистить импорт
              </button>
            )}
            <input ref={importRef} type="file" accept=".csv,text/csv" onChange={importCsv} style={{ display: "none" }} />
            <select value={portfolioFilter} onChange={(e) => setPortfolioFilter(e.target.value)} style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12 }}>
              {portfolios.map((p) => <option key={p} value={p}>{p === "ALL" ? "Все портфели" : p}</option>)}
            </select>
            <select value={brokerFilter} onChange={(e) => setBrokerFilter(e.target.value)} style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12 }}>
              {brokers.map((p) => <option key={p} value={p}>{p === "ALL" ? "Все брокеры" : p}</option>)}
            </select>
            <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)} style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12 }}>
              {currencies.map((p) => <option key={p} value={p}>{p === "ALL" ? "Все валюты" : p}</option>)}
            </select>
            <select value={periodDays} onChange={(e) => setPeriodDays(e.target.value)} style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12 }}>
              <option value="ALL">Весь период</option>
              <option value="7">7 дней</option>
              <option value="30">30 дней</option>
              <option value="90">90 дней</option>
              <option value="365">365 дней</option>
            </select>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Записей из файла: <b style={{ color: "var(--text-primary)" }}>{importedStats.count}</b></div>
        </div>
        {importMessage && <div style={{ fontSize: 11, color: importedStats.count > 0 ? "#22c55e" : "#f59e0b" }}>{importMessage}</div>}

        {importedRows.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {[
              { label: "Вложено (файл)", value: `$${fmt(importedStats.invested, 2)}`, color: "var(--text-primary)" },
              { label: "Текущая стоимость", value: `$${fmt(importedStats.value, 2)}`, color: "var(--text-primary)" },
              { label: "P&L (файл)", value: `${importedStats.pnl >= 0 ? "+" : ""}$${fmt(importedStats.pnl, 2)}`, color: pnlColor(importedStats.pnl) },
              { label: "Доходность (файл)", value: `${importedStats.pnlPct >= 0 ? "+" : ""}${fmt(importedStats.pnlPct, 2)}%`, color: pnlColor(importedStats.pnlPct) },
            ].map((m) => (
              <div key={m.label} className="card" style={{ padding: 12 }}>
                <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>
        )}

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
                      Снэпшотов пока нет. Первый создастся автоматически в 03:00 по Стамбулу, или нажмите «+ Снэпшот сейчас».
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

        {importedRows.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 700 }}>
              История из файла (дополнение инструментов портфеля)
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ background: "var(--bg-secondary)" }}>
                    {["Дата","Портфель","Брокер","Инструмент","Тикер","Валюта","Кол-во","Ср.цена","Тек.цена","Вложено","Стоимость","P&L","Доход %","Заметка",""].map((h) => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 600, fontSize: 10, whiteSpace: "nowrap", borderBottom: "1px solid var(--border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredImported.map((r, idx) => (
                    <tr key={r.id} style={{ background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border)" }}>
                      {(["date","portfolio","broker","instrument","ticker","currency"] as ImportedEditableField[]).map((f) => (
                        <td key={f} style={{ padding: "7px 10px", fontWeight: f === "ticker" ? 700 : 400 }}>
                          {importEdit?.id === r.id && importEdit?.field === f ? (
                            <input autoFocus value={importEditValue} onChange={(e) => setImportEditValue(e.target.value)} onBlur={commitImportEdit} onKeyDown={(e) => { if (e.key === "Enter") commitImportEdit(); if (e.key === "Escape") setImportEdit(null); }} style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--accent)", borderRadius: 4, color: "var(--text-primary)", padding: "2px 4px", fontSize: 11 }} />
                          ) : (
                            <span onClick={() => startImportEdit(r.id, f, r[f])} style={{ cursor: "text" }}>{r[f] || "—"}</span>
                          )}
                        </td>
                      ))}
                      {(["qty","avgPrice","currentPrice","invested","marketValue","pnl","pnlPct"] as ImportedEditableField[]).map((f) => (
                        <td key={f} style={{ padding: "7px 10px", color: f === "pnl" || f === "pnlPct" ? pnlColor(r[f] as number) : "var(--text-primary)", fontWeight: f === "pnl" ? 700 : 400 }}>
                          {importEdit?.id === r.id && importEdit?.field === f ? (
                            <input autoFocus value={importEditValue} onChange={(e) => setImportEditValue(e.target.value)} onBlur={commitImportEdit} onKeyDown={(e) => { if (e.key === "Enter") commitImportEdit(); if (e.key === "Escape") setImportEdit(null); }} style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--accent)", borderRadius: 4, color: "var(--text-primary)", padding: "2px 4px", fontSize: 11 }} />
                          ) : (
                            <span onClick={() => startImportEdit(r.id, f, r[f] as number)} style={{ cursor: "text" }}>
                              {f === "pnlPct" ? `${(r[f] as number) >= 0 ? "+" : ""}${fmt(r[f] as number, 2)}%` : (f === "invested" || f === "marketValue" || f === "pnl") ? `${(f === "pnl" && (r[f] as number) >= 0) ? "+" : ""}$${fmt(r[f] as number, 2)}` : fmt(r[f] as number, 2)}
                            </span>
                          )}
                        </td>
                      ))}
                      <td style={{ padding: "7px 10px", color: "var(--text-secondary)" }}>
                        {importEdit?.id === r.id && importEdit?.field === "note" ? (
                          <input autoFocus value={importEditValue} onChange={(e) => setImportEditValue(e.target.value)} onBlur={commitImportEdit} onKeyDown={(e) => { if (e.key === "Enter") commitImportEdit(); if (e.key === "Escape") setImportEdit(null); }} style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--accent)", borderRadius: 4, color: "var(--text-primary)", padding: "2px 4px", fontSize: 11 }} />
                        ) : (
                          <span onClick={() => startImportEdit(r.id, "note", r.note)} style={{ cursor: "text" }}>{r.note || "—"}</span>
                        )}
                      </td>
                      <td style={{ padding: "7px 6px", whiteSpace: "nowrap" }}>
                        <button onClick={() => deleteImportedRow(r.id)} title="Удалить" style={{ background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 13, padding: "0 2px" }}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Снэпшоты фиксируются автоматически в 03:00 по стамбульскому времени (UTC+3). Заметки редактируются двойным кликом (строки без замка).
        </div>
      </div>
    </div>
  );
}
