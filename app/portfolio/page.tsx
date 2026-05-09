"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import { useMobile } from "@/lib/useMobile";
import { useMarketStatus, formatEtTime } from "@/lib/marketStatus";
import { useApp } from "@/lib/useApp";
import ApexChart from "@/components/ApexChart";
import {
  BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine, CartesianGrid,
} from "recharts";

type LivePosition = {
  id: number; ticker: string; name: string; type: string;
  qty: number; avgPrice: number; currentPrice: number; previousClose: number;
  color: string; value: number; pnl: number; pnlPct: number;
  share: number; action: string; targetShare: number; live: boolean;
  broker?: string;
};

function recompute(list: LivePosition[]): LivePosition[] {
  const total = list.reduce((s, p) => s + p.qty * p.currentPrice, 0);
  return list.map((p) => {
    const value = p.qty * p.currentPrice;
    const cost = p.qty * p.avgPrice;
    const pnl = p.avgPrice > 0 ? Math.round(value - cost) : 0;
    const pnlPct = p.avgPrice > 0 ? ((p.currentPrice - p.avgPrice) / p.avgPrice) * 100 : 0;
    const share = total > 0 ? (value / total) * 100 : 0;
    return { ...p, value: Math.round(value), pnl, pnlPct, share, targetShare: p.targetShare ?? 0 };
  });
}


const POSITION_COLORS = [
  "#7c3aed","#9d6ef5","#3b82f6","#06b6d4","#f59e0b",
  "#94a3b8","#ef4444","#ec4899","#22c55e","#84cc16","#f97316","#a855f7",
];

const COLORS = ["#7c3aed", "#f59e0b", "#3b82f6", "#22c55e"];

const TICKER_BETA: Record<string, number> = {
  VOO: 1.00, QQQ: 1.12, SMH: 1.35, SOXX: 1.30, GLD: -0.08,
  SLV: 0.12, "BRK.B": 0.82, TSLA: 1.85, IBKR: 1.10,
};

const PURCHASE_DATES: Record<string, string> = {
  VOO: "2023-02-14", QQQ: "2023-01-09", SMH: "2022-11-21",
  SOXX: "2023-04-03", GLD: "2022-10-17", SLV: "2022-09-05",
  "BRK.B": "2023-03-28", TSLA: "2023-07-12", IBKR: "2022-12-01",
};

type ColId = "idx"|"ticker"|"name"|"qty"|"avgPrice"|"currentPrice"|"value"|"pnl"|"pnlPct"|"share"|"targetShare"|"deviation"|"action"|"type"|"dayUsd"|"dayPct"|"beta"|"stopLoss"|"annReturn"|"broker";

const ALL_COLS: { id: ColId; label: string; extra?: boolean }[] = [
  { id: "idx",          label: "#" },
  { id: "ticker",       label: "Тикер" },
  { id: "name",         label: "Инструмент" },
  { id: "qty",          label: "Кол-во" },
  { id: "avgPrice",     label: "Ср.цена" },
  { id: "currentPrice", label: "Тек.цена" },
  { id: "value",        label: "Стоимость" },
  { id: "pnl",          label: "P/L USD" },
  { id: "pnlPct",       label: "P/L %" },
  { id: "share",        label: "Доля" },
  { id: "targetShare",  label: "Цел.доля" },
  { id: "deviation",    label: "Откл." },
  { id: "action",       label: "Действие" },
  { id: "type",         label: "Тип",          extra: true },
  { id: "dayUsd",       label: "День $",       extra: true },
  { id: "dayPct",       label: "День %",       extra: true },
  { id: "beta",         label: "Бета",         extra: true },
  { id: "stopLoss",     label: "Стоп-лосс",   extra: true },
  { id: "annReturn",    label: "Год. дох.",    extra: true },
  { id: "broker",       label: "Брокер",       extra: true },
];

const DEFAULT_COLS = new Set<ColId>(["idx","ticker","name","qty","avgPrice","currentPrice","value","pnl","pnlPct","share","targetShare","deviation","action"]);


function dAgoLabel(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
}
const recentActions = [
  { date: `${dAgoLabel(0)} 01:52`, action: "Фиксация портфеля" },
  { date: `${dAgoLabel(1)} 10:10`, action: "Частичная фиксация QQQ" },
  { date: `${dAgoLabel(2)} 09:45`, action: "Докупка GLD" },
  { date: `${dAgoLabel(3)} 11:30`, action: "Ребалансировка портфеля" },
];

const DEFAULT_LADDER_STEP = 5;
const DEFAULT_LADDER_LEVELS = 4;

const periodOptions = ["1Д", "7Д", "1М", "3М", "6М", "YTD", "1Г", "ВСЕ"];

const LS_CHART = "portfolio-chart-history";
type ChartPoint = { date: string; value: number; cost: number };
type Snapshot = { date: string; time: string; capital: number; profitPct: string; comment: string };

function periodCutoff(period: string): string {
  const d = new Date();
  if (period === "1Д")  d.setDate(d.getDate() - 1);
  else if (period === "7Д")  d.setDate(d.getDate() - 7);
  else if (period === "1М")  d.setMonth(d.getMonth() - 1);
  else if (period === "3М")  d.setMonth(d.getMonth() - 3);
  else if (period === "6М")  d.setMonth(d.getMonth() - 6);
  else if (period === "YTD") d.setMonth(0, 1);
  else if (period === "1Г")  d.setFullYear(d.getFullYear() - 1);
  else return "0000-00-00";
  return d.toISOString().slice(0, 10);
}
function fmtDate(iso: string): string { const [,m,day] = iso.split("-"); return `${day}.${m}`; }

