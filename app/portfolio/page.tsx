"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import { DailyAlertBadge } from "@/components/DailyAlert";
import { useMobile } from "@/lib/useMobile";
import { useMarketStatus, formatEtTime } from "@/lib/marketStatus";
import { useApp } from "@/lib/useApp";
import ApexChart from "@/components/ApexChart";
import {
  BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine, CartesianGrid,
} from "recharts";

import type { LivePosition, ColId, ChartPoint, Snapshot } from "./types";
import {
  POSITION_COLORS,
  COLORS,
  TICKER_BETA,
  PURCHASE_DATES,
  ALL_COLS,
  DEFAULT_COLS,
  DEFAULT_LADDER_STEP,
  DEFAULT_LADDER_LEVELS,
  PERIOD_OPTIONS as periodOptions,
  LS_CHART,
} from "./constants";
import { recompute, dAgoLabel, periodCutoff, fmtDate } from "./utils";
import { SummaryRow } from "./sections/SummaryRow";
import { PositionsTable } from "./sections/PositionsTable";
import { TargetStructure } from "./sections/TargetStructure";
import { BuyLadder } from "./sections/BuyLadder";
import { Snapshots } from "./sections/Snapshots";
import { ChartsRow } from "./sections/ChartsRow";
import { ActionTooltip } from "./sections/ActionTooltip";

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
  // Excludes currentPrice so the live-quote sync effect doesn't cause an infinite loop.
  const positionsKey = positions.map((p) => `${p.id}:${p.ticker}:${p.qty}:${p.avgPrice}`).join("|");
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
  const [actionTooltip, setActionTooltip] = useState<{ id: number; x: number; y: number } | null>(null);
  const [ladderStep, setLadderStep] = useState(() => { try { const s = localStorage.getItem("ladder-step"); return s ? Number(s) : DEFAULT_LADDER_STEP; } catch { return DEFAULT_LADDER_STEP; } });
  const [ladderLevels, setLadderLevels] = useState(() => { try { const s = localStorage.getItem("ladder-levels"); return s ? Number(s) : DEFAULT_LADDER_LEVELS; } catch { return DEFAULT_LADDER_LEVELS; } });
  const [ladderSaved, setLadderSaved] = useState(false);
  const [ladderTickers, setLadderTickers] = useState<string[]>([]);
  const [ladderExpanded, setLadderExpanded] = useState(false);
  const [snapshotExpanded, setSnapshotExpanded] = useState(false);
  const [editingSnap, setEditingSnap] = useState<number | null>(null);
  const [editSnapVal, setEditSnapVal] = useState<{ comment: string; capital: string }>({ comment: "", capital: "" });
  const [mergeByTicker, setMergeByTicker] = useState(true);

  const displayPositions = useMemo(() => {
    if (!mergeByTicker) return positions.filter(p => p.value >= 10);
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
    return recompute([...map.values()]).filter(p => p.value >= 10);
  }, [positions, mergeByTicker]);

  const fetchQuotes = useCallback(async (current: LivePosition[]) => {
    const stockPositions = current.filter((p) => p.live && p.type !== "Крипто");
    const cryptoPositions = current.filter((p) => p.live && p.type === "Крипто");
    if (stockPositions.length === 0 && cryptoPositions.length === 0) return;

    setQuoteStatus("loading");
    try {
      const allData: Record<string, { current: number; previousClose: number; t?: number; marketState?: string; futureSymbol?: string; futurePct?: number }> = {};

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
            return { ...p, currentPrice: q.current, previousClose: q.previousClose, marketState: q.marketState, futureSymbol: q.futureSymbol, futurePct: q.futurePct };
          })
        )
      );
      setQuoteStatus("ok");
    } catch {
      setQuoteStatus("error");
    }
  }, []);

  // Sync live quotes from AppContext — updates both prices and tick direction.
  useEffect(() => {
    if (!Object.keys(app.liveQuotes).length || !positions.length) return;
    let anyChange = false;
    const tickUpdates: Record<number, "up" | "down" | null> = {};
    const updated = positions.map(p => {
      const q = app.liveQuotes[p.ticker];
      if (!q || q.current <= 0) return p;
      tickUpdates[p.id] = q.current > p.currentPrice ? "up" : q.current < p.currentPrice ? "down" : null;
      if (q.current === p.currentPrice) return p;
      anyChange = true;
      return { ...p, currentPrice: q.current, previousClose: q.previousClose, marketState: q.marketState, futureSymbol: q.futureSymbol, futurePct: q.futurePct };
    });
    if (anyChange) app.setPositions(recompute(updated) as any);
    setLastTick(prev => ({ ...prev, ...tickUpdates }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.liveQuotes, positionsKey]);

  const [histData, setHistData] = useState<Record<string, { dates: string[]; closes: number[] }>>({});
  const [histLoaded, setHistLoaded] = useState(false);

  useEffect(() => {
    const initial = positions;
    setLadderTickers(initial.filter(p => p.type !== "Кэш").map(p => p.ticker).slice(0, 5));
    if (initial.length > 0) fetchQuotes(initial);
    const id = setInterval(() => {
      if (initial.length > 0) fetchQuotes(initial);
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
  }, [fetchQuotes, positionsKey]);

  

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
      <PageHeader title="ПОРТФЕЛЬ" subtitle="Главная сводка и управление портфелем" showSnapshot titleBadge={<DailyAlertBadge />} />

      <div style={{ padding: isMobile ? "12px" : "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <SummaryRow
          positions={positions}
          portfolioTotal={portfolioTotal}
          prevTotal={prevTotal}
          dailyChangePct={dailyChangePct}
          totalPnlPct={totalPnlPct}
          periodPnl={periodPnl}
          liveRiskLabel={liveRiskLabel}
          weightedBeta={weightedBeta}
          portfolioMaxDrawdown={portfolioMaxDrawdown}
          var95_1d={var95_1d}
          var95_10d={var95_10d}
          sharpeRatio={sharpeRatio}
          diversificationLabel={diversificationLabel}
          recommendation={recommendation}
        />

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: 12 }}>
          <PositionsTable
            isMobile={isMobile}
            positions={positions}
            displayPositions={displayPositions}
            market={market}
            lastPriceT={lastPriceT}
            quoteStatus={quoteStatus}
            colOrder={colOrder}
            setColOrder={setColOrder}
            visibleCols={visibleCols}
            setVisibleCols={setVisibleCols}
            colPickerOpen={colPickerOpen}
            setColPickerOpen={setColPickerOpen}
            colOrderSaved={colOrderSaved}
            saveColView={saveColView}
            toggleCol={toggleCol}
            mergeByTicker={mergeByTicker}
            setMergeByTicker={setMergeByTicker}
            lastTick={lastTick}
            setActionTooltip={setActionTooltip}
          />
          <TargetStructure positions={positions} portfolioTotal={portfolioTotal} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 12 }}>
          <BuyLadder
            positions={positions}
            ladderTickers={ladderTickers}
            setLadderTickers={setLadderTickers}
            ladderStep={ladderStep}
            setLadderStep={setLadderStep}
            ladderLevels={ladderLevels}
            setLadderLevels={setLadderLevels}
            ladderSaved={ladderSaved}
            setLadderSaved={setLadderSaved}
            ladderExpanded={ladderExpanded}
            setLadderExpanded={setLadderExpanded}
          />
          <Snapshots
            liveSnapshots={liveSnapshots}
            setLiveSnapshots={setLiveSnapshots}
            snapshotExpanded={snapshotExpanded}
            setSnapshotExpanded={setSnapshotExpanded}
            editingSnap={editingSnap}
            setEditingSnap={setEditingSnap}
            editSnapVal={editSnapVal}
            setEditSnapVal={setEditSnapVal}
          />
        </div>

        <ChartsRow
          isMobile={isMobile}
          positions={positions}
          portfolioTotal={portfolioTotal}
          totalCost={totalCost}
          chartData={chartData}
          period={period}
          setPeriod={setPeriod}
          periodPnl={periodPnl}
          liveStressScenarios={liveStressScenarios}
          recentActions={recentActions}
        />
      </div>

      <ActionTooltip state={actionTooltip} positions={positions} />
    </div>
  );
}
