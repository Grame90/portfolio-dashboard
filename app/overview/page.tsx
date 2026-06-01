"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { useApp } from "@/lib/useApp";
import { useMobile } from "@/lib/useMobile";
import { usePortfolioHistory } from "@/lib/usePortfolioHistory";

import {
  PERIOD_OPTIONS as periodOptions,
  LS_CHART,
  LS_DIVIDENDS,
  DIVIDEND_YIELDS,
} from "./constants";
import type { ChartPoint, ReceivedDividend } from "./types";
import { periodCutoff, formatDate, loadDividends, saveDividends } from "./utils";
import { GaugeMeter } from "./components/GaugeMeter";
import { MiniBarChart } from "./components/MiniBarChart";
import { MetricsRow } from "./sections/MetricsRow";
import { BrokerCards } from "./sections/BrokerCards";
import { DividendsRow } from "./sections/DividendsRow";
import { AddDividendModal } from "./dialogs/AddDividendModal";
import { generateBackfillDividends, generatePendingDividends } from "./dividends-auto";
import { DashboardRow } from "./sections/DashboardRow";
import { LeadersRow } from "./sections/LeadersRow";
import { StructureRow } from "./sections/StructureRow";
import { LongTermStrategy } from "./sections/LongTermStrategy";

// Re-export for backwards compatibility (other pages still import from this module path)
export { LS_DIVIDENDS, DIVIDEND_YIELDS, loadDividends, saveDividends };
export type { ReceivedDividend };

