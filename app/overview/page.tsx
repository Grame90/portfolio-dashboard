"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { useApp } from "@/lib/AppContext";
import { useMobile } from "@/lib/useMobile";

const periodOptions = ["7Д", "1М", "3М", "6М", "YTD", "1Г", "ВСЕ"];
const LS_CHART = "portfolio-chart-history";
export const LS_DIVIDENDS = "dividends-received";

// Known annual dividend yields (%) — used across pages
export const DIVIDEND_YIELDS: Record<string, number> = {
  VOO: 1.30, QQQ: 0.60, SPY: 1.25, IVV: 1.28, VTI: 1.40,
  SMH: 0.68, SOXX: 1.18, XLK: 0.70, ARKK: 0.00,
  GLD: 0.00, SLV: 0.00, IAU: 0.00,
  "BRK.B": 0.00, TSLA: 0.00, AAPL: 0.50, MSFT: 0.80,
  NVDA: 0.03, AMZN: 0.00, GOOGL: 0.00, META: 0.40,
  IBKR: 0.90, JPM: 2.20, BAC: 2.50, V: 0.75, MA: 0.55,
  JNJ: 3.00, PFE: 5.80, KO: 3.10, PG: 2.30, T: 6.50,
};

export type ReceivedDividend = {
  id: string; ticker: string; amountPerShare: number;
  shares: number; totalUSD: number; date: string; note: string;
};

export function loadDividends(): ReceivedDividend[] {
  try { const r = localStorage.getItem(LS_DIVIDENDS); return r ? JSON.parse(r) : []; } catch { return []; }
}
export function saveDividends(list: ReceivedDividend[]) {
  try { localStorage.setItem(LS_DIVIDENDS, JSON.stringify(list)); } catch {}
}

type ChartPoint = { date: string; value: number; cost: number };

function periodCutoff(period: string): string {
  const now = new Date();
  const d = new Date(now);
  if (period === "7Д")  d.setDate(d.getDate() - 7);
  else if (period === "1М")  d.setMonth(d.getMonth() - 1);
  else if (period === "3М")  d.setMonth(d.getMonth() - 3);
  else if (period === "6М")  d.setMonth(d.getMonth() - 6);
  else if (period === "YTD") d.setMonth(0, 1);
  else if (period === "1Г")  d.setFullYear(d.getFullYear() - 1);
  else return "0000-00-00";
  return d.toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  const [, m, day] = iso.split("-");
  return `${day}.${m}`;
}

function GaugeMeter({ value, max = 100 }: { value: number; max?: number }) {
  const pct = value / max;
  const angle = pct * 180 - 90;
  const r = 60;
  const cx = 80, cy = 80;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const needleX = cx + r * Math.cos(toRad(angle - 90));
  const needleY = cy + r * Math.sin(toRad(angle - 90));

  const colors = ["#22c55e", "#f59e0b", "#ef4444"];
  const arcs = [
    { start: -180, end: -60, color: "#22c55e" },
    { start: -60, end: 60, color: "#f59e0b" },
    { start: 60, end: 180, color: "#ef4444" },
  ];

  const describeArc = (startDeg: number, endDeg: number, radius: number) => {
    const s = toRad(startDeg);
    const e = toRad(endDeg);
    const x1 = cx + radius * Math.cos(s);
    const y1 = cy + radius * Math.sin(s);
    const x2 = cx + radius * Math.cos(e);
    const y2 = cy + radius * Math.sin(e);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  };

  return (
    <svg width={160} height={100} viewBox="0 0 160 100">
      {arcs.map((arc, i) => (
        <path
          key={i}
          d={describeArc(arc.start, arc.end, 55)}
          fill="none"
          stroke={arc.color}
          strokeWidth={12}
          strokeLinecap="round"
        />
      ))}
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} style={{ stroke: "var(--text-primary)" }} strokeWidth={2} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={4} style={{ fill: "var(--text-primary)" }} />
      <text x={cx} y={cy + 18} textAnchor="middle" style={{ fill: "var(--text-primary)" }} fontSize={20} fontWeight={700}>{value}</text>
      <text x={cx} y={cy + 30} textAnchor="middle" style={{ fill: "var(--text-muted)" }} fontSize={9}>из 100</text>
    </svg>
  );
}