export default function PortfolioPage() {
  const app = useApp();
  const positions = (app.positions as unknown as LivePosition[]).map(p => ({
    ...p,
    currentPrice:  (p as any).currentPrice  ?? p.avgPrice,
    previousClose: (p as any).previousClose ?? p.avgPrice,
    value:         (p as any).value         ?? p.qty * p.avgPrice,
    pnl:           (p as any).pnl           ?? 0,
    pnlPct:        (p as any).pnlPct        ?? 0,
    share:         (p as any).share         ?? 0,
    targetShare:   (p as any).targetShare   ?? 0,
    live:          (p as any).live          ?? p.type !== "Кэш",
  }));
  const setPositions = (updater: ((prev: LivePosition[]) => LivePosition[]) | LivePosition[]) => {
    const next = typeof updater === "function" ? updater(positions) : updater;
    app.setPositions(next as any);
  };
  
  const isMobile = useMobile();
  const [period, setPeriod] = useState("1М");
  const [history, setHistory] = useState<ChartPoint[]>([]);
    const [lastTick, setLastTick] = useState<Record<number, "up" | "down" | null>>({});
  const [quoteStatus, setQuoteStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [lastPriceT, setLastPriceT] = useState<number>(0);
  const market = useMarketStatus();
  const [liveSnapshots, setLiveSnapshots] = useState<Snapshot[]>([]);
  const [visibleCols, setVisibleCols] = useState<Set<ColId>>(DEFAULT_COLS);
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [colOrder, setColOrder] = useState<ColId[]>(ALL_COLS.map((c) => c.id));
  const dragColRef = useRef<ColId | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColId | null>(null);
  const [actionTooltip, setActionTooltip] = useState<{ id: number; x: number; y: number } | null>(null);
  const [ladderStep, setLadderStep] = useState(DEFAULT_LADDER_STEP);
  const [ladderLevels, setLadderLevels] = useState(DEFAULT_LADDER_LEVELS);
  const [ladderTickers, setLadderTickers] = useState<string[]>([]);
  const [ladderExpanded, setLadderExpanded] = useState(false);
  const [snapshotExpanded, setSnapshotExpanded] = useState(false);
  const [editingSnap, setEditingSnap] = useState<number | null>(null);
  const [editSnapVal, setEditSnapVal] = useState<{ comment: string; capital: string }>({ comment: "", capital: "" });
  const [mergeByTicker, setMergeByTicker] = useState(true);

  const displayPositions = useMemo(() => {
    if (!mergeByTicker) return positions;
    const map = new Map<string, LivePosition>();
    for (const p of positions) {
      const existing = map.get(p.ticker);
      if (!existing) {
        map.set(p.ticker, { ...p });
      } else {
        const totalQty = existing.qty + p.qty;
        const weightedAvg = totalQty > 0 ? (existing.qty * existing.avgPrice + p.qty * p.avgPrice) / totalQty : 0;
        const brokers = [...new Set([existing.broker, (p as any).broker].filter(Boolean))].join(", ");
        map.set(p.ticker, {
          ...existing,
          qty: totalQty,
          avgPrice: weightedAvg,
          currentPrice: p.currentPrice,
          previousClose: p.previousClose,
          value: existing.value + p.value,
          pnl: existing.pnl + p.pnl,
          targetShare: existing.targetShare + p.targetShare,
          broker: brokers || undefined,
        });
      }
    }
    return recompute([...map.values()]);
  }, [positions, mergeByTicker]);

  const fetchQuotes = useCallback(async (current: LivePosition[]) => {
    const stockPositions = current.filter((p) => p.live && p.type !== "Крипто");
    const cryptoPositions = current.filter((p) => p.live && p.type === "Крипто");
    if (stockPositions.length === 0 && cryptoPositions.length === 0) return;

    setQuoteStatus("loading");
    try {
      const allData: Record<string, { current: number; previousClose: number; t?: number }> = {};

      if (stockPositions.length > 0) {
        const tickers = stockPositions.map((p) => p.ticker);
        const res = await fetch(`/api/quotes?tickers=${tickers.join(",")}`);
        if (res.ok) Object.assign(allData, await res.json());
      }
      if (cryptoPositions.length > 0) {
        const tickers = cryptoPositions.map((p) => p.ticker);
        const res = await fetch(`/api/crypto?tickers=${tickers.join(",")}`);
        if (res.ok) Object.assign(allData, await res.json());
      }

      const maxT = Object.values(allData).reduce((m, q) => Math.max(m, (q as any).t ?? 0), 0);
      if (maxT > 0) setLastPriceT(maxT);

      setPositions((prev: any) =>
        recompute(
          prev.map((p: any) => {
            const q = allData[p.ticker];
            if (!q || q.current <= 0) return p;
            const direction = q.current > p.currentPrice ? "up" : q.current < p.currentPrice ? "down" : null;
            setLastTick((lt) => ({ ...lt, [p.id]: direction }));
            return { ...p, currentPrice: q.current, previousClose: q.previousClose };
          })
        )
      );
      setQuoteStatus("ok");
    } catch {
      setQuoteStatus("error");
    }
  }, []);

  // Sync live quotes from AppContext so all pages show the same prices
  useEffect(() => {
    if (!Object.keys(app.liveQuotes).length) return;
    setPositions((prev: any) => recompute(prev.map((p: any) => {
      const q = app.liveQuotes[p.ticker];
      if (!q || q.current <= 0) return p;
      return { ...p, currentPrice: q.current, previousClose: q.previousClose };
    })));
  }, [app.liveQuotes]);

  const [histData, setHistData] = useState<Record<string, { dates: string[]; closes: number[] }>>({});
  const [histLoaded, setHistLoaded] = useState(false);

  useEffect(() => {
    const initial = positions;
    setPositions(initial);
    setLadderTickers(initial.filter(p => p.type !== "Кэш").map(p => p.ticker).slice(0, 5));
    fetchQuotes(initial);
    const id = setInterval(() => {
      
    }, 25000);

    // Fetch 500 days of historical prices for period P&L calculation
    const stockTickers = initial
      .filter(p => p.type !== "Кэш" && p.type !== "Крипто")
      .map(p => p.ticker);
    if (stockTickers.length > 0) {
      fetch(`/api/historical?tickers=${stockTickers.join(",")}&days=500`)
        .then(r => r.ok ? r.json() : {})
        .then(data => { setHistData(data || {}); setHistLoaded(true); })
        .catch(() => { setHistLoaded(true); });
    } else {
      setHistLoaded(true);
    }

    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchQuotes]);

  

  // Load / save column visibility
  useEffect(() => {
    try {
      const saved = localStorage.getItem("portfolio-cols");
      if (saved) setVisibleCols(new Set(JSON.parse(saved) as ColId[]));
    } catch {}
  }, []);


  // Load / save column order
  useEffect(() => {
    try {
      const saved = localStorage.getItem("portfolio-col-order");
      if (saved) {
        const parsed = JSON.parse(saved) as ColId[];
        // merge: keep all known ids, add any new ones at the end
        const known = new Set(ALL_COLS.map((c) => c.id));
        const merged = [...parsed.filter((id) => known.has(id)), ...ALL_COLS.map((c) => c.id).filter((id) => !parsed.includes(id))];
        setColOrder(merged);
      }
    } catch {}
  }, []);

  const [colOrderSaved, setColOrderSaved] = useState(false);

  function saveColView() {
    localStorage.setItem("portfolio-col-order", JSON.stringify(colOrder));
    localStorage.setItem("portfolio-cols", JSON.stringify([...visibleCols]));
    setColOrderSaved(true);
    setTimeout(() => setColOrderSaved(false), 2000);
  }

  function toggleCol(id: ColId) {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  // Listen for snapshot button in PageHeader
  useEffect(() => {
    function onSnapshot(e: Event) {
      const now = (e as CustomEvent<{ time: Date }>).detail.time;
      setPositions((current: any) => {
        const total = current.reduce((s: number, p: any) => s + p.value, 0);
        const cost  = current.reduce((s: number, p: any) => s + p.qty * p.avgPrice, 0);
        const pnl   = total - cost;
        const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
        const dd = String(now.getDate()).padStart(2, "0");
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const yyyy = now.getFullYear();
        const hh = String(now.getHours()).padStart(2, "0");
        const min = String(now.getMinutes()).padStart(2, "0");
        const newSnap: Snapshot = {
          date: `${dd}.${mm}.${yyyy}`,
          time: `${hh}:${min}`,
          capital: Math.round(total),
          profitPct: `${pnlPct.toFixed(2)}%`,
          comment: "Ручная фиксация",
        };
        setLiveSnapshots((prev) => [newSnap, ...prev]);
        return current;
      });
    }
    window.addEventListener("portfolio-snapshot", onSnapshot);
    return () => window.removeEventListener("portfolio-snapshot", onSnapshot);
  }, []);

  const portfolioTotal = positions.reduce((s, p) => s + p.value, 0);
  const totalCost = positions.reduce((s, p) => s + p.qty * p.avgPrice, 0);

  // Load chart history once
  useEffect(() => {
    try { const r = localStorage.getItem(LS_CHART); if (r) setHistory(JSON.parse(r)); } catch {}
    try { const r = localStorage.getItem("snapshots-data"); if (r) setLiveSnapshots(JSON.parse(r)); } catch {}
  }, []);

  // Auto-save today's snapshot
  const lastSaved = useRef(0);
  useEffect(() => {
    if (portfolioTotal <= 0 || Math.abs(portfolioTotal - lastSaved.current) < 1) return;
    lastSaved.current = portfolioTotal;
    const today = new Date().toISOString().slice(0, 10);
    setHistory(prev => {
      const next = [...prev];
      const idx = next.findIndex(p => p.date === today);
      const pt: ChartPoint = { date: today, value: Math.round(portfolioTotal), cost: Math.round(totalCost) };
      if (idx >= 0) next[idx] = pt; else next.push(pt);
      next.sort((a, b) => a.date.localeCompare(b.date));
      if (next.length > 730) next.splice(0, next.length - 730);
      try { localStorage.setItem(LS_CHART, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [portfolioTotal, totalCost]);

  // Compute portfolio timeline from Finnhub historical prices × current quantities
  const computedTimeline = useMemo((): { date: string; value: number }[] => {
    if (!positions.length || Object.keys(histData).length === 0) return [];
    const allDates = new Set<string>();
    for (const hist of Object.values(histData)) hist.dates.forEach(d => allDates.add(d));
    return [...allDates].sort().map(date => {
      let val = 0;
      for (const p of positions) {
        const fallback = p.qty * p.avgPrice;
        if (p.type === "Кэш") { val += fallback; continue; }
        const hist = histData[p.ticker];
        if (!hist?.dates.length) { val += fallback; continue; }
        let idx = -1;
        for (let i = hist.dates.length - 1; i >= 0; i--) {
          if (hist.dates[i] <= date) { idx = i; break; }
        }
        val += idx >= 0 ? p.qty * hist.closes[idx] : fallback;
      }
      return { date, value: Math.round(val) };
    });
  }, [histData, positions]);

  // Merge computed (higher priority) + localStorage snapshots
  const mergedTimeline = useMemo((): { date: string; value: number; cost: number }[] => {
    const byDate = new Map<string, { value: number; cost: number }>();
    for (const p of history) byDate.set(p.date, { value: p.value, cost: p.cost });
    for (const p of computedTimeline) {
      const existing = byDate.get(p.date);
      byDate.set(p.date, { value: p.value, cost: existing?.cost ?? totalCost });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (portfolioTotal > 0) byDate.set(today, { value: Math.round(portfolioTotal), cost: Math.round(totalCost) });
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));
  }, [history, computedTimeline, portfolioTotal, totalCost]);

  const chartData = useMemo(() => {
    const cutoff = periodCutoff(period);
    return mergedTimeline
      .filter(p => p.date >= cutoff)
      .map(p => ({ date: fmtDate(p.date), value: p.value, invested: p.cost }));
  }, [mergedTimeline, period]);
  const totalPnlPct = totalCost > 0 ? ((portfolioTotal - totalCost) / totalCost) * 100 : 0;
  const prevTotal = positions.reduce((s, p) => s + p.qty * (p.previousClose > 0 ? p.previousClose : p.currentPrice), 0);
  const dailyChangePct = prevTotal > 0 ? ((portfolioTotal - prevTotal) / prevTotal) * 100 : 0;
  const offTargetCount = positions.filter((p) => p.targetShare > 0 && Math.abs(p.share - p.targetShare) > 5).length;

  // User-defined triggers loaded from localStorage (empty by default)
  const triggerData: Array<{
    id: number; ticker: string; name: string; type: string;
    condition: string; currentValue: string; targetValue: string;
    priority: string; status: string; lastTriggered: string | null; color: string;
  }> = [];

  // No fake hardcoded alerts — only real user-triggered ones
  const triggerAlerts: Array<{ id: number; ticker: string; message: string; time: string; severity: string; read: boolean }> = [];

  // Evaluate each trigger against live prices
  const evaluatedTriggers = triggerData.map((t) => {
    if (t.status === "Неактивен") return { ...t, liveValue: t.currentValue, fired: false, progress: 0 };
    const pos = positions.find((p) => p.ticker === t.ticker);

    if (t.type === "Цена ниже") {
      const target = parseFloat(t.targetValue);
      const current = pos?.currentPrice ?? 0;
      const fired = current > 0 && current < target;
      const progress = current > 0 ? Math.min(100, ((target - current + (target * 0.2)) / (target * 0.2)) * 100) : 0;
      return { ...t, liveValue: current > 0 ? current.toFixed(2) : "–", fired, progress: Math.max(0, progress) };
    }
    if (t.type === "Цена выше") {
      const target = parseFloat(t.targetValue);
      const current = pos?.currentPrice ?? 0;
      const fired = current > 0 && current > target;
      const progress = current > 0 ? Math.min(100, (current / target) * 100) : 0;
      return { ...t, liveValue: current > 0 ? current.toFixed(2) : "–", fired, progress };
    }
    if (t.type === "Просадка %") {
      const target = parseFloat(t.targetValue);
      const drawdown = pos && pos.avgPrice > 0
        ? ((pos.currentPrice - pos.avgPrice) / pos.avgPrice) * 100
        : 0;
      const fired = drawdown < -target;
      const progress = Math.min(100, (Math.abs(Math.min(0, drawdown)) / target) * 100);
      return { ...t, liveValue: `${drawdown.toFixed(2)}%`, fired, progress };
    }
    if (t.type === "Просадка портфеля") {
      const target = parseFloat(t.targetValue);
      const fired = dailyChangePct < -target;
      const progress = Math.min(100, (Math.abs(Math.min(0, dailyChangePct)) / target) * 100);
      return { ...t, liveValue: `${dailyChangePct.toFixed(2)}%`, fired, progress };
    }
    if (t.type === "Рост %") {
      const target = parseFloat(t.targetValue);
      const growth = pos && pos.previousClose > 0
        ? ((pos.currentPrice - pos.previousClose) / pos.previousClose) * 100
        : 0;
      const fired = growth > target;
      const progress = Math.min(100, (Math.max(0, growth) / target) * 100);
      return { ...t, liveValue: `${growth.toFixed(2)}%`, fired, progress };
    }
    return { ...t, liveValue: t.currentValue, fired: false, progress: 0 };
  });

  const firedCount = evaluatedTriggers.filter((t) => t.fired).length;
  const activeCount = evaluatedTriggers.filter((t) => t.status === "Активен").length;
  const profitablePct = positions.filter((p) => p.type !== "Кэш").length > 0
    ? (positions.filter((p) => p.pnl > 0).length / positions.filter((p) => p.type !== "Кэш").length) * 100
    : 0;

  const recommendation = (() => {
    if (dailyChangePct < -3)
      return { label: "ДОКУПИТЬ", color: "#22c55e", desc: `Рынок упал на ${Math.abs(dailyChangePct).toFixed(2)}% — хорошая точка входа для докупки` };
    if (dailyChangePct < -1.5)
      return { label: "ОСТОРОЖНО", color: "#f59e0b", desc: `Портфель снизился на ${Math.abs(dailyChangePct).toFixed(2)}% за день. Следите за уровнями поддержки` };
    if (totalPnlPct > 25 && dailyChangePct > 1.5)
      return { label: "ФИКСАЦИЯ", color: "#ef4444", desc: `Доходность ${totalPnlPct.toFixed(1)}% + рост сегодня. Рассмотрите частичную фиксацию прибыли` };
    if (offTargetCount >= 2)
      return { label: "РЕБАЛАНС", color: "#3b82f6", desc: `${offTargetCount} позиции отклонились от цели более чем на 5%. Требуется ребалансировка` };
    if (profitablePct < 40)
      return { label: "ПЕРЕСМОТР", color: "#f97316", desc: `Только ${profitablePct.toFixed(0)}% позиций в прибыли. Проведите анализ убыточных позиций` };
    if (dailyChangePct > 1.5)
      return { label: "ДЕРЖАТЬ", color: "#22c55e", desc: `Портфель растёт (+${dailyChangePct.toFixed(2)}% за день). Сохраняйте текущую структуру` };
    return { label: "ДЕРЖАТЬ", color: "#9d6ef5", desc: "Портфель сбалансирован. Продолжайте следовать целевой стратегии" };
  })();

  const periodPnl: Record<string, { usd: number; pct: string; noData: boolean }> = useMemo(() => {
    // Get portfolio value at a given date using historical prices
    function portfolioValueOn(cutoffDate: string): number | null {
      if (!positions.length) return null;
      if (!histLoaded) return null; // still fetching
      if (Object.keys(histData).length === 0) return null; // no data → fall back to localStorage
      let val = 0;
      for (const p of positions) {
        if (p.type === "Кэш") { val += p.value; continue; }
        const hist = histData[p.ticker];
        if (!hist?.dates.length) {
          val += p.value; // no hist for this ticker — contributes 0 P&L for the period
          continue;
        }
        // Find last close on or before cutoffDate
        let idx = -1;
        for (let i = hist.dates.length - 1; i >= 0; i--) {
          if (hist.dates[i] <= cutoffDate) { idx = i; break; }
        }
        if (idx < 0) { val += p.value; continue; }
        val += p.qty * hist.closes[idx];
      }
      return val;
    }

    function diff(period: string) {
      if (portfolioTotal <= 0) return { usd: 0, pct: "0.00", noData: true };
      const cutoff = periodCutoff(period);

      // Try historical price data first
      const pastVal = portfolioValueOn(cutoff);
      if (pastVal !== null && pastVal > 0) {
        const usd = Math.round(portfolioTotal - pastVal);
        const pct = ((portfolioTotal - pastVal) / pastVal * 100).toFixed(2);
        return { usd, pct, noData: false };
      }

      // Fallback: localStorage snapshot history
      const pt = [...history].reverse().find(p => p.date <= cutoff);
      if (!pt) return { usd: 0, pct: "0.00", noData: true };
      const usd = Math.round(portfolioTotal - pt.value);
      const pct = pt.value > 0 ? ((portfolioTotal - pt.value) / pt.value * 100).toFixed(2) : "0.00";
      return { usd, pct, noData: false };
    }

    return {
      "1Д": diff("1Д"), "7Д": diff("7Д"), "1М": diff("1М"),
      "3М": diff("3М"), "6М": diff("6М"), "YTD": diff("YTD"),
      "1Г": diff("1Г"), "ВСЕ": diff("ВСЕ"),
    };
  }, [history, portfolioTotal, histData, histLoaded, positions]);

  const weightedBeta = useMemo(() => {
    if (portfolioTotal <= 0 || positions.length === 0) return 1.0;
    return positions.reduce((s, p) => s + (TICKER_BETA[p.ticker] ?? 1.0) * (p.value / portfolioTotal), 0);
  }, [positions, portfolioTotal]);

  const liveRiskLabel = useMemo(() => {
    const cryptoShare = positions.filter(p => p.type === "Крипто").reduce((s, p) => s + p.share, 0);
    if (weightedBeta > 1.3 || cryptoShare > 20) return "Высокий";
    if (weightedBeta < 0.8 && cryptoShare < 5) return "Низкий";
    return "Средний";
  }, [positions, weightedBeta]);

  const portfolioMaxDrawdown = useMemo(() => {
    if (history.length < 2) return 0;
    let peak = 0, maxDD = 0;
    history.forEach(p => {
      if (p.value > peak) peak = p.value;
      const dd = peak > 0 ? ((p.value - peak) / peak) * 100 : 0;
      if (dd < maxDD) maxDD = dd;
    });
    return Math.abs(maxDD);
  }, [history]);

  const var95_1d = useMemo(() => (weightedBeta * 1.2 * 1.645).toFixed(1), [weightedBeta]);
  const var95_10d = useMemo(() => (weightedBeta * 1.2 * 1.645 * Math.sqrt(10)).toFixed(1), [weightedBeta]);

  const sharpeRatio = useMemo(() => {
    if (totalCost <= 0 || positions.length === 0) return "–";
    const annReturn = ((portfolioTotal - totalCost) / totalCost) * 100;
    const annVol = Math.max(5, weightedBeta * 15);
    return ((annReturn - 5.0) / annVol).toFixed(2);
  }, [portfolioTotal, totalCost, weightedBeta, positions.length]);

  const diversificationLabel = useMemo(() => {
    const types = new Set(positions.filter(p => p.type !== "Кэш").map(p => p.type));
    const n = positions.filter(p => p.type !== "Кэш").length;
    if (n === 0) return "–";
    if (n >= 8 && types.size >= 3) return "Высокая";
    if (n >= 4) return "Средняя";
    return "Низкая";
  }, [positions]);

  const liveStressScenarios = useMemo(() => {
    if (portfolioTotal <= 0) return [];
    const beta = weightedBeta;
    const cryptoW = positions.filter(p => p.type === "Крипто").reduce((s, p) => s + p.value, 0) / portfolioTotal;
    return [
      { scenario: "Финансовый кризис (2008)", lossUsd: Math.round(portfolioTotal * -(beta * 35 + cryptoW * 30) / 100), lossPct: -(Math.round((beta * 35 + cryptoW * 30) * 10) / 10) },
      { scenario: "Пандемия (COVID-19)",       lossUsd: Math.round(portfolioTotal * -(beta * 22 + cryptoW * 25) / 100), lossPct: -(Math.round((beta * 22 + cryptoW * 25) * 10) / 10) },
      { scenario: "Инфляционный шок",           lossUsd: Math.round(portfolioTotal * -((1 - cryptoW) * 12 + 4) / 100), lossPct: -(Math.round(((1 - cryptoW) * 12 + 4) * 10) / 10) },
      { scenario: "Рецессия (мягкая)",           lossUsd: Math.round(portfolioTotal * -(beta * 8) / 100), lossPct: -(Math.round(beta * 80) / 10) },
      { scenario: "Бычий сценарий",              lossUsd: Math.round(portfolioTotal * (beta * 18 + cryptoW * 15) / 100), lossPct: Math.round((beta * 18 + cryptoW * 15) * 10) / 10 },
    ];
  }, [portfolioTotal, weightedBeta, positions]);

  const recentActions = useMemo(() =>
    liveSnapshots.slice(0, 5).map(s => ({ date: `${s.date} ${s.time}`, action: s.comment })),
    [liveSnapshots]
  );

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader title="ПОРТФЕЛЬ" subtitle="Главная сводка и управление портфелем" showSnapshot />

      <div style={{ padding: isMobile ? "12px" : "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Row 1: Summary */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1.5fr 1.2fr 1fr 1fr", gap: 12 }}>
          {/* Total */}
          <div className="card">
            <div className="card-title">Общая стоимость портфеля</div>
            <div className="metric-value">{portfolioTotal.toLocaleString("ru-RU")}</div>
            <div className="metric-label">USD</div>
            {(() => {
              const dailyChange = portfolioTotal - prevTotal;
              return (
                <div className={dailyChange >= 0 ? "positive" : "negative"} style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                  {dailyChange >= 0 ? "+" : ""}{Math.round(Math.abs(dailyChange)).toLocaleString("en-US")} ({dailyChange >= 0 ? "+" : ""}{dailyChangePct.toFixed(2)}%)
                </div>
              );
            })()}
            <div className="metric-label">Изменение за день</div>
          </div>

          {/* Dynamics */}
          <div className="card">
            <div className="card-title">Динамика портфеля</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {(() => {
                const dailyChange = portfolioTotal - prevTotal;
                return [
                  { label: "За день",       value: dailyChange,             pct: dailyChangePct,                   noData: false },
                  { label: "За неделю",     value: periodPnl["7Д"].usd,    pct: parseFloat(periodPnl["7Д"].pct),  noData: periodPnl["7Д"].noData },
                  { label: "За месяц",      value: periodPnl["1М"].usd,    pct: parseFloat(periodPnl["1М"].pct),  noData: periodPnl["1М"].noData },
                  { label: "За год (YTD)",  value: periodPnl["YTD"].usd,   pct: parseFloat(periodPnl["YTD"].pct), noData: periodPnl["YTD"].noData },
                ].map((m) => (
                  <div key={m.label} style={{ padding: "6px 8px", background: "var(--bg-secondary)", borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{m.label}</div>
                    {m.noData ? (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)" }}>–</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>нет данных</div>
                      </>
                    ) : (
                      <>
                        <div className={m.value >= 0 ? "positive" : "negative"} style={{ fontSize: 14, fontWeight: 700 }}>{m.value >= 0 ? "+" : ""}{Math.round(Math.abs(m.value)).toLocaleString("en-US")}</div>
                        <div className={m.pct >= 0 ? "positive" : "negative"} style={{ fontSize: 12 }}>{m.pct >= 0 ? "+" : ""}{Math.abs(m.pct).toFixed(2)}%</div>
                      </>
                    )}
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Structure */}
          {(() => {
            const groups: Record<string, { value: number; color: string }> = {};
            const typeColors: Record<string, string> = { ETF: "#7c3aed", Акция: "#3b82f6", Крипто: "#f59e0b", Сырьё: "#22c55e", Кэш: "#94a3b8", Облигация: "#06b6d4" };
            positions.forEach((p) => {
              const val = p.qty * p.currentPrice;
              if (!groups[p.type]) groups[p.type] = { value: 0, color: typeColors[p.type] ?? "#9d6ef5" };
              groups[p.type].value += val;
            });
            const total = Object.values(groups).reduce((s, g) => s + g.value, 0) || 1;
            const liveDist = Object.entries(groups).map(([name, g]) => ({ name, value: Math.round((g.value / total) * 100), color: g.color }));
            return (
              <div className="card">
                <div className="card-title">Структура портфеля</div>
                <ApexChart
                  type="donut"
                  height={115}
                  series={liveDist.map(d => d.value)}
                  options={{
                    labels: liveDist.map(d => d.name),
                    colors: liveDist.map(d => d.color),
                    chart: { background: "transparent", animations: { enabled: true, speed: 400 } },
                    stroke: { width: 2, colors: ["transparent"] },
                    dataLabels: { enabled: false },
                    legend: { show: false },
                    plotOptions: { pie: { donut: { size: "60%" } } },
                    tooltip: { theme: "dark", y: { formatter: (v: number) => `${v}%` } },
                    theme: { mode: "dark" },
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
                  {liveDist.map((e) => (
                    <div key={e.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 2 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: e.color, display: "inline-block", flexShrink: 0 }} />
                          <span style={{ color: "var(--text-secondary)" }}>{e.name}</span>
                        </span>
                        <span style={{ fontWeight: 700 }}>{e.value}%</span>
                      </div>
                      <div style={{ height: 3, background: "var(--border)", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${e.value}%`, background: e.color, borderRadius: 2, transition: "width 0.4s" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Risk */}
          <div className="card">
            <div className="card-title">Показатели риска</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[
                { label: "Уровень риска", value: positions.length > 0 ? liveRiskLabel : "–", color: "#f59e0b", hint: undefined },
                { label: "Бета (рынок)", value: positions.length > 0 ? weightedBeta.toFixed(2) : "–", hint: "Чувствительность к рынку. 1.0 = движется как S&P 500, >1 — волатильнее" },
                { label: "Макс. просадка", value: portfolioMaxDrawdown > 0 ? `${portfolioMaxDrawdown.toFixed(1)}%` : "–", color: "#ef4444", hint: "Максимальное снижение портфеля от пика за всё время" },
                { label: "VaR 95% / 1 день", value: positions.length > 0 ? `${var95_1d}%` : "–", color: "#ef4444", hint: "Value at Risk: с вероятностью 95% потери за 1 день не превысят эту величину" },
                { label: "VaR 95% / 10 дней", value: positions.length > 0 ? `${var95_10d}%` : "–", color: "#ef4444", hint: "Value at Risk за 10 торговых дней при доверительном интервале 95%" },
                { label: "Sharpe Ratio", value: sharpeRatio, color: sharpeRatio !== "–" && parseFloat(sharpeRatio) > 0 ? "#22c55e" : "#ef4444", hint: "Доходность сверх безрисковой ставки на единицу риска. >1 — хороший показатель" },
                { label: "Диверсификация", value: diversificationLabel, color: "#22c55e", hint: undefined },
              ].map((item) => (
                <div key={item.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                    <span style={{ fontWeight: 600, color: item.color ?? "var(--text-primary)" }}>{item.value}</span>
                  </div>
                  {item.hint && (
                    <div style={{ fontSize: 9, color: "var(--text-muted)", lineHeight: 1.3, marginTop: 1 }}>{item.hint}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recommendation */}
          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div className="card-title">Рекомендация</div>
            <div
              style={{
                width: 82, height: 82, borderRadius: "50%",
                border: `3px solid ${recommendation.color}`,
                boxShadow: `0 0 18px ${recommendation.color}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: recommendation.label.length > 7 ? 10 : 13,
                fontWeight: 700, color: recommendation.color,
                textAlign: "center", padding: 8,
                transition: "all 0.5s ease",
              }}
            >
              {recommendation.label}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.4 }}>
              {recommendation.desc}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 2 }}>
              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: dailyChangePct >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: dailyChangePct >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                День: {dailyChangePct >= 0 ? "+" : ""}{dailyChangePct.toFixed(2)}%
              </span>
              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: totalPnlPct >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: totalPnlPct >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                P&L: {totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Positions table + Target structure */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 12 }}>
          <div className="card" style={{ minWidth: 0 }}>
            {/* Table header with status + column picker */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Текущие позиции</div>
              <div style={{ display: "flex", gap: isMobile ? 4 : 6, alignItems: "center", flexWrap: "wrap" }}>
                {/* Market status */}
                <span style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
                  background: `${market.color}18`, color: market.color, display: "flex", alignItems: "center", gap: 4,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: market.color, display: "inline-block",
                    animation: market.state === "open" ? "pulse 1.5s infinite" : "none" }} />
                  {market.label}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{market.etTime} ET</span>
                {lastPriceT > 0 && (
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>· {formatEtTime(lastPriceT)}</span>
                )}
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
                  background: quoteStatus === "ok" ? "rgba(34,197,94,0.12)" : quoteStatus === "error" ? "rgba(239,68,68,0.12)" : "rgba(124,58,237,0.12)",
                  color: quoteStatus === "ok" ? "#22c55e" : quoteStatus === "error" ? "#ef4444" : "var(--accent-light)",
                }}>
                  {quoteStatus === "ok" ? "✓" : quoteStatus === "loading" ? "…" : quoteStatus === "error" ? "✗" : "–"}
                </span>

                {/* Save column order — hidden on mobile */}
                {!isMobile && (
                  <button
                    onClick={saveColView}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, cursor: "pointer",
                      background: colOrderSaved ? "rgba(34,197,94,0.15)" : "var(--bg-secondary)",
                      border: `1px solid ${colOrderSaved ? "#22c55e" : "var(--border)"}`,
                      color: colOrderSaved ? "#22c55e" : "var(--text-secondary)",
                      transition: "all 0.2s",
                      whiteSpace: "nowrap",
                    }}
                    title="Сохранить текущее расположение столбцов"
                  >
                    {colOrderSaved ? "✓ Сохранено" : "💾 Сохранить вид"}
                  </button>
                )}

                {/* Merge toggle */}
                <button
                  onClick={() => setMergeByTicker((v) => !v)}
                  style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, cursor: "pointer",
                    background: mergeByTicker ? "rgba(124,58,237,0.15)" : "var(--bg-secondary)",
                    border: `1px solid ${mergeByTicker ? "var(--accent)" : "var(--border)"}`,
                    color: mergeByTicker ? "var(--accent-light)" : "var(--text-secondary)",
                    whiteSpace: "nowrap",
                  }}
                  title={mergeByTicker ? "Показать по брокерам" : "Объединить одинаковые тикеры"}
                >
                  {isMobile ? "⊕" : mergeByTicker ? "⊕ Объединено" : "⊕ По брокерам"}
                </button>

                {/* Column picker */}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setColPickerOpen((o) => !o)}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, cursor: "pointer",
                      background: colPickerOpen ? "var(--accent)" : "var(--bg-secondary)",
                      border: "1px solid var(--border)", color: colPickerOpen ? "white" : "var(--text-secondary)",
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
                        <button onClick={() => { setVisibleCols(DEFAULT_COLS); setColOrder(ALL_COLS.map((c) => c.id)); }} style={{ flex: 1, fontSize: 10, padding: "4px", borderRadius: 5, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>
                          Сброс
                        </button>
                        <button onClick={() => setVisibleCols(new Set(ALL_COLS.map((c) => c.id)))} style={{ flex: 1, fontSize: 10, padding: "4px", borderRadius: 5, border: "1px solid var(--border)", background: "transparent", color: "var(--accent-light)", cursor: "pointer" }}>
                          Все
                        </button>
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
                    {colOrder
                      .map((id) => ALL_COLS.find((c) => c.id === id)!)
                      .filter((c) => c && visibleCols.has(c.id))
                      .map((c) => {
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

                    const cell = (id: ColId): React.ReactNode => {
                      switch (id) {
                        case "idx":          return <span style={{ color: "var(--text-secondary)" }}>{i + 1}</span>;
                        case "ticker":       return <span style={{ fontWeight: 700, color: p.color }}>{p.ticker}</span>;
                        case "name":         return <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{p.name}</span>;
                        case "qty":          return p.qty > 0 ? p.qty.toFixed(2) : "–";
                        case "avgPrice":     return p.avgPrice > 0 ? p.avgPrice.toFixed(2) : "–";
                        case "currentPrice": return (
                          <span style={{ fontWeight: 600, color: tick === "up" ? "#22c55e" : tick === "down" ? "#ef4444" : "var(--text-primary)" }}>
                            {p.currentPrice > 0 ? p.currentPrice.toFixed(2) : "–"}
                            {tick === "up" && <span style={{ marginLeft: 3, fontSize: 9 }}>▲</span>}
                            {tick === "down" && <span style={{ marginLeft: 3, fontSize: 9 }}>▼</span>}
                          </span>
                        );
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
                          const dev = p.share - p.targetShare;
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
                        {colOrder
                          .map((id) => ALL_COLS.find((c) => c.id === id)!)
                          .filter((c) => c && visibleCols.has(c.id))
                          .map((c) => (
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
                    const totalValue   = positions.reduce((s, p) => s + p.value, 0);
                    const totalPnl     = positions.reduce((s, p) => s + p.pnl, 0);
                    const totalCostAll = positions.reduce((s, p) => s + p.qty * p.avgPrice, 0);
                    const totalPnlPct  = totalCostAll > 0 ? (totalPnl / totalCostAll) * 100 : 0;
                    const totalDayUsd  = positions.reduce((s, p) => p.previousClose > 0 ? s + Math.round(p.qty * (p.currentPrice - p.previousClose)) : s, 0);
                    const prevTotalVal = positions.reduce((s, p) => p.previousClose > 0 ? s + p.qty * p.previousClose : s + p.value, 0);
                    const totalDayPct  = prevTotalVal > 0 ? (totalDayUsd / prevTotalVal) * 100 : 0;

                    const orderedVisible = colOrder.map((id) => ALL_COLS.find((c) => c.id === id)!).filter((c) => c && visibleCols.has(c.id));

                    const footerCell = (id: ColId): React.ReactNode => {
                      switch (id) {
                        case "idx":          return null;
                        case "ticker":       return <span style={{ fontWeight: 700, fontSize: 11, color: "var(--text-secondary)" }}>ИТОГО</span>;
                        case "name":         return null;
                        case "qty":          return null;
                        case "avgPrice":     return null;
                        case "currentPrice": return null;
                        case "value":        return <span style={{ fontWeight: 700 }}>{totalValue.toLocaleString("en-US")}</span>;
                        case "pnl":          return <span style={{ fontWeight: 700, color: totalPnl >= 0 ? "#22c55e" : "#ef4444" }}>{totalPnl >= 0 ? "+" : ""}{totalPnl.toLocaleString("en-US")}</span>;
                        case "pnlPct":       return <span style={{ fontWeight: 700, color: totalPnlPct >= 0 ? "#22c55e" : "#ef4444" }}>{totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%</span>;
                        case "share":        return <span style={{ color: "var(--text-secondary)" }}>100%</span>;
                        case "dayUsd":       return <span style={{ fontWeight: 700, color: totalDayUsd >= 0 ? "#22c55e" : "#ef4444" }}>{totalDayUsd >= 0 ? "+" : ""}{totalDayUsd.toLocaleString("en-US")}</span>;
                        case "dayPct":       return <span style={{ fontWeight: 700, color: totalDayPct >= 0 ? "#22c55e" : "#ef4444" }}>{totalDayPct >= 0 ? "+" : ""}{totalDayPct.toFixed(2)}%</span>;
                        default:             return null;
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

          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Целевая структура</div>
              <span style={{ fontSize: 9, color: "var(--text-muted)" }}>равновзвешенная</span>
            </div>

            {/* Summary row */}
            {(() => {
              const nonCashItems = positions.filter(p => p.type !== "Кэш");
              const eqTarget = nonCashItems.length > 0 ? parseFloat((100 / nonCashItems.length).toFixed(2)) : 0;
              const rows = positions.map(p => {
                const target = p.type === "Кэш" ? p.share : eqTarget;
                const dev = p.share - target;
                return { id: p.id, ticker: p.ticker, target, liveShare: p.share, dev, color: p.color, type: p.type };
              });
              const ok = rows.filter(r => r.type !== "Кэш" && Math.abs(r.dev) <= 1.5).length;
              const under = rows.filter(r => r.type !== "Кэш" && r.dev < -1.5).length;
              const over = rows.filter(r => r.type !== "Кэш" && r.dev > 1.5).length;
              const maxScale = rows.length > 0 ? Math.max(...rows.map(r => Math.max(r.liveShare, r.target))) * 1.15 : 100;

              return (
                <>
                  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(34,197,94,0.12)", color: "#22c55e", fontWeight: 600 }}>✓ {ok} в норме</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(59,130,246,0.12)", color: "#3b82f6", fontWeight: 600 }}>↓ {under} недовес</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "rgba(239,68,68,0.12)", color: "#ef4444", fontWeight: 600 }}>↑ {over} перевес</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", maxHeight: 340 }}>
                    {rows.map((t) => {
                      const isOver = t.dev > 1.5;
                      const isUnder = t.dev < -1.5;
                      const barColor = isOver ? "#ef4444" : isUnder ? "#3b82f6" : "#22c55e";
                      const action = isOver ? "СОКРАТИТЬ" : isUnder ? "ДОКУПИТЬ" : "ДЕРЖАТЬ";
                      const actionColor = isOver ? "#ef4444" : isUnder ? "#3b82f6" : "#22c55e";
                      const fillPct = Math.min(100, (t.liveShare / maxScale) * 100);
                      const targetPct = Math.min(100, (t.target / maxScale) * 100);

                      return (
                        <div key={t.id} style={{ padding: "8px 10px", background: "var(--bg-secondary)", borderRadius: 8, border: `1px solid var(--border)` }}>
                          {/* Top row */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, fontWeight: 700 }}>{t.ticker}</span>
                              <span style={{
                                fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3,
                                background: isOver ? "rgba(239,68,68,0.12)" : isUnder ? "rgba(59,130,246,0.12)" : "rgba(34,197,94,0.12)",
                                color: barColor,
                              }}>
                                {isOver ? "ПЕРЕВЕС" : isUnder ? "НЕДОВЕС" : "НОРМА"}
                              </span>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: actionColor }}>{action}</span>
                          </div>

                          {/* Bar with target marker */}
                          <div style={{ position: "relative", height: 8, background: "var(--border)", borderRadius: 4, overflow: "visible", marginBottom: 4 }}>
                            {/* Current fill */}
                            <div style={{
                              position: "absolute", left: 0, top: 0, height: "100%",
                              width: `${fillPct}%`,
                              background: barColor,
                              borderRadius: 4,
                              transition: "width 0.5s ease",
                              opacity: 0.85,
                            }} />
                            {/* Target marker line */}
                            <div style={{
                              position: "absolute", top: -3, bottom: -3,
                              left: `${targetPct}%`,
                              width: 2,
                              background: "#f59e0b",
                              borderRadius: 1,
                              zIndex: 2,
                            }} />
                          </div>

                          {/* Bottom numbers */}
                          {(() => {
                            const diffUsd = Math.round(((t.target - t.liveShare) / 100) * portfolioTotal);
                            const needBuy = diffUsd > 0;
                            const diffColor = needBuy ? "#3b82f6" : t.dev === 0 ? "#22c55e" : "#ef4444";
                            return (
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ display: "flex", gap: 10, fontSize: 10 }}>
                                  <span style={{ color: "var(--text-secondary)" }}>
                                    Факт: <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{t.liveShare.toFixed(2)}%</span>
                                  </span>
                                  <span style={{ color: "var(--text-secondary)" }}>
                                    Цель: <span style={{ color: "#f59e0b", fontWeight: 600 }}>{t.target.toFixed(2)}%</span>
                                  </span>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: t.dev >= 0 ? "#22c55e" : "#ef4444" }}>
                                    {t.dev >= 0 ? "+" : ""}{t.dev.toFixed(2)}pp
                                  </span>
                                  {diffUsd !== 0 && (
                                    <span style={{ fontSize: 9, fontWeight: 600, color: diffColor }}>
                                      {needBuy ? "▲ докупить" : "▼ продать"} ${Math.abs(diffUsd).toLocaleString("en-US")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Row 3: Buy ladder + Triggers + Snapshots */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
          {(() => {
            const allTickers = positions.filter(p => p.type !== "Кэш");
            const selectedPositions = allTickers.filter(p => ladderTickers.includes(p.ticker));
            const levels = Array.from({ length: ladderLevels }, (_, i) => (i + 1) * ladderStep);

            return (
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div className="card-title" style={{ marginBottom: 0 }}>Лесенка докупки</div>
                  <button onClick={() => setLadderExpanded(o => !o)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>
                    {ladderExpanded ? "▲ Свернуть" : "⚙ Настройки"}
                  </button>
                </div>

                {ladderExpanded && (
                  <div style={{ marginBottom: 12, padding: "10px 12px", background: "var(--bg-secondary)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                      <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                        Шаг (%):
                        <input type="number" min={1} max={20} value={ladderStep} onChange={e => setLadderStep(Number(e.target.value))}
                          style={{ width: 52, padding: "3px 6px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }} />
                      </label>
                      <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                        Уровней:
                        <input type="number" min={1} max={8} value={ladderLevels} onChange={e => setLadderLevels(Number(e.target.value))}
                          style={{ width: 52, padding: "3px 6px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }} />
                      </label>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5 }}>Инструменты:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {allTickers.map(p => (
                          <button key={p.id} onClick={() => setLadderTickers(prev => prev.includes(p.ticker) ? prev.filter(t => t !== p.ticker) : [...prev, p.ticker])}
                            style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${ladderTickers.includes(p.ticker) ? p.color : "var(--border)"}`, background: ladderTickers.includes(p.ticker) ? `${p.color}22` : "transparent", color: ladderTickers.includes(p.ticker) ? p.color : "var(--text-secondary)", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                            {p.ticker}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                        <th style={{ padding: "4px 6px", textAlign: "left" }}>Тикер</th>
                        <th style={{ padding: "4px 6px", textAlign: "right" }}>Текущая</th>
                        {levels.map(l => (
                          <th key={l} style={{ padding: "4px 6px", textAlign: "right", color: "#f59e0b" }}>−{l}%</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPositions.map(p => {
                        const current = p.currentPrice || p.avgPrice;
                        return (
                          <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "6px", fontWeight: 700, color: p.color }}>{p.ticker}</td>
                            <td style={{ padding: "6px", textAlign: "right", fontWeight: 600 }}>{current.toFixed(2)}</td>
                            {levels.map(l => (
                              <td key={l} style={{ padding: "6px", textAlign: "right", color: l <= ladderStep ? "#f59e0b" : "#ef4444" }}>
                                {(current * (1 - l / 100)).toFixed(2)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                      {selectedPositions.length === 0 && (
                        <tr><td colSpan={2 + ladderLevels} style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>Выберите инструменты в настройках</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Триггеры действий</div>
              <div style={{ display: "flex", gap: 5 }}>
                {firedCount > 0 && (
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "rgba(239,68,68,0.15)", color: "#ef4444", fontWeight: 700 }}>
                    ● {firedCount} сработал{firedCount > 1 ? "о" : ""}
                  </span>
                )}
                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "rgba(34,197,94,0.1)", color: "#22c55e", fontWeight: 600 }}>
                  {activeCount} активных
                </span>
              </div>
            </div>

            {/* Unread alert banner */}
            {triggerAlerts.filter((a) => !a.read).length > 0 && (
              <div style={{ marginBottom: 8, padding: "7px 10px", background: "rgba(239,68,68,0.08)", border: "1px solid #ef444435", borderRadius: 7 }}>
                {triggerAlerts.filter((a) => !a.read).map((a) => (
                  <div key={a.id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 10 }}>
                    <span style={{ color: "#ef4444", fontSize: 14, lineHeight: 1 }}>!</span>
                    <span style={{ color: "#ef4444", fontWeight: 700 }}>{a.ticker}</span>
                    <span style={{ color: "var(--text-secondary)" }}>{a.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Trigger list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {evaluatedTriggers.map((t) => {
                const priorityColor: Record<string, string> = {
                  "Критический": "#ef4444", "Высокий": "#f59e0b", "Средний": "#7c3aed", "Низкий": "#94a3b8",
                };
                const isInactive = t.status === "Неактивен";
                const isClose = !t.fired && t.progress > 60;

                // Human-readable "if → then" explanation
                const actionMap: Record<string, string> = {
                  "Цена ниже":        "покупать",
                  "Цена выше":        "фиксировать",
                  "Просадка %":       "стоп / докупить",
                  "Просадка портфеля":"сократить риск",
                  "Рост %":           "частично продать",
                  "Объём":            "проверить позицию",
                };
                const actionHint = actionMap[t.type] ?? "действовать";

                // Distance to trigger as formatted string
                const distLabel = (() => {
                  if (t.fired) return "УСЛОВИЕ ВЫПОЛНЕНО";
                  if (isInactive) return "выключен";
                  const pct = Math.max(0, 100 - t.progress);
                  return `до цели ${pct.toFixed(0)}%`;
                })();

                const barColor = t.fired ? "#ef4444" : isClose ? "#f59e0b" : "#3b82f6";

                return (
                  <div key={t.id} style={{
                    borderRadius: 8,
                    border: `1px solid ${t.fired ? "#ef444450" : isClose ? "#f59e0b30" : "var(--border)"}`,
                    background: t.fired ? "rgba(239,68,68,0.06)" : isClose ? "rgba(245,158,11,0.04)" : "var(--bg-secondary)",
                    opacity: isInactive ? 0.5 : 1,
                    overflow: "hidden",
                  }}>
                    {/* Top: ticker + what to watch + status */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px 4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, color: "white", flexShrink: 0 }}>
                          {t.ticker.slice(0, 3)}
                        </div>
                        <div>
                          <span style={{ fontSize: 11, fontWeight: 700 }}>{t.ticker}</span>
                          <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: 5 }}>{t.type}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 9, color: priorityColor[t.priority] ?? "#94a3b8", fontWeight: 600 }}>
                          {t.priority}
                        </span>
                        {t.fired ? (
                          <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: "#ef4444", color: "white", fontWeight: 700, letterSpacing: "0.04em" }}>
                            СРАБОТАЛ
                          </span>
                        ) : isInactive ? (
                          <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: "var(--border)", color: "#94a3b8", fontWeight: 600 }}>ВЫКЛ</span>
                        ) : (
                          <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: "rgba(34,197,94,0.12)", color: "#22c55e", fontWeight: 600 }}>ЖДЁМ</span>
                        )}
                      </div>
                    </div>

                    {/* Middle: if → then readable line */}
                    {!isInactive && (
                      <div style={{ padding: "0 10px 5px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                          Если{" "}
                          <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{t.condition}</span>
                          {" "}→{" "}
                          <span style={{ color: "var(--accent-light)", fontWeight: 600 }}>{actionHint}</span>
                        </div>
                        <div style={{ display: "flex", gap: 10, fontSize: 10 }}>
                          <span style={{ color: "var(--text-secondary)" }}>
                            Сейчас: <span style={{ fontWeight: 700, color: t.fired ? "#ef4444" : "var(--text-primary)" }}>{t.liveValue}</span>
                          </span>
                          <span style={{ color: "var(--text-secondary)" }}>
                            Цель: <span style={{ fontWeight: 700, color: "#f59e0b" }}>{t.targetValue}</span>
                          </span>
                          <span style={{ fontWeight: 600, color: t.fired ? "#ef4444" : isClose ? "#f59e0b" : "var(--text-secondary)" }}>
                            {distLabel}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Bottom: progress bar */}
                    {!isInactive && (
                      <div style={{ height: 3, background: "var(--border)" }}>
                        <div style={{ height: "100%", width: `${t.progress}%`, background: barColor, transition: "width 0.5s ease" }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Снапшоты портфеля</div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{liveSnapshots.length} записей</span>
                <button onClick={() => setSnapshotExpanded(o => !o)} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>
                  {snapshotExpanded ? "▲" : "▼"}
                </button>
              </div>
            </div>

            {/* Latest snapshot highlight */}
            {liveSnapshots.length === 0 ? (
              <div style={{ padding: "16px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                Нет снапшотов.<br />Нажмите «Фиксировать» в шапке страницы.
              </div>
            ) : (() => {
              const latest = liveSnapshots[0];
              const prev = liveSnapshots[1];
              const diff = prev ? latest.capital - prev.capital : 0;
              return (
                <div style={{ padding: "10px 12px", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border)", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 2 }}>Последняя фиксация · {latest.date} {latest.time}</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>${latest.capital.toLocaleString("en-US")}</div>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{latest.comment}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>{latest.profitPct}</div>
                      {prev && (
                        <div style={{ fontSize: 10, color: diff >= 0 ? "#22c55e" : "#ef4444" }}>
                          {diff >= 0 ? "+" : ""}{diff.toLocaleString("en-US")} vs пред.
                        </div>
                      )}
                    </div>
                  </div>
                  {liveSnapshots.length >= 2 && (() => {
                    const snapData = liveSnapshots.slice(0, 8).reverse().map(s => s.capital);
                    return (
                      <ApexChart
                        type="area"
                        height={44}
                        series={[{ data: snapData }]}
                        options={{
                          chart: { type: "area", toolbar: { show: false }, background: "transparent", sparkline: { enabled: true }, animations: { enabled: false } },
                          stroke: { curve: "smooth", width: 1.5, colors: ["#22c55e"] },
                          fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0, stops: [0, 100], colorStops: [{ offset: 0, color: "#22c55e", opacity: 0.3 }, { offset: 100, color: "#22c55e", opacity: 0 }] } },
                          tooltip: { theme: "dark", fixed: { enabled: false }, y: { formatter: (v: number) => `$${Number(v).toLocaleString("en-US")}` } },
                          dataLabels: { enabled: false },
                          theme: { mode: "dark" },
                        }}
                      />
                    );
                  })()}
                </div>
              );
            })()}

            {/* History list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, overflowY: "auto", maxHeight: snapshotExpanded ? 500 : 200 }}>
              {liveSnapshots.map((s, i) => {
                const prevCap = liveSnapshots[i + 1]?.capital ?? s.capital;
                const delta = s.capital - prevCap;
                const isEditing = editingSnap === i;
                return (
                  <div key={s.date + s.time + i} style={{ borderRadius: 6, background: i === 0 ? "rgba(124,58,237,0.08)" : "transparent", border: i === 0 ? "1px solid rgba(124,58,237,0.2)" : "1px solid var(--border)", overflow: "hidden" }}>
                    {isEditing ? (
                      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            value={editSnapVal.comment}
                            onChange={e => setEditSnapVal(v => ({ ...v, comment: e.target.value }))}
                            placeholder="Комментарий"
                            style={{ flex: 1, fontSize: 11, padding: "4px 8px", borderRadius: 5, border: "1px solid var(--accent)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
                          />
                          <input
                            value={editSnapVal.capital}
                            onChange={e => setEditSnapVal(v => ({ ...v, capital: e.target.value }))}
                            placeholder="Капитал $"
                            type="number"
                            style={{ width: 90, fontSize: 11, padding: "4px 8px", borderRadius: 5, border: "1px solid var(--accent)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            onClick={() => setEditingSnap(null)}
                            style={{ fontSize: 10, padding: "3px 10px", borderRadius: 5, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}
                          >Отмена</button>
                          <button
                            onClick={() => {
                              const updated = liveSnapshots.map((snap, idx) => idx === i ? {
                                ...snap,
                                comment: editSnapVal.comment || snap.comment,
                                capital: Number(editSnapVal.capital) || snap.capital,
                              } : snap);
                              setLiveSnapshots(updated);
                              try { localStorage.setItem("snapshots-data", JSON.stringify(updated)); } catch {}
                              setEditingSnap(null);
                            }}
                            style={{ fontSize: 10, padding: "3px 10px", borderRadius: 5, border: "none", background: "var(--accent)", color: "white", cursor: "pointer" }}
                          >Сохранить</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 8px" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: i === 0 ? "var(--accent)" : "var(--border)", flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 10, fontWeight: 600 }}>{s.date} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{s.time}</span></div>
                            <div style={{ fontSize: 9, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130 }}>{s.comment}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 11, fontWeight: 700 }}>${s.capital.toLocaleString("en-US")}</div>
                            <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center" }}>
                              <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 600 }}>{s.profitPct}</span>
                              {i < liveSnapshots.length - 1 && (
                                <span style={{ fontSize: 9, color: delta >= 0 ? "#22c55e" : "#ef4444" }}>
                                  {delta >= 0 ? "▲" : "▼"}{Math.abs(delta).toLocaleString("en-US")}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => { setEditingSnap(i); setEditSnapVal({ comment: s.comment, capital: String(s.capital) }); }}
                            title="Редактировать"
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-muted)", fontSize: 12, lineHeight: 1 }}
                          >✏️</button>
                          <button
                            onClick={() => {
                              const updated = liveSnapshots.filter((_, idx) => idx !== i);
                              setLiveSnapshots(updated);
                              try { localStorage.setItem("snapshots-data", JSON.stringify(updated)); } catch {}
                            }}
                            title="Удалить"
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#ef4444", fontSize: 12, lineHeight: 1 }}
                          >✕</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 4: Chart + Pie + Stress + Recent actions */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr 1fr 0.8fr", gap: 12 }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div>
                <div className="card-title" style={{ marginBottom: 2 }}>Динамика портфеля</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{portfolioTotal.toLocaleString("en-US")} USD</span>
                  {periodPnl[period].noData ? (
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>нет данных за период</span>
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 600, color: periodPnl[period].usd >= 0 ? "#22c55e" : "#ef4444" }}>
                      {periodPnl[period].usd >= 0 ? "+" : ""}{periodPnl[period].usd.toLocaleString("en-US")} ({periodPnl[period].usd >= 0 ? "+" : ""}{periodPnl[period].pct}%)
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 10, height: 2, background: "#7c3aed", display: "inline-block", borderRadius: 2 }} />
                    Стоимость портфеля
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 10, height: 2, background: "#f59e0b", display: "inline-block", borderRadius: 2, opacity: 0.8 }} />
                    Вложено
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    P/L: <span style={{ color: (portfolioTotal - totalCost) >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                      {(portfolioTotal - totalCost) >= 0 ? "+" : ""}{(portfolioTotal - totalCost).toLocaleString("en-US")} USD
                    </span>
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 260 }}>
                {periodOptions.map((p) => (
                  <button key={p} className={`tab-btn ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            {chartData.length < 2 ? (
              <div style={{ height: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-muted)" }}>
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} opacity={0.4}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <span style={{ fontSize: 12, opacity: 0.6 }}>История накапливается — заходи каждый день</span>
                <span style={{ fontSize: 10, opacity: 0.4 }}>Сегодняшняя точка уже сохранена</span>
              </div>
            ) : (
              <ApexChart
                type="area"
                height={185}
                series={[
                  { name: "Стоимость", data: chartData.map(d => d.value) },
                  { name: "Вложено",   data: chartData.map(d => d.invested) },
                ]}
                options={{
                  chart: { type: "area", toolbar: { show: false }, background: "transparent", animations: { enabled: true, speed: 500 } },
                  stroke: { curve: "smooth", width: [2, 1.5], dashArray: [0, 5], colors: ["#8b5cf6", "#f59e0b"] },
                  fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: [0.3, 0.1], opacityTo: [0, 0], stops: [0, 100] } },
                  colors: ["#8b5cf6", "#f59e0b"],
                  xaxis: { categories: chartData.map(d => d.date), labels: { style: { fontSize: "9px", colors: "#888" } }, axisBorder: { show: false }, axisTicks: { show: false }, tickAmount: 6 },
                  yaxis: { labels: { formatter: (v: number) => `$${(v / 1000).toFixed(0)}K`, style: { fontSize: "9px", colors: "#888" } }, tickAmount: 4 },
                  grid: { borderColor: "rgba(255,255,255,0.06)", strokeDashArray: 3, xaxis: { lines: { show: false } }, padding: { left: 0, right: 0 } },
                  tooltip: { theme: "dark", y: { formatter: (v: number) => `$${Number(v).toLocaleString("en-US")}` } },
                  legend: { show: true, position: "top", horizontalAlign: "right", fontSize: "10px", labels: { colors: "#888" }, markers: { size: 4 } },
                  dataLabels: { enabled: false },
                  markers: { size: 0, hover: { size: 4 } },
                  theme: { mode: "dark" },
                }}
              />
            )}
          </div>

          {(() => {
            const typeColors2: Record<string, string> = { ETF: "#7c3aed", Акция: "#3b82f6", Крипто: "#f59e0b", Сырьё: "#22c55e", Кэш: "#94a3b8", Облигация: "#06b6d4" };
            const groups2: Record<string, { value: number; color: string }> = {};
            positions.forEach((p) => {
              const val = p.qty * p.currentPrice;
              if (!groups2[p.type]) groups2[p.type] = { value: 0, color: typeColors2[p.type] ?? "#9d6ef5" };
              groups2[p.type].value += val;
            });
            const total2 = Object.values(groups2).reduce((s, g) => s + g.value, 0) || 1;
            const liveDist2 = Object.entries(groups2).map(([name, g]) => ({ name, value: Math.round((g.value / total2) * 100), color: g.color }));
            return (
              <div className="card">
                <div className="card-title">Распределение активов</div>
                <ApexChart
                  type="donut"
                  height={125}
                  series={liveDist2.map(d => d.value)}
                  options={{
                    labels: liveDist2.map(d => d.name),
                    colors: liveDist2.map(d => d.color),
                    chart: { background: "transparent", animations: { enabled: true, speed: 400 } },
                    stroke: { width: 2, colors: ["transparent"] },
                    dataLabels: { enabled: false },
                    legend: { show: false },
                    plotOptions: { pie: { donut: { size: "58%" } } },
                    tooltip: { theme: "dark", y: { formatter: (v: number) => `${v}%` } },
                    theme: { mode: "dark" },
                  }}
                />
                <div style={{ marginTop: 8 }}>
                  {liveDist2.map((e) => (
                    <div key={e.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.color, display: "inline-block" }} />
                        <span style={{ color: "var(--text-secondary)" }}>{e.name}</span>
                      </span>
                      <span style={{ fontWeight: 600 }}>{e.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="card">
            <div className="card-title">Анализ риска (стресс-сценарии)</div>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "4px 6px", textAlign: "left" }}>Сценарий</th>
                  <th style={{ padding: "4px 6px", textAlign: "right" }}>Падение</th>
                  <th style={{ padding: "4px 6px", textAlign: "right" }}>Просадка</th>
                </tr>
              </thead>
              <tbody>
                {liveStressScenarios.map((s) => (
                  <tr key={s.scenario} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px", color: "var(--text-secondary)" }}>{s.scenario.split("(")[0].trim()}</td>
                    <td style={{ padding: "6px", textAlign: "right", color: s.lossUsd >= 0 ? "#22c55e" : "#ef4444" }}>
                      {s.lossUsd >= 0 ? "+" : ""}{(s.lossUsd / 1000).toFixed(0)}K
                    </td>
                    <td style={{ padding: "6px", textAlign: "right", color: s.lossPct >= 0 ? "#22c55e" : "#ef4444" }}>
                      {s.lossPct >= 0 ? "+" : ""}{s.lossPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-title">Последние действия</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recentActions.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: "8px 0" }}>
                  Нет записей.<br />Используйте «Фиксировать» в шапке.
                </div>
              ) : recentActions.map((a) => (
                <div key={a.date} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", marginTop: 4, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: "var(--text-secondary)", fontSize: 10 }}>{a.date}</div>
                    <div>{a.action}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Action tooltip */}
      {actionTooltip && (() => {
        const p = positions.find((pos) => pos.id === actionTooltip.id);
        if (!p) return null;
        const dev = p.share - p.targetShare;
        const actionColor =
          p.action === "ДОКУПИТЬ" ? "#22c55e" :
          p.action === "СОКРАТИТЬ" ? "#ef4444" :
          p.action === "ФИКСИРОВАТЬ" ? "#f59e0b" :
          "var(--accent-light)";

        const reasons: { label: string; value: string; color?: string }[] = [];

        // Reason 1: P/L
        reasons.push({
          label: "P/L позиции",
          value: `${p.pnlPct >= 0 ? "+" : ""}${p.pnlPct.toFixed(2)}% (${p.pnl >= 0 ? "+" : ""}$${p.pnl.toLocaleString("en-US")})`,
          color: p.pnlPct >= 0 ? "#22c55e" : "#ef4444",
        });

        // Reason 2: target deviation
        reasons.push({
          label: "Откл. от цели",
          value: `${p.share.toFixed(2)}% / цель ${p.targetShare.toFixed(2)}% (${dev >= 0 ? "+" : ""}${dev.toFixed(2)}pp)`,
          color: Math.abs(dev) <= 1.5 ? "#22c55e" : dev > 0 ? "#22c55e" : "#ef4444",
        });

        // Reason 3: price context
        if (p.avgPrice > 0) {
          reasons.push({
            label: "Цена",
            value: `Тек. $${p.currentPrice.toFixed(2)} / Ср. $${p.avgPrice.toFixed(2)}`,
          });
        }

        // Why this action
        const why =
          p.action === "ДОКУПИТЬ" ? `Позиция недовешена (${dev.toFixed(2)}pp ниже цели). Добавить до целевой доли.` :
          p.action === "СОКРАТИТЬ" ? `Позиция перевешена (+${dev.toFixed(2)}pp). Частичная продажа восстановит баланс.` :
          p.action === "ФИКСИРОВАТЬ" ? `Значительная прибыль (+${p.pnlPct.toFixed(2)}%). Рекомендуется зафиксировать часть.` :
          `Позиция сбалансирована. Отклонение ${Math.abs(dev).toFixed(2)}pp — в допустимых пределах.`;

        return (
          <div
            style={{
              position: "fixed",
              left: Math.min(actionTooltip.x, window.innerWidth - 280),
              top: actionTooltip.y,
              zIndex: 9999,
              background: "var(--bg-card)",
              border: `1px solid ${actionColor}55`,
              borderRadius: 10,
              padding: "10px 14px",
              width: 260,
              boxShadow: `0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px ${actionColor}22`,
              pointerEvents: "none",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
              <span style={{ fontWeight: 700, fontSize: 12 }}>{p.ticker}</span>
              <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 4, background: `${actionColor}20`, color: actionColor }}>
                {p.action}
              </span>
            </div>

            {/* Why */}
            <div style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
              {why}
            </div>

            {/* Reasons */}
            {reasons.map((r) => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
                <span style={{ color: "var(--text-muted)" }}>{r.label}</span>
                <span style={{ fontWeight: 600, color: r.color ?? "var(--text-primary)" }}>{r.value}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