export default function OverviewPage() {
  const isMobile = useMobile();
  const [period, setPeriod] = useState("1М");
  const app = useApp();
  const [history, setHistory] = useState<ChartPoint[]>([]);
  const lastSavedTotal = useRef(0);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillDone, setBackfillDone] = useState(false);

  async function handleBackfill() {
    if (!app.positions.length) return;
    setBackfilling(true);
    try {
      const res = await fetch("/api/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions: app.positions }),
      });
      if (!res.ok) throw new Error();
      const { chartHistory, dividendHistory } = await res.json();
      if (chartHistory?.length) {
        localStorage.setItem("portfolio-chart-history", JSON.stringify(chartHistory));
        setHistory(chartHistory);
      }
      if (dividendHistory?.length) {
        const existing = loadDividends();
        const existingIds = new Set(existing.map((d: ReceivedDividend) => d.id));
        const merged = [...dividendHistory.filter((d: ReceivedDividend) => !existingIds.has(d.id)), ...existing];
        localStorage.setItem("dividends-received", JSON.stringify(merged));
        setReceivedDividends(merged);
      }
      setBackfillDone(true);
    } catch {}
    setBackfilling(false);
  }

  const livePosStats = app.positions
    .filter(p => p.type !== "Кэш")
    .map(p => {
      const q = app.liveQuotes[p.ticker];
      const hasLive = q && q.previousClose > 0 && q.current > 0;
      const dayChg = hasLive ? ((q.current - q.previousClose) / q.previousClose) * 100 : null;
      return { id: p.id, ticker: p.ticker, dayChg, color: p.color, hasLive };
    })
    .filter(p => p.hasLive && p.dayChg !== null) as { id: number; ticker: string; dayChg: number; color: string; hasLive: boolean }[];
  const quotesLoaded = livePosStats.length > 0;
  const growthLeaders  = [...livePosStats].sort((a, b) => b.dayChg - a.dayChg).slice(0, 5);
  const declineLeaders = [...livePosStats].sort((a, b) => a.dayChg - b.dayChg).slice(0, 5);

  const assetDist = (() => {
    const groups: Record<string, number> = {};
    app.positions.forEach(p => {
      const val = p.qty * (app.liveQuotes[p.ticker]?.current || p.avgPrice);
      groups[p.type] = (groups[p.type] || 0) + val;
    });
    const total = Object.values(groups).reduce((s, v) => s + v, 0) || 1;
    const colors: Record<string, string> = { ETF: "#7c3aed", Акция: "#3b82f6", Крипто: "#f59e0b", Сырьё: "#22c55e", Кэш: "#94a3b8", Облигация: "#06b6d4" };
    return Object.entries(groups).map(([name, val]) => ({ name, value: Math.round((val / total) * 100), color: colors[name] ?? "#9d6ef5" }));
  })();

  const livePortfolioTotal = app.portfolioTotal || 0;
  const liveDailyChange = app.dailyChange;
  const liveDailyChangePct = app.dailyChangePct;
  const liveCost = app.totalCost || 0;

  const { mergedTimeline, histData } = usePortfolioHistory(app.positions, history, livePortfolioTotal, liveCost);

  // Live risk score computed from real positions
  const liveRiskScore = (() => {
    const pos = app.positions;
    if (!pos.length) return 0;
    const total = livePortfolioTotal || 1;
    const typeRisk: Record<string, number> = {
      "Крипто": 90, "Акция": 65, "Сырьё": 55, "ETF": 40, "Облигация": 20, "Кэш": 5,
    };
    // Weighted asset-type risk
    let typeScore = 0;
    const vals = pos.map(p => p.qty * (app.liveQuotes[p.ticker]?.current || p.avgPrice));
    vals.forEach((val, i) => { typeScore += (typeRisk[pos[i].type] ?? 50) * (val / total); });
    // Concentration risk (top position %)
    const topPct = Math.max(...vals) / total;
    const concScore = Math.min(100, topPct * 150);
    // Diversification penalty (fewer instruments = riskier)
    const divPenalty = Math.max(0, 60 - pos.length * 8);
    const score = typeScore * 0.50 + concScore * 0.30 + divPenalty * 0.20;
    return Math.min(100, Math.max(0, Math.round(score)));
  })();

  const liveRiskLabel =
    liveRiskScore < 25 ? "Низкий" :
    liveRiskScore < 50 ? "Умеренный" :
    liveRiskScore < 75 ? "Средний" : "Высокий";

  // Dividends
  const [receivedDividends, setReceivedDividends] = useState<ReceivedDividend[]>([]);
  const [showDivModal, setShowDivModal] = useState(false);
  const [divExpanded, setDivExpanded] = useState(false);
  const [editingDivId, setEditingDivId] = useState<string | null>(null);
  const emptyDivForm = { ticker: "", amountPerShare: "", shares: "", date: new Date().toISOString().slice(0, 10), note: "", broker: "" };
  const [divForm, setDivForm] = useState(emptyDivForm);

  useEffect(() => { setReceivedDividends(loadDividends()); }, []);

  // Auto-backfill: when positions load (e.g. just-added instruments with a past
  // purchaseDate), generate quarterly dividend entries for completed quarters.
  // Idempotent: skips ticker+quarter that already has any entry.
  useEffect(() => {
    if (!app.positions.length) return;
    setReceivedDividends((prev) => {
      const additions = generateBackfillDividends(app.positions, prev);
      if (additions.length === 0) return prev;
      // Newest first (matches load order)
      const merged = [...additions, ...prev].sort((a, b) => b.date.localeCompare(a.date));
      saveDividends(merged);
      return merged;
    });
  }, [app.positions]);

  // Transient pending list for the current quarter, computed on every render.
  const pendingDividends = useMemo(
    () => generatePendingDividends(app.positions, receivedDividends),
    [app.positions, receivedDividends],
  );

  // Ticker dropdown options from current positions (non-cash, with shares)
  const dividendTickerOptions = useMemo(() => {
    return app.positions
      .filter(p => p.type !== "Кэш" && p.qty > 0)
      .map(p => ({ ticker: p.ticker, shares: p.qty, broker: p.broker || undefined }))
      .sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [app.positions]);

  const dividendBrokerOptions = useMemo(() => {
    return Array.from(new Set(
      app.positions.map(p => p.broker?.trim() || "").filter(Boolean),
    )).sort();
  }, [app.positions]);

  const divPositions = useMemo(() => {
    return app.positions
      .filter(p => p.type !== "Кэш")
      .map(p => {
        const price = app.liveQuotes[p.ticker]?.current || p.avgPrice;
        const val = p.qty * price;
        const yieldPct = DIVIDEND_YIELDS[p.ticker] ?? 0;
        const annual = val * yieldPct / 100;
        return { id: p.id, ticker: p.ticker, yieldPct, annual, quarterly: annual / 4, val };
      })
      .filter(p => p.yieldPct > 0)
      .sort((a, b) => b.annual - a.annual);
  }, [app.positions, app.liveQuotes]);

  const annualDivIncome = divPositions.reduce((s, p) => s + p.annual, 0);
  const portfolioDivYield = livePortfolioTotal > 0 ? (annualDivIncome / livePortfolioTotal) * 100 : 0;

  const currentYear = new Date().getFullYear().toString();
  const ytdReceived = receivedDividends
    .filter(d => d.date.startsWith(currentYear))
    .reduce((s, d) => s + d.totalUSD, 0);

  function saveDividend() {
    if (!divForm.ticker || !divForm.amountPerShare || !divForm.shares) return;
    const totalUSD = Number(divForm.amountPerShare) * Number(divForm.shares);
    const broker = divForm.broker.trim();
    if (editingDivId) {
      const updated = receivedDividends.map(d => d.id === editingDivId ? {
        ...d,
        ticker: divForm.ticker.toUpperCase(),
        amountPerShare: Number(divForm.amountPerShare),
        shares: Number(divForm.shares),
        totalUSD,
        date: divForm.date,
        note: divForm.note,
        broker: broker || undefined,
      } : d);
      setReceivedDividends(updated);
      saveDividends(updated);
    } else {
      const entry: ReceivedDividend = {
        id: Date.now().toString(),
        ticker: divForm.ticker.toUpperCase(),
        amountPerShare: Number(divForm.amountPerShare),
        shares: Number(divForm.shares),
        totalUSD,
        date: divForm.date,
        note: divForm.note,
        broker: broker || undefined,
      };
      const next = [entry, ...receivedDividends];
      setReceivedDividends(next);
      saveDividends(next);
    }
    setShowDivModal(false);
    setEditingDivId(null);
    setDivForm(emptyDivForm);
  }

  function openAddDividend() {
    setEditingDivId(null);
    setDivForm({ ...emptyDivForm, date: new Date().toISOString().slice(0, 10) });
    setShowDivModal(true);
  }

  function openEditDividend(d: ReceivedDividend) {
    setEditingDivId(d.id);
    setDivForm({
      ticker: d.ticker,
      amountPerShare: String(d.amountPerShare),
      shares: String(d.shares),
      date: d.date,
      note: d.note,
      broker: d.broker ?? "",
    });
    setShowDivModal(true);
  }

  function deleteDividend(id: string) {
    if (!window.confirm("Удалить эту запись о дивиденде?")) return;
    const next = receivedDividends.filter(d => d.id !== id);
    setReceivedDividends(next);
    saveDividends(next);
  }

  // Credit the broker's USD cash position by `amount`. If no USD cash position
  // exists for that broker, create one (so dividend lands somewhere visible).
  function creditBrokerCash(broker: string, amount: number) {
    if (!broker || amount <= 0) return;
    const positions = app.positions;
    const cashIdx = positions.findIndex(
      p => p.type === "Кэш" && (p.broker || "") === broker && (p.ticker === "USD" || p.ticker === "USDT"),
    );
    let updated;
    if (cashIdx >= 0) {
      updated = positions.map((p, i) => i === cashIdx ? { ...p, qty: p.qty + amount } : p);
    } else {
      const newId = positions.reduce((max, p) => Math.max(max, p.id), 0) + 1;
      updated = [...positions, {
        id: newId,
        ticker: "USD",
        name: "Доллар США",
        type: "Кэш",
        qty: amount,
        avgPrice: 1,
        color: "#22c55e",
        purchaseDate: new Date().toISOString().slice(0, 10),
        action: "",
        broker,
      }];
    }
    app.setPositions(updated);
  }

  // Materialize a pending dividend into a manual record and credit the broker
  // cash balance by the dividend amount.
  function confirmPendingDividend(d: ReceivedDividend) {
    const entry: ReceivedDividend = {
      ...d,
      id: Date.now().toString(),
      source: "manual",
      note: "Зачислено на счёт брокера",
      date: new Date().toISOString().slice(0, 10),
    };
    const next = [entry, ...receivedDividends].sort((a, b) => b.date.localeCompare(a.date));
    setReceivedDividends(next);
    saveDividends(next);
    if (d.broker) creditBrokerCash(d.broker, d.totalUSD);
  }

  // Load history once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_CHART);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  // Auto-save today's value whenever portfolio total changes meaningfully
  useEffect(() => {
    if (livePortfolioTotal <= 0) return;
    if (Math.abs(livePortfolioTotal - lastSavedTotal.current) < 1) return;
    lastSavedTotal.current = livePortfolioTotal;

    const today = new Date().toISOString().slice(0, 10);
    setHistory(prev => {
      const next = [...prev];
      const idx = next.findIndex(p => p.date === today);
      const point: ChartPoint = { date: today, value: Math.round(livePortfolioTotal), cost: Math.round(liveCost) };
      if (idx >= 0) next[idx] = point;
      else next.push(point);
      next.sort((a, b) => a.date.localeCompare(b.date));
      if (next.length > 730) next.splice(0, next.length - 730);
      try { localStorage.setItem(LS_CHART, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [livePortfolioTotal, liveCost]);

  const chartData = useMemo(() => {
    const cutoff = periodCutoff(period);
    return mergedTimeline
      .filter(p => p.date >= cutoff)
      .map(p => ({ date: formatDate(p.date), value: p.value, cost: p.cost }));
  }, [mergedTimeline, period]);

  // Period diffs from merged timeline (real historical prices)
  const periodPerf = useMemo(() => {
    function diffByDate(cutStr: string) {
      if (livePortfolioTotal <= 0) return null;
      const pt = [...mergedTimeline].reverse().find(p => p.date <= cutStr);
      if (!pt) return null;
      const delta = livePortfolioTotal - pt.value;
      const pct = pt.value > 0 ? (delta / pt.value) * 100 : 0;
      return { value: Math.round(delta), pct };
    }
    function diff(daysAgo: number) {
      const cutStr = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
      return diffByDate(cutStr);
    }
    const ytdStr = `${new Date().getFullYear()}-01-01`;
    return {
      week: diff(7),
      month: diff(30),
      halfYear: diff(182),
      year: diff(365),
      ytd: diffByDate(ytdStr),
    };
  }, [mergedTimeline, livePortfolioTotal]);

  // Per-broker period performance using historical prices × current quantities.
  // For each broker, computes its value at the cutoff date and compares to today.
  const brokerPeriodPerf = useMemo(() => {
    const result: Record<string, { week: { value: number; pct: number } | null; month: { value: number; pct: number } | null; year: { value: number; pct: number } | null; ytd: { value: number; pct: number } | null }> = {};
    if (!Object.keys(histData).length) return result;

    function brokerValueOn(brokerName: string, cutStr: string): number {
      let val = 0;
      for (const p of app.positions) {
        if ((p.broker || "") !== brokerName) continue;
        const price = app.liveQuotes[p.ticker]?.current || p.avgPrice;
        if (p.type === "Кэш") { val += p.qty * p.avgPrice; continue; }
        const hist = histData[p.ticker];
        if (!hist?.dates.length) { val += p.qty * price; continue; }
        let idx = -1;
        for (let i = hist.dates.length - 1; i >= 0; i--) {
          if (hist.dates[i] <= cutStr) { idx = i; break; }
        }
        val += idx >= 0 ? p.qty * hist.closes[idx] : p.qty * price;
      }
      return val;
    }

    function diffFor(brokerName: string, currentTotal: number, cutStr: string) {
      const past = brokerValueOn(brokerName, cutStr);
      if (past <= 0) return null;
      const delta = currentTotal - past;
      const pct = (delta / past) * 100;
      return { value: Math.round(delta), pct };
    }

    const brokers = new Set(app.positions.map(p => p.broker?.trim() || "").filter(Boolean));
    const ytdStr = `${new Date().getFullYear()}-01-01`;

    brokers.forEach(name => {
      const currentTotal = app.positions
        .filter(p => (p.broker || "") === name)
        .reduce((s, p) => s + p.qty * (app.liveQuotes[p.ticker]?.current || p.avgPrice), 0);
      const cut = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      result[name] = {
        week:  diffFor(name, currentTotal, cut(7)),
        month: diffFor(name, currentTotal, cut(30)),
        year:  diffFor(name, currentTotal, cut(365)),
        ytd:   diffFor(name, currentTotal, ytdStr),
      };
    });

    return result;
  }, [histData, app.positions, app.liveQuotes]);

  const portfolioMaxDrawdown = useMemo(() => {
    if (mergedTimeline.length < 2) return 0;
    let peak = 0, maxDD = 0;
    mergedTimeline.forEach(p => {
      if (p.value > peak) peak = p.value;
      const dd = peak > 0 ? ((p.value - peak) / peak) * 100 : 0;
      if (dd < maxDD) maxDD = dd;
    });
    return Math.abs(maxDD);
  }, [mergedTimeline]);

  const historyStats = useMemo(() => {
    if (mergedTimeline.length < 2) return null;
    const changes: number[] = [];
    for (let i = 1; i < mergedTimeline.length; i++) {
      const prev = mergedTimeline[i - 1].value;
      const curr = mergedTimeline[i].value;
      if (prev > 0) changes.push(((curr - prev) / prev) * 100);
    }
    if (!changes.length) return null;
    const best = Math.max(...changes);
    const worst = Math.min(...changes);
    const avg = changes.reduce((s, v) => s + v, 0) / changes.length;
    return {
      bestDay: best.toFixed(2),
      worstDay: worst.toFixed(2),
      avgDailyReturn: avg.toFixed(2),
      positiveDays: Math.round((changes.filter(v => v > 0).length / changes.length) * 100),
      tradingDays: mergedTimeline.length,
      profitRiskRatio: worst !== 0 ? Math.abs(best / worst).toFixed(2) : "–",
    };
  }, [mergedTimeline]);

  const portfolioWeightedBeta = useMemo(() => {
    if (!app.positions.length || app.portfolioTotal <= 0) return 1.0;
    const typeBeta: Record<string, number> = { Крипто: 2.0, Акция: 1.1, Сырьё: 0.8, ETF: 1.0, Облигация: 0.3, Кэш: 0 };
    return app.positions.reduce((s, p) => {
      const val = p.qty * (app.liveQuotes[p.ticker]?.current || p.avgPrice);
      return s + (typeBeta[p.type] ?? 1.0) * (val / app.portfolioTotal);
    }, 0);
  }, [app.positions, app.liveQuotes, app.portfolioTotal]);

  const liveKeyIndicators = useMemo(() => {
    const n = app.positions.filter(p => p.type !== "Кэш").length;
    const types = new Set(app.positions.map(p => p.type));
    const divLabel = n === 0 ? "–" : n >= 8 && types.size >= 3 ? "Высокая" : n >= 4 ? "Средняя" : "Низкая";
    const var1d = (portfolioWeightedBeta * 1.2 * 1.645).toFixed(1);
    const var10d = (portfolioWeightedBeta * 1.2 * 1.645 * Math.sqrt(10)).toFixed(1);
    const sharpe = app.totalCost > 0
      ? (((app.portfolioTotal - app.totalCost) / app.totalCost * 100 - 5) / Math.max(5, portfolioWeightedBeta * 15)).toFixed(2)
      : "–";
    return { beta: portfolioWeightedBeta.toFixed(2), maxDrawdown: portfolioMaxDrawdown.toFixed(1), var95_1d: var1d, var95_10d: var10d, sharpe, diversification: divLabel };
  }, [app.positions, app.liveQuotes, app.portfolioTotal, app.totalCost, portfolioWeightedBeta, portfolioMaxDrawdown]);

  const pnlByClass = useMemo(() => {
    const groups: Record<string, { pnl: number; cost: number }> = {};
    app.positions.forEach(p => {
      const price = app.liveQuotes[p.ticker]?.current || p.avgPrice;
      const pnl = p.qty * (price - p.avgPrice);
      const cost = p.qty * p.avgPrice;
      if (!groups[p.type]) groups[p.type] = { pnl: 0, cost: 0 };
      groups[p.type].pnl += pnl;
      groups[p.type].cost += cost;
    });
    return Object.entries(groups)
      .filter(([, g]) => g.cost > 0)
      .map(([type, g]) => ({
        currency: type,
        value: Math.round(g.pnl),
        pct: parseFloat(((g.pnl / g.cost) * 100).toFixed(2)),
      }));
  }, [app.positions, app.liveQuotes]);

  const targetRows = useMemo(() => {
    const nonCash = app.positions.filter(p => p.type !== "Кэш");
    const eqTarget = nonCash.length > 0 ? parseFloat((100 / nonCash.length).toFixed(2)) : 0;
    return app.positions.map(p => {
      const price = app.liveQuotes[p.ticker]?.current || p.avgPrice;
      const liveShare = app.portfolioTotal > 0 ? (p.qty * price / app.portfolioTotal) * 100 : 0;
      const target = p.type === "Кэш" ? liveShare : eqTarget;
      return { id: p.id, ticker: p.ticker, name: p.name, liveShare, target, deviation: liveShare - target };
    });
  }, [app.positions, app.liveQuotes, app.portfolioTotal]);

  const nextRebalance = useMemo(() => {
    const today = new Date();
    const period = app.settings.rebalancePeriod;
    let next: Date;
    if (period === "Ежемесячно") {
      next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    } else if (period === "Квартально") {
      const q = Math.floor(today.getMonth() / 3);
      next = new Date(today.getFullYear(), (q + 1) * 3, 1);
    } else if (period === "Полугодично") {
      const h = today.getMonth() < 6 ? 0 : 1;
      next = new Date(today.getFullYear(), (h + 1) * 6, 1);
    } else {
      next = new Date(today.getFullYear() + 1, 0, 1);
    }
    const daysLeft = Math.ceil((next.getTime() - today.getTime()) / 86400000);
    const dd = String(next.getDate()).padStart(2, "0");
    const mm = String(next.getMonth() + 1).padStart(2, "0");
    return { date: `${dd}.${mm}.${next.getFullYear()}`, daysLeft, period };
  }, [app.settings.rebalancePeriod]);

  const rebalanceConditions = useMemo(() => {
    const offTarget = targetRows.some(r => Math.abs(r.deviation) > 5);
    const profitFix = app.positions.some(p => {
      const price = app.liveQuotes[p.ticker]?.current || p.avgPrice;
      return p.avgPrice > 0 && ((price - p.avgPrice) / p.avgPrice * 100) > 10;
    });
    return [
      { label: "Отклонение > 5%", checked: offTarget },
      { label: "Фиксация прибыли > 10%", checked: profitFix },
      { label: "Изменение рынка (VIX > 25)", checked: false },
      { label: `Просадка портфеля > 10%`, checked: portfolioMaxDrawdown > 10 },
    ];
  }, [targetRows, app.positions, app.liveQuotes, portfolioMaxDrawdown]);

  const brokerStats = useMemo(() => {
    const map: Record<string, { total: number; cost: number; count: number; prev: number }> = {};
    for (const p of app.positions) {
      const key = p.broker?.trim() || "";
      if (!key) continue;
      const price = app.liveQuotes[p.ticker]?.current || p.avgPrice;
      const prevPrice = app.liveQuotes[p.ticker]?.previousClose || p.avgPrice;
      if (!map[key]) map[key] = { total: 0, cost: 0, count: 0, prev: 0 };
      map[key].total += p.qty * price;
      map[key].cost  += p.qty * p.avgPrice;
      map[key].prev  += p.qty * prevPrice;
      map[key].count += 1;
    }
    return Object.entries(map)
      .map(([name, s]) => ({
        name, total: Math.round(s.total), cost: Math.round(s.cost),
        pnl: Math.round(s.total - s.cost),
        pnlPct: s.cost > 0 ? ((s.total - s.cost) / s.cost) * 100 : 0,
        dailyChange: Math.round(s.total - s.prev),
        dailyChangePct: s.prev > 0 ? ((s.total - s.prev) / s.prev) * 100 : 0,
        count: s.count,
        share: livePortfolioTotal > 0 ? (s.total / livePortfolioTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [app.positions, app.liveQuotes, livePortfolioTotal]);

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader title="ОБЗОР" subtitle="Главная сводка по портфелю" />

      <div style={{ padding: isMobile ? "12px" : "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        <MetricsRow
          livePortfolioTotal={livePortfolioTotal}
          liveDailyChange={liveDailyChange}
          liveDailyChangePct={liveDailyChangePct}
          periodPerf={periodPerf}
          positions={app.positions}
          brokerStats={brokerStats}
          brokerPeriodPerf={brokerPeriodPerf}
          totalPnl={app.totalPnl}
          totalPnlPct={app.totalPnlPct}
        />

        <BrokerCards brokerStats={brokerStats} isMobile={isMobile} />

        <DividendsRow
          isMobile={isMobile}
          livePortfolioTotal={livePortfolioTotal}
          annualDivIncome={annualDivIncome}
          portfolioDivYield={portfolioDivYield}
          ytdReceived={ytdReceived}
          divPositions={divPositions}
          receivedDividends={receivedDividends}
          pendingDividends={pendingDividends}
          divExpanded={divExpanded}
          setDivExpanded={setDivExpanded}
          onAddClick={openAddDividend}
          onEditClick={openEditDividend}
          onDeleteClick={deleteDividend}
          onConfirmPending={confirmPendingDividend}
        />

        <DashboardRow
          isMobile={isMobile}
          assetDist={assetDist}
          livePortfolioTotal={livePortfolioTotal}
          liveDailyChange={liveDailyChange}
          liveDailyChangePct={liveDailyChangePct}
          liveCost={liveCost}
          period={period}
          setPeriod={setPeriod}
          chartData={chartData}
          periodPerf={periodPerf}
          hasPositions={app.positions.length > 0}
          backfillDone={backfillDone}
          backfilling={backfilling}
          onBackfill={handleBackfill}
          pnlByClass={pnlByClass}
          liveRiskLabel={liveRiskLabel}
          liveKeyIndicators={liveKeyIndicators}
          portfolioMaxDrawdown={portfolioMaxDrawdown}
        />

        <LeadersRow
          quotesLoaded={quotesLoaded}
          growthLeaders={growthLeaders}
          declineLeaders={declineLeaders}
          assetDist={assetDist}
          livePortfolioTotal={livePortfolioTotal}
          liveRiskScore={liveRiskScore}
        />

        <StructureRow
          isMobile={isMobile}
          targetRows={targetRows}
          nextRebalance={nextRebalance}
          rebalanceConditions={rebalanceConditions}
          totalPnl={app.totalPnl}
          totalPnlPct={app.totalPnlPct}
          periodPerfYear={periodPerf.year}
          historyStats={historyStats}
          historyLength={history.length}
        />

      </div>

      <LongTermStrategy isMobile={isMobile} />

      <AddDividendModal
        open={showDivModal}
        form={divForm}
        setForm={setDivForm}
        onClose={() => { setShowDivModal(false); setEditingDivId(null); }}
        onSave={saveDividend}
        isEdit={editingDivId !== null}
        tickerOptions={dividendTickerOptions}
        brokerOptions={dividendBrokerOptions}
      />
    </div>
  );
}