function MiniBarChart({ data, positive = true }: { data: { date: string; value: number }[]; positive?: boolean }) {
  const slice = data.slice(-20);
  const min = Math.min(...slice.map(d => d.value));
  const normalized = slice.map(d => ({ ...d, value: d.value - min }));
  const color = positive ? "#7c3aed" : "#ef4444";
  return (
    <ResponsiveContainer width="100%" height={40}>
      <BarChart data={normalized} barSize={3}>
        <YAxis domain={[0, "auto"]} hide />
        <Bar dataKey="value" fill={color} radius={[1, 1, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

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
      return { ticker: p.ticker, dayChg, color: p.color, hasLive };
    })
    .filter(p => p.hasLive && p.dayChg !== null) as { ticker: string; dayChg: number; color: string; hasLive: boolean }[];
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
  const [divForm, setDivForm] = useState({ ticker: "", amountPerShare: "", shares: "", date: new Date().toISOString().slice(0, 10), note: "" });

  useEffect(() => { setReceivedDividends(loadDividends()); }, []);

  const divPositions = useMemo(() => {
    return app.positions
      .filter(p => p.type !== "Кэш")
      .map(p => {
        const price = app.liveQuotes[p.ticker]?.current || p.avgPrice;
        const val = p.qty * price;
        const yieldPct = DIVIDEND_YIELDS[p.ticker] ?? 0;
        const annual = val * yieldPct / 100;
        return { ticker: p.ticker, yieldPct, annual, quarterly: annual / 4, val };
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

  function addDividend() {
    if (!divForm.ticker || !divForm.amountPerShare || !divForm.shares) return;
    const totalUSD = Number(divForm.amountPerShare) * Number(divForm.shares);
    const entry: ReceivedDividend = {
      id: Date.now().toString(), ticker: divForm.ticker.toUpperCase(),
      amountPerShare: Number(divForm.amountPerShare), shares: Number(divForm.shares),
      totalUSD, date: divForm.date, note: divForm.note,
    };
    const next = [entry, ...receivedDividends];
    setReceivedDividends(next);
    saveDividends(next);
    setShowDivModal(false);
    setDivForm({ ticker: "", amountPerShare: "", shares: "", date: new Date().toISOString().slice(0, 10), note: "" });
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
    const filtered = history.filter(p => p.date >= cutoff);
    const today = new Date().toISOString().slice(0, 10);
    const points = filtered.map(p => ({ date: formatDate(p.date), value: p.value, cost: p.cost }));
    if (points.length > 0 && filtered[filtered.length - 1]?.date !== today && livePortfolioTotal > 0) {
      points.push({ date: formatDate(today), value: Math.round(livePortfolioTotal), cost: Math.round(liveCost) });
    }
    return points;
  }, [history, period, livePortfolioTotal, liveCost]);

  // Period diffs from real history — used in top cards and chart stats
  const periodPerf = useMemo(() => {
    function diff(daysAgo: number) {
      if (livePortfolioTotal <= 0) return null;
      const cutStr = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
      const pt = [...history].reverse().find(p => p.date <= cutStr);
      if (!pt) return null;
      const delta = livePortfolioTotal - pt.value;
      const pct = pt.value > 0 ? (delta / pt.value) * 100 : 0;
      return { value: Math.round(delta), pct };
    }
    return { week: diff(7), month: diff(30), halfYear: diff(182), year: diff(365) };
  }, [history, livePortfolioTotal]);

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

  const historyStats = useMemo(() => {
    if (history.length < 2) return null;
    const changes: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1].value;
      const curr = history[i].value;
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
      tradingDays: history.length,
      profitRiskRatio: worst !== 0 ? Math.abs(best / worst).toFixed(2) : "–",
    };
  }, [history]);

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
      return { ticker: p.ticker, name: p.name, liveShare, target, deviation: liveShare - target };
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

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader title="ОБЗОР" subtitle="Главная сводка по портфелю" />

      <div style={{ padding: isMobile ? "12px" : "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Row 1: Metrics cards */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1.4fr 1fr 1fr 1fr 1fr 1.1fr", gap: 10 }}>
          {/* Total */}
          <div className="card" style={{ borderLeft: "3px solid var(--accent)", background: "linear-gradient(135deg, var(--bg-card-hover), var(--bg-card))" }}>
            <div className="card-title">Общая стоимость портфеля</div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{Math.round(livePortfolioTotal).toLocaleString("ru-RU")}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>USD</div>
            <div className={liveDailyChange >= 0 ? "positive" : "negative"} style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
              {liveDailyChange >= 0 ? "+" : ""}{Math.round(Math.abs(liveDailyChange)).toLocaleString("en-US")} ({Math.abs(liveDailyChangePct).toFixed(2)}%)
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>Изменение за день</div>
          </div>

          {/* Day */}
          <div className="card">
            <div className="card-title">День</div>
            <div className={liveDailyChange >= 0 ? "positive" : "negative"} style={{ fontSize: 22, fontWeight: 700 }}>{liveDailyChange >= 0 ? "+" : ""}{Math.round(Math.abs(liveDailyChange)).toLocaleString("en-US")}</div>
            <div className={liveDailyChange >= 0 ? "positive" : "negative"} style={{ fontSize: 14 }}>{liveDailyChange >= 0 ? "+" : ""}{liveDailyChangePct.toFixed(2)}%</div>
          </div>
          {[
            { label: "Неделя",   d: periodPerf.week },
            { label: "Месяц",    d: periodPerf.month },
            { label: "Год",      d: periodPerf.year },
          ].map(({ label, d }) => (
            <div key={label} className="card">
              <div className="card-title">{label}</div>
              {d == null ? (
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-muted)" }}>—</div>
              ) : (
                <>
                  <div className={d.value >= 0 ? "positive" : "negative"} style={{ fontSize: 22, fontWeight: 700 }}>
                    {d.value >= 0 ? "+" : ""}{Math.abs(d.value).toLocaleString("en-US")}
                  </div>
                  <div className={d.value >= 0 ? "positive" : "negative"} style={{ fontSize: 14 }}>
                    {d.pct >= 0 ? "+" : ""}{Math.abs(d.pct).toFixed(2)}%
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Cash */}
          {(() => {
            const cashPos = app.positions.filter(p => p.type === "Кэш");
            const totalCashUsd = cashPos.reduce((s, p) => s + p.qty * p.avgPrice, 0);
            const cashPct = livePortfolioTotal > 0 ? (totalCashUsd / livePortfolioTotal) * 100 : 0;
            return (
              <div className="card">
                <div className="card-title">Наличные деньги</div>
                {cashPos.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Нет кэш-позиций</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
                    {cashPos.map(p => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: "var(--text-secondary)" }}>{p.ticker}</span>
                        <span style={{ fontWeight: 600 }}>
                          {p.qty.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                          <span style={{ color: "var(--text-muted)", marginLeft: 4, fontSize: 10 }}>
                            ≈ ${Math.round(p.qty * p.avgPrice).toLocaleString("en-US")}
                          </span>
                        </span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 4 }}>
                      <span style={{ color: "var(--text-secondary)" }}>Итого (USD)</span>
                      <span style={{ fontWeight: 700 }}>{Math.round(totalCashUsd).toLocaleString("en-US")}</span>
                    </div>
                    <div style={{ color: "var(--accent-light)", fontWeight: 600 }}>{cashPct.toFixed(1)}% от портфеля</div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Dividends row */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
          {/* Annual dividend income */}
          <div className="card">
            <div className="card-title">Дивидендный доход</div>
            {livePortfolioTotal <= 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Нет позиций в портфеле</div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Годовой (оценка)</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#22c55e" }}>${Math.round(annualDivIncome).toLocaleString("en-US")}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>~${Math.round(annualDivIncome / 12).toLocaleString("en-US")}/мес</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Доходность</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#22c55e" }}>{portfolioDivYield.toFixed(2)}%</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Получено YTD: ${Math.round(ytdReceived).toLocaleString("en-US")}</div>
                  </div>
                </div>
                {annualDivIncome === 0 && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Позиции в портфеле не платят дивиденды</div>
                )}
              </>
            )}
          </div>

          {/* Per-position dividend table */}
          <div className="card">
            <div className="card-title">Дивиденды по позициям</div>
            {divPositions.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>Нет дивидендных позиций</div>
            ) : (
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "4px 6px", textAlign: "left", fontWeight: 600 }}>Тикер</th>
                    <th style={{ padding: "4px 6px", textAlign: "right", fontWeight: 600 }}>Доходн.</th>
                    <th style={{ padding: "4px 6px", textAlign: "right", fontWeight: 600 }}>Год</th>
                    <th style={{ padding: "4px 6px", textAlign: "right", fontWeight: 600 }}>Квартал</th>
                  </tr>
                </thead>
                <tbody>
                  {divPositions.slice(0, 6).map(p => (
                    <tr key={p.ticker} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "5px 6px", fontWeight: 700, color: "var(--accent-light)" }}>{p.ticker}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right", color: "#22c55e", fontWeight: 600 }}>{p.yieldPct.toFixed(2)}%</td>
                      <td style={{ padding: "5px 6px", textAlign: "right" }}>${Math.round(p.annual).toLocaleString("en-US")}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right", color: "var(--text-secondary)" }}>${Math.round(p.quarterly).toLocaleString("en-US")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Received dividends history */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="card-title" style={{ margin: 0 }}>История выплат</div>
              <button onClick={() => setShowDivModal(true)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", background: "var(--bg-secondary)", color: "var(--text-secondary)", fontWeight: 600 }}>+ Записать</button>
            </div>
            {receivedDividends.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>
                Нет записей о полученных выплатах.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {receivedDividends.slice(0, 5).map(d => (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                    <div>
                      <span style={{ fontWeight: 700, color: "var(--accent-light)", marginRight: 6 }}>{d.ticker}</span>
                      <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{d.date}</span>
                      {d.note && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{d.note}</div>}
                    </div>
                    <span style={{ fontWeight: 700, color: "#22c55e" }}>+${d.totalUSD.toFixed(2)}</span>
                  </div>
                ))}
                {receivedDividends.length > 5 && (
                  <div style={{ fontSize: 11, color: "var(--accent-light)", textAlign: "center" }}>Ещё {receivedDividends.length - 5} записей</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Distribution + Dynamics + Currency + Key indicators */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr 1fr 1fr", gap: 12 }}>
          <div className="card">
            <div className="card-title">Распределение активов</div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={assetDist} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={65} label={false}>
                    {assetDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 12 }} formatter={(v: any) => [`${v}%`]} />
                </PieChart>
              </ResponsiveContainer>
              {assetDist.map((e) => (
                <div key={e.name} style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.color, display: "inline-block" }} />
                    <span style={{ color: "var(--text-secondary)" }}>{e.name}</span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{e.value}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: "18px 20px 14px" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div className="card-title" style={{ margin: 0, marginBottom: 6 }}>Динамика портфеля</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-primary)", lineHeight: 1 }}>
                    ${Math.round(livePortfolioTotal).toLocaleString("en-US")}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>USD</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: liveDailyChange >= 0 ? "#22c55e" : "#ef4444" }}>
                    {liveDailyChange >= 0 ? "▲ +" : "▼ "}{Math.round(Math.abs(liveDailyChange)).toLocaleString("en-US")} за день
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: liveDailyChangePct >= 0 ? "#22c55e" : "#ef4444",
                    background: liveDailyChangePct >= 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                    border: `1px solid ${liveDailyChangePct >= 0 ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                    padding: "1px 8px", borderRadius: 20,
                  }}>
                    {liveDailyChangePct >= 0 ? "+" : ""}{liveDailyChangePct.toFixed(2)}%
                  </span>
                </div>
              </div>
              {/* Period selector */}
              <div style={{ display: "flex", gap: 2, background: "var(--bg-secondary)", borderRadius: 8, padding: 3, border: "1px solid var(--border)" }}>
                {periodOptions.map((p) => (
                  <button key={p} onClick={() => setPeriod(p)} style={{
                    padding: "4px 9px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontSize: 10, fontWeight: 700,
                    background: period === p ? "var(--accent)" : "transparent",
                    color: period === p ? "#fff" : "var(--text-muted)",
                    transition: "all 0.15s",
                  }}>{p}</button>
                ))}
              </div>
            </div>

            {/* Chart */}
            {chartData.length < 2 ? (
              <div style={{ height: 190, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--text-muted)" }}>
                <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} opacity={0.4}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <span style={{ fontSize: 12, opacity: 0.6 }}>История накапливается — заходи каждый день</span>
                {app.positions.length > 0 && !backfillDone && (
                  <button
                    onClick={handleBackfill}
                    disabled={backfilling}
                    style={{
                      padding: "8px 18px", borderRadius: 8, border: "none", cursor: backfilling ? "wait" : "pointer",
                      background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600,
                      opacity: backfilling ? 0.7 : 1,
                    }}
                  >
                    {backfilling ? "Загружаю историю…" : "Восстановить историю из API"}
                  </button>
                )}
                {backfillDone && <span style={{ fontSize: 11, color: "#22c55e" }}>✓ История восстановлена</span>}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grad2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--text-muted)" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="var(--text-muted)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false}
                    tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} domain={["auto", "auto"]} width={40} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                    labelStyle={{ color: "var(--text-secondary)", fontSize: 10 }}
                    formatter={(v: any, name: any) => {
                      if (name === "cost") return [`$${Number(v).toLocaleString("en-US")}`, "Вложено"];
                      return [`$${Number(v).toLocaleString("en-US")}`, "Стоимость"];
                    }}
                    cursor={{ stroke: "var(--accent)", strokeWidth: 1, strokeDasharray: "4 3", strokeOpacity: 0.5 }}
                  />
                  <Area type="monotone" dataKey="cost" stroke="var(--text-muted)" strokeWidth={1}
                    strokeDasharray="4 3" fill="url(#gradCost)" dot={false} />
                  <Area type="monotone" dataKey="value" stroke="var(--accent-light)" strokeWidth={2}
                    fill="url(#grad2)" dot={chartData.length <= 14}
                    activeDot={{ r: 4, fill: "var(--accent-light)", stroke: "var(--accent)", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {/* Bottom stats */}
            {(() => {
              const pnl = livePortfolioTotal - liveCost;
              const pnlPct = liveCost > 0 ? (pnl / liveCost) * 100 : 0;
              const wk = periodPerf.week; const mo = periodPerf.month; const yr = periodPerf.year;
              return (
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
              {[
                { label: "Вложено",  value: liveCost > 0 ? `$${Math.round(liveCost).toLocaleString("en-US")}` : "—" },
                { label: "День",     value: liveDailyChange !== 0 ? `${liveDailyChange >= 0 ? "+" : ""}${Math.round(liveDailyChange).toLocaleString("en-US")}` : "—", pos: liveDailyChange > 0, neg: liveDailyChange < 0 },
                { label: "День %",   value: `${liveDailyChangePct >= 0 ? "+" : ""}${liveDailyChangePct.toFixed(2)}%`, pos: liveDailyChangePct > 0, neg: liveDailyChangePct < 0 },
                { label: "Неделя",   value: wk  ? `${wk.value  >= 0 ? "+" : ""}${Math.abs(wk.value ).toLocaleString("en-US")}` : "—", pos: (wk?.value  ?? 0) > 0, neg: (wk?.value  ?? 0) < 0 },
                { label: "Месяц",    value: mo  ? `${mo.value  >= 0 ? "+" : ""}${Math.abs(mo.value ).toLocaleString("en-US")}` : "—", pos: (mo?.value  ?? 0) > 0, neg: (mo?.value  ?? 0) < 0 },
                { label: "Год",      value: yr  ? `${yr.value  >= 0 ? "+" : ""}${Math.abs(yr.value ).toLocaleString("en-US")}` : "—", pos: (yr?.value  ?? 0) > 0, neg: (yr?.value  ?? 0) < 0 },
                { label: "P&L %",    value: liveCost > 0 ? `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : "—", pos: pnlPct > 0, neg: pnlPct < 0 },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: s.neg ? "#ef4444" : s.pos ? "#22c55e" : "var(--text-primary)" }}>{s.value}</div>
                </div>
              ))}
            </div>
              );
            })()}
          </div>

          <div className="card">
            <div className="card-title">P&L по классам активов</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 8, lineHeight: 1.4 }}>
              Прибыль/убыток по каждому классу активов в портфеле в USD и % от их стоимости
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pnlByClass.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Нет позиций</div>
              ) : pnlByClass.map((c) => (
                <div key={c.currency} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{c.currency}</span>
                  <div style={{ textAlign: "right" }}>
                    <div className={c.pct >= 0 ? "positive" : "negative"} style={{ fontSize: 13, fontWeight: 600 }}>{c.pct >= 0 ? "+" : ""}{c.value.toLocaleString("en-US")}</div>
                    <div className={c.pct >= 0 ? "positive" : "negative"} style={{ fontSize: 11 }}>{c.pct >= 0 ? "+" : ""}{c.pct}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Ключевые показатели</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Уровень риска", value: livePortfolioTotal > 0 ? liveRiskLabel : "—", color: "#f59e0b" },
                { label: "Бета (рынок)", value: app.positions.length > 0 ? liveKeyIndicators.beta : "—" },
                { label: "Макс. просадка (истор.)", value: portfolioMaxDrawdown > 0 ? `${liveKeyIndicators.maxDrawdown}%` : "—", color: "#ef4444" },
                { label: "VaR (95%, 1 день)", value: app.positions.length > 0 ? `${liveKeyIndicators.var95_1d}%` : "—", color: "#ef4444" },
                { label: "VaR (95%, 10 дней)", value: app.positions.length > 0 ? `${liveKeyIndicators.var95_10d}%` : "—", color: "#ef4444" },
                { label: "Sharpe Ratio", value: liveKeyIndicators.sharpe, color: liveKeyIndicators.sharpe !== "–" && parseFloat(liveKeyIndicators.sharpe) > 0 ? "#22c55e" : "#ef4444" },
                { label: "Диверсификация", value: liveKeyIndicators.diversification, color: "#22c55e" },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                  <span style={{ fontWeight: 700, color: item.color ?? "var(--text-primary)" }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Leaders + Sectors + Risk gauge */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 12 }}>
          <div className="card">
            <div className="card-title">Лидеры роста сегодня</div>
            {!quotesLoaded ? (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Загрузка котировок…</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {growthLeaders.filter(l => l.dayChg > 0).length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Нет позиций в плюсе</div>
                )}
                {growthLeaders.filter(l => l.dayChg > 0).map((l) => (
                  <div key={l.ticker} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: l.color }} />
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{l.ticker}</span>
                    </div>
                    <span className="positive" style={{ fontSize: 13, fontWeight: 600 }}>+{l.dayChg.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">Лидеры падения сегодня</div>
            {!quotesLoaded ? (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Загрузка котировок…</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {declineLeaders.filter(l => l.dayChg < 0).length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Нет позиций в минусе</div>
                )}
                {declineLeaders.filter(l => l.dayChg < 0).map((l) => (
                  <div key={l.ticker} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: l.color }} />
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{l.ticker}</span>
                    </div>
                    <span className="negative" style={{ fontSize: 13, fontWeight: 600 }}>{l.dayChg.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">Распределение по классам</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {assetDist.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Нет позиций</div>
              ) : assetDist.map((s) => (
                <div key={s.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{s.name}</span>
                    <span style={{ fontWeight: 600 }}>{s.value}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${s.value}%`, background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div className="card-title">Уровень риска портфеля</div>
            {livePortfolioTotal <= 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 120, gap: 6, color: "var(--text-muted)" }}>
                <div style={{ fontSize: 11, opacity: 0.6 }}>Нет позиций в портфеле</div>
              </div>
            ) : (
              <>
                <GaugeMeter value={liveRiskScore} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, width: "100%", marginTop: 8, fontSize: 11 }}>
                  {[
                    { range: "0 – 25", label: "Низкий", color: "#22c55e" },
                    { range: "25 – 50", label: "Умеренный", color: "#f59e0b" },
                    { range: "50 – 75", label: "Средний", color: "#f97316" },
                    { range: "75 – 100", label: "Высокий", color: "#ef4444" },
                  ].map((item) => (
                    <div key={item.range} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, display: "inline-block" }} />
                      <span style={{ color: "var(--text-secondary)" }}>{item.range}</span>
                      <span style={{ color: item.color }}>{item.label}</span>
                    </div>
                  ))}
                </div>
                {(() => {
                  const advice =
                    liveRiskScore < 25 ? { text: "Портфель консервативный. Можно рассмотреть добавление роста-активов для повышения доходности.", color: "#22c55e" } :
                    liveRiskScore < 50 ? { text: "Умеренный риск — оптимальный баланс. Придерживайтесь текущей стратегии.", color: "#f59e0b" } :
                    liveRiskScore < 75 ? { text: "Средний риск. Контролируйте волатильность, возможна частичная фиксация прибыли.", color: "#f97316" } :
                    { text: "Высокий риск! Рекомендуется снизить долю волатильных активов и зафиксировать часть прибыли.", color: "#ef4444" };
                  return (
                    <div style={{ marginTop: 10, padding: "8px 10px", background: `${advice.color}15`, borderRadius: 8, border: `1px solid ${advice.color}30`, width: "100%" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: advice.color, marginBottom: 3 }}>РЕКОМЕНДАЦИЯ</div>
                      <div style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.4 }}>{advice.text}</div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>

        {/* Row 4: Structure table + Rebalance + Summary stats */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 0.8fr 1fr", gap: 12 }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="card-title" style={{ margin: 0 }}>Текущая структура VS целевая</div>
              <span style={{ fontSize: 9, color: "var(--text-muted)" }}>равновзвешенная</span>
            </div>
            {targetRows.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Нет позиций в портфеле</div>
            ) : (
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                    {["Инструмент", "Текущая доля", "Целевая доля", "Отклонение", "Статус"].map((h) => (
                      <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {targetRows.map((t) => {
                    const deviation = t.deviation;
                    const status = deviation > 1.5 ? "Перевес" : deviation < -1.5 ? "Недовес" : "Норма";
                    return (
                      <tr key={t.ticker} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "6px 8px", fontWeight: 600 }}>{t.ticker}</td>
                        <td style={{ padding: "6px 8px" }}>{t.liveShare.toFixed(2)}%</td>
                        <td style={{ padding: "6px 8px", color: "var(--text-secondary)" }}>{t.target.toFixed(2)}%</td>
                        <td style={{ padding: "6px 8px", color: deviation >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                          {deviation >= 0 ? "+" : ""}{deviation.toFixed(2)}%
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <span className={`badge ${status === "Недовес" ? "badge-red" : status === "Перевес" ? "badge-purple" : "badge-green"}`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <div className="card-title">Следующий ребаланс</div>
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>{nextRebalance.period}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent-light)" }}>{nextRebalance.date}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {nextRebalance.daysLeft === 0 ? "Сегодня" : `Через ${nextRebalance.daysLeft} дн.`}
              </div>
            </div>
            <div className="card-title">Условия для ребаланса</div>
            {rebalanceConditions.map((c) => (
              <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: 3, border: "1px solid var(--border)",
                  background: c.checked ? "#22c55e" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {c.checked && <span style={{ color: "#fff", fontSize: 9, lineHeight: 1, display: "block" }}>✓</span>}
                </div>
                <span style={{ color: c.checked ? "var(--text-primary)" : "var(--text-secondary)" }}>{c.label}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">Итоговая статистика</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { label: "Общая прибыль (USD)", value: `${app.totalPnl >= 0 ? "+" : ""}${Math.round(app.totalPnl).toLocaleString("en-US")}`, color: app.totalPnl >= 0 ? "#22c55e" : "#ef4444" },
                { label: "Общая прибыль (%)", value: `${app.totalPnlPct >= 0 ? "+" : ""}${app.totalPnlPct.toFixed(2)}%`, color: app.totalPnlPct >= 0 ? "#22c55e" : "#ef4444" },
                { label: "Доходность (YTD)", value: periodPerf.year ? `${periodPerf.year.pct >= 0 ? "+" : ""}${Math.abs(periodPerf.year.pct).toFixed(2)}%` : "—", color: periodPerf.year && periodPerf.year.pct >= 0 ? "#22c55e" : "#ef4444" },
                { label: "Лучший день", value: historyStats ? `+${historyStats.bestDay}%` : "—", color: "#22c55e" },
                { label: "Худший день", value: historyStats ? `${historyStats.worstDay}%` : "—", color: "#ef4444" },
                { label: "Средняя дневная", value: historyStats ? `${Number(historyStats.avgDailyReturn) >= 0 ? "+" : ""}${historyStats.avgDailyReturn}%` : "—", color: historyStats && Number(historyStats.avgDailyReturn) >= 0 ? "#22c55e" : "#ef4444" },
                { label: "Положительных дней", value: historyStats ? `${historyStats.positiveDays}%` : "—" },
                { label: "Коэффициент прибыль/риск", value: historyStats ? historyStats.profitRiskRatio : "—" },
                { label: "Торговых дней", value: historyStats ? historyStats.tradingDays.toString() : history.length > 0 ? history.length.toString() : "—" },
              ].map((item) => (
                <div key={item.label} style={{ padding: "8px", background: "var(--bg-secondary)", borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: item.color ?? "var(--text-primary)" }}>{item.value}</div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Long-term strategy */}
      <div style={{ padding: isMobile ? "0 12px 12px" : "0 24px 16px" }}>
        <div className="card">
          <div style={{ display: "flex", gap: 24 }}>
            <div style={{ flex: 1 }}>
              <div className="card-title">Долгосрочная стратегия</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  "Рост капитала через качественные компании и ETF",
                  "Дивиденды и сложный процент",
                  "Защита капитала в кризисы",
                  "Реинвестирование прибыли",
                  "Финансовая свобода и независимость",
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", marginTop: 5, flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{
              padding: "20px 32px", background: "linear-gradient(135deg, #1a0a3a, #0d0020)", borderRadius: 12,
              textAlign: "center", border: "1px solid var(--border)", position: "relative", overflow: "hidden", minWidth: 160,
            }}>
              <div style={{
                position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                width: 100, height: 100, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%)",
              }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-light)", letterSpacing: "0.1em", position: "relative" }}>
                ФИНАНСОВАЯ<br />СВОБОДА<br />ТВОЯ ЦЕЛЬ
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add dividend modal */}
      {showDivModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ width: 360, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Добавить дивиденд</div>
              <button onClick={() => setShowDivModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 18 }}>✕</button>
            </div>
            {[
              { label: "Тикер", key: "ticker", type: "text", placeholder: "VOO" },
              { label: "Дивиденд на акцию (USD)", key: "amountPerShare", type: "number", placeholder: "0.00" },
              { label: "Количество акций", key: "shares", type: "number", placeholder: "0" },
              { label: "Дата выплаты", key: "date", type: "date", placeholder: "" },
              { label: "Примечание", key: "note", type: "text", placeholder: "Квартальный дивиденд" },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{f.label}</div>
                <input type={f.type} placeholder={f.placeholder}
                  value={(divForm as any)[f.key]}
                  onChange={e => setDivForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box" }}
                />
              </div>
            ))}
            {divForm.amountPerShare && divForm.shares && (
              <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>
                Итого: ${(Number(divForm.amountPerShare) * Number(divForm.shares)).toFixed(2)}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={addDividend} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", background: "var(--accent)", color: "white", fontWeight: 600, fontSize: 13 }}>Сохранить</button>
              <button onClick={() => setShowDivModal(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", background: "transparent", color: "var(--text-secondary)", fontSize: 13 }}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
