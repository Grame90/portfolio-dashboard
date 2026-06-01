"use client";

import { useState, useEffect, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import { useApp } from "@/lib/useApp";
import { useMobile } from "@/lib/useMobile";
import { usePortfolioHistory } from "@/lib/usePortfolioHistory";
import { DIVIDEND_YIELDS, loadDividends, ReceivedDividend } from "@/app/overview/page";
import {
  periodOptions,
  TICKER_BETA_A,
  typeColors,
  marketColors,
  FACTORS,
  pearsonCorr,
  CorrelationCell,
} from "./analytics-shared";

export default function AnalyticsPage() {
  const isMobile = useMobile();
  const app = useApp();
  const [period, setPeriod] = useState("YTD");
  const [histData, setHistData] = useState<Record<string, { dates: string[]; closes: number[]; returns: number[] }>>({});
  const [histLoading, setHistLoading] = useState(false);
  const [receivedDividends, setReceivedDividends] = useState<ReceivedDividend[]>([]);
  const [history, setHistory] = useState<{ date: string; value: number; cost: number }[]>([]);

  useEffect(() => { setReceivedDividends(loadDividends()); }, []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("portfolio-chart-history");
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  const { mergedTimeline } = usePortfolioHistory(app.positions, history, app.portfolioTotal, app.totalCost);

  const divPositions = useMemo(() => {
    return app.positions
      .filter(p => p.type !== "Кэш")
      .map(p => {
        const price = app.liveQuotes[p.ticker]?.current || p.avgPrice;
        const val = p.qty * price;
        const yieldPct = DIVIDEND_YIELDS[p.ticker] ?? 0;
        const annual = val * yieldPct / 100;
        return { id: p.id, ticker: p.ticker, yieldPct, annual, monthly: annual / 12, quarterly: annual / 4, val, qty: p.qty };
      })
      .filter(p => p.yieldPct > 0)
      .sort((a, b) => b.annual - a.annual);
  }, [app.positions, app.liveQuotes]);

  const annualDivIncome = divPositions.reduce((s, p) => s + p.annual, 0);
  const portfolioDivYield = app.portfolioTotal > 0 ? (annualDivIncome / app.portfolioTotal) * 100 : 0;

  // Monthly projected dividend chart (quarterly payments evenly distributed)
  const monthlyDivChart = useMemo(() => {
    const MONTHS = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];
    const projected = Array(12).fill(0).map((_, i) => ({ month: MONTHS[i], projected: 0, received: 0 }));
    divPositions.forEach(p => { projected.forEach(m => { m.projected += p.monthly; }); });
    const year = new Date().getFullYear().toString();
    receivedDividends.filter(d => d.date.startsWith(year)).forEach(d => {
      const mo = parseInt(d.date.split("-")[1], 10) - 1;
      if (mo >= 0 && mo < 12) projected[mo].received += d.totalUSD;
    });
    return projected.map(m => ({ ...m, projected: Math.round(m.projected), received: Math.round(m.received) }));
  }, [divPositions, receivedDividends]);

  const liveAssetDist = useMemo(() => {
    const groups: Record<string, number> = {};
    app.positions.forEach(p => {
      const val = p.qty * (app.liveQuotes[p.ticker]?.current || p.avgPrice);
      groups[p.type] = (groups[p.type] || 0) + val;
    });
    const total = Object.values(groups).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(groups).map(([name, val]) => ({
      name, value: Math.round((val / total) * 100), color: typeColors[name] ?? "#9d6ef5",
    }));
  }, [app.positions, app.liveQuotes]);

  const liveSectorDist = liveAssetDist;

  const weightedBeta = useMemo(() => {
    if (!app.portfolioTotal) return 1.0;
    return app.positions.reduce((s, p) => {
      const val = p.qty * (app.liveQuotes[p.ticker]?.current || p.avgPrice);
      return s + (TICKER_BETA_A[p.ticker] ?? 1.0) * (val / app.portfolioTotal);
    }, 0);
  }, [app.positions, app.liveQuotes, app.portfolioTotal]);

  const liveCorrelation = useMemo(() => {
    const benchmarks = new Set(["SPY", "QQQ", "GLD"]);
    const tickers = Object.keys(histData).filter(t => !benchmarks.has(t) && histData[t].returns.length > 10);
    if (tickers.length < 2) return null;
    const matrix = tickers.map((ta) =>
      tickers.map((tb) => {
        if (ta === tb) return 1;
        return parseFloat(pearsonCorr(histData[ta].returns, histData[tb].returns).toFixed(2));
      })
    );
    return { tickers, data: matrix };
  }, [histData]);

  const spyCorrelation = useMemo(
    () => parseFloat(Math.min(0.99, Math.max(0.05, weightedBeta * 0.65)).toFixed(2)),
    [weightedBeta]
  );

  const drawdownData = useMemo(() => {
    if (!mergedTimeline.length) return [];
    let peak = mergedTimeline[0].value;
    return mergedTimeline.map(h => {
      if (h.value > peak) peak = h.value;
      const dd = peak > 0 ? ((h.value - peak) / peak) * 100 : 0;
      return { date: h.date.slice(5), drawdown: parseFloat(dd.toFixed(2)) };
    });
  }, [mergedTimeline]);

  const drawdownStats = useMemo(() => {
    if (!drawdownData.length) return { current: 0, max: 0, avg: 0 };
    const vals = drawdownData.map(d => d.drawdown);
    return {
      current: vals[vals.length - 1],
      max: Math.min(...vals),
      avg: vals.reduce((s, v) => s + v, 0) / vals.length,
    };
  }, [drawdownData]);

  const marketDist = useMemo(() => {
    const groups: Record<string, number> = {};
    app.positions.forEach(p => {
      const val = p.qty * (app.liveQuotes[p.ticker]?.current || p.avgPrice);
      const mkt = p.type === "Крипто" ? "Крипто" : p.type === "Кэш" ? "Кэш" : p.type === "Сырьё" ? "Сырьё" : p.type === "Облигация" ? "Облигации" : "США";
      groups[mkt] = (groups[mkt] || 0) + val;
    });
    const total = Object.values(groups).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(groups)
      .map(([market, val]) => ({ market, value: parseFloat((val / total * 100).toFixed(1)), color: marketColors[market] ?? "#9d6ef5" }))
      .sort((a, b) => b.value - a.value);
  }, [app.positions, app.liveQuotes]);

  const bmHistory = useMemo(() => {
    const spy = histData["SPY"];
    if (!spy?.closes?.length) return [];
    const qqq = histData["QQQ"];
    const gld = histData["GLD"];
    const baseS = spy.closes[0];
    const baseQ = qqq?.closes[0] ?? 1;
    const baseG = gld?.closes[0] ?? 1;
    return spy.dates.map((date, i) => ({
      date,
      sp500: parseFloat(((spy.closes[i] / baseS - 1) * 100).toFixed(2)),
      nasdaq: qqq ? parseFloat(((qqq.closes[Math.min(i, qqq.closes.length - 1)] / baseQ - 1) * 100).toFixed(2)) : 0,
      gold: gld ? parseFloat(((gld.closes[Math.min(i, gld.closes.length - 1)] / baseG - 1) * 100).toFixed(2)) : 0,
    }));
  }, [histData]);

  const portfolioChartData = useMemo(() => {
    const cutoff = period === "1М" ? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10) :
      period === "3М" ? new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10) :
      period === "6М" ? new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10) :
      period === "1Г" ? new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10) :
      period === "YTD" ? `${new Date().getFullYear()}-01-01` : "0000-00-00";
    const filtered = mergedTimeline.filter(h => h.date >= cutoff);
    const filteredBm = bmHistory.filter(b => b.date >= cutoff);
    if (!filtered.length) return filteredBm.map(b => ({ date: b.date.slice(5), portfolio: 0, sp500: b.sp500, nasdaq: b.nasdaq, gold: b.gold }));
    const base = filtered[0].value;
    const baseSpy = filteredBm[0]?.sp500 ?? 0;
    const baseQqq = filteredBm[0]?.nasdaq ?? 0;
    const baseGld = filteredBm[0]?.gold ?? 0;
    return filtered.map((h, i) => {
      const bmIdx = filteredBm.length > 1 ? Math.round(i * (filteredBm.length - 1) / Math.max(filtered.length - 1, 1)) : 0;
      const bm = filteredBm[bmIdx];
      return {
        date: h.date.slice(5),
        portfolio: parseFloat(((h.value / base - 1) * 100).toFixed(2)),
        sp500: bm ? parseFloat((bm.sp500 - baseSpy).toFixed(2)) : 0,
        nasdaq: bm ? parseFloat((bm.nasdaq - baseQqq).toFixed(2)) : 0,
        gold: bm ? parseFloat((bm.gold - baseGld).toFixed(2)) : 0,
      };
    });
  }, [mergedTimeline, period, bmHistory]);

  const portfolioReturn = useMemo(() => {
    const filtered = period === "1М" ? mergedTimeline.slice(-30) :
      period === "3М" ? mergedTimeline.slice(-90) :
      period === "6М" ? mergedTimeline.slice(-180) :
      period === "1Г" ? mergedTimeline.slice(-365) : mergedTimeline;
    if (filtered.length < 2) return null;
    const ret = (filtered[filtered.length - 1].value / filtered[0].value - 1) * 100;
    return (ret >= 0 ? "+" : "") + ret.toFixed(2) + "%";
  }, [mergedTimeline, period]);

  useEffect(() => {
    const posTickers = app.positions.filter(p => p.type !== "Кэш" && p.type !== "Крипто").map(p => p.ticker);
    const allTickers = [...new Set([...posTickers, "SPY", "QQQ", "GLD"])];
    setHistLoading(true);
    fetch(`/api/historical?tickers=${allTickers.join(",")}&days=365`)
      .then(r => r.json())
      .then((d: Record<string, { dates: string[]; closes: number[]; returns: number[] }>) => { setHistData(d); setHistLoading(false); })
      .catch(() => setHistLoading(false));
  }, [app.positions]);

  const analyticsMetrics = (() => {
    const benchmarks = new Set(["SPY", "QQQ", "GLD"]);
    const allReturns: number[][] = Object.entries(histData).filter(([t]) => !benchmarks.has(t)).map(([, d]) => d.returns).filter(r => r.length > 5);
    if (!allReturns.length) return null;
    const minLen = Math.min(...allReturns.map(r => r.length));
    const portReturns = Array.from({ length: minLen }, (_, i) =>
      allReturns.reduce((s, r) => s + (r[r.length - minLen + i] || 0), 0) / allReturns.length
    );
    const mean = portReturns.reduce((s, r) => s + r, 0) / portReturns.length;
    const variance = portReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / portReturns.length;
    const dailyVol = Math.sqrt(variance);
    const annualVol = dailyVol * Math.sqrt(252);
    const annualReturn = mean * 252;
    const riskFree = 4.5;
    const sharpe = annualVol > 0 ? (annualReturn - riskFree) / annualVol : 0;
    let peak = -Infinity, maxDD = 0, cumulative = 0;
    for (const r of portReturns) {
      cumulative += r;
      if (cumulative > peak) peak = cumulative;
      const dd = peak - cumulative;
      if (dd > maxDD) maxDD = dd;
    }
    return { volatility: annualVol.toFixed(2), sharpe: sharpe.toFixed(2), maxDrawdown: (-maxDD).toFixed(2) };
  })();

  const liveVar1d = parseFloat((weightedBeta * 1.2 * 1.645).toFixed(2));
  const liveVar10d = parseFloat((liveVar1d * Math.sqrt(10)).toFixed(2));
  const liveEs = parseFloat((liveVar1d * 1.25).toFixed(2));
  const liveVol30d = analyticsMetrics?.volatility ?? (weightedBeta * 15).toFixed(2);
  const top3Sum = [...app.positions].map(p => p.qty * (app.liveQuotes[p.ticker]?.current || p.avgPrice)).sort((a, b) => b - a).slice(0, 3).reduce((s, v) => s + v, 0);
  const liveConcentration = app.portfolioTotal > 0 ? parseFloat((top3Sum / app.portfolioTotal * 100).toFixed(1)) : 0;
  const betaSub = weightedBeta > 1.15 ? "Выше рынка" : weightedBeta < 0.85 ? "Ниже рынка" : "На уровне рынка";

  const liveStressScenarios = useMemo(() => {
    const total = app.portfolioTotal;
    if (total <= 0) return [];
    const cryptoW = app.positions.filter(p => p.type === "Крипто")
      .reduce((s, p) => s + p.qty * (app.liveQuotes[p.ticker]?.current || p.avgPrice), 0) / total;
    const techW = app.positions.filter(p => ["ETF","Акция"].includes(p.type) && !["GLD","SLV","IAU"].includes(p.ticker))
      .reduce((s, p) => s + p.qty * (app.liveQuotes[p.ticker]?.current || p.avgPrice), 0) / total;
    const scenarios = [
      { scenario: "Финансовый кризис (2008)", pct: -(weightedBeta * 35 + cryptoW * 30) },
      { scenario: "Пандемия (COVID-19)",       pct: -(weightedBeta * 22 + cryptoW * 25) },
      { scenario: "Инфляционный шок",           pct: -(techW * 15 + 5) },
      { scenario: "Рецессия (мягкая)",           pct: -(weightedBeta * 8) },
      { scenario: "Рост ставок (+2%)",           pct: -(weightedBeta * 6) },
      { scenario: "Геополитический кризис",      pct: -(weightedBeta * 5 + cryptoW * 10) },
      { scenario: "Бычий сценарий",              pct: weightedBeta * 18 + cryptoW * 15 },
    ];
    return scenarios.map(s => ({
      scenario: s.scenario,
      lossPct: Math.round(s.pct * 10) / 10,
      lossUsd: Math.round(total * s.pct / 100),
      probability: Math.abs(s.pct) < 7 ? "Высокая" : Math.abs(s.pct) < 20 ? "Средняя" : "Низкая",
    }));
  }, [app.positions, app.liveQuotes, app.portfolioTotal, weightedBeta]);

  const liveFactorExposure = useMemo(() => {
    if (!app.portfolioTotal) return [
      { factor: "Market (Рынок)", value: 0.85 },
      { factor: "Size (Размер)", value: 0.35 },
      { factor: "Value (Стоимость)", value: 0.30 },
      { factor: "Growth (Рост)", value: 0.55 },
      { factor: "Quality (Качество)", value: 0.55 },
      { factor: "Momentum (Моментум)", value: 0.45 },
      { factor: "Low Volatility", value: 0.25 },
    ];
    const totals = { market: 0, growth: 0, value: 0, quality: 0, momentum: 0, lowVol: 0, size: 0 };
    app.positions.forEach(p => {
      if (p.type === "Кэш") return;
      const val = p.qty * (app.liveQuotes[p.ticker]?.current || p.avgPrice);
      const w = val / app.portfolioTotal;
      const f = FACTORS[p.ticker] ?? {};
      const isCrypto = p.type === "Крипто";
      totals.market   += (f.market   ?? (isCrypto ? 0.3 : 0.85)) * w;
      totals.growth   += (f.growth   ?? (isCrypto ? 0.6 : p.type === "Акция" ? 0.55 : 0.4)) * w;
      totals.value    += (f.value    ?? (p.type === "Акция" ? 0.3 : 0.2)) * w;
      totals.quality  += (f.quality  ?? 0.5) * w;
      totals.momentum += (f.momentum ?? 0.45) * w;
      totals.lowVol   += (f.lowVol   ?? (isCrypto ? 0.0 : 0.3)) * w;
      totals.size     += (f.size     ?? (p.type === "ETF" ? 0.3 : 0.5)) * w;
    });
    return [
      { factor: "Market (Рынок)", value: Math.round(totals.market * 100) / 100 },
      { factor: "Size (Размер)", value: Math.round(totals.size * 100) / 100 },
      { factor: "Value (Стоимость)", value: Math.round(totals.value * 100) / 100 },
      { factor: "Growth (Рост)", value: Math.round(totals.growth * 100) / 100 },
      { factor: "Quality (Качество)", value: Math.round(totals.quality * 100) / 100 },
      { factor: "Momentum (Моментум)", value: Math.round(totals.momentum * 100) / 100 },
      { factor: "Low Volatility", value: Math.round(totals.lowVol * 100) / 100 },
    ];
  }, [app.positions, app.liveQuotes, app.portfolioTotal]);

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader title="АНАЛИТИКА" subtitle="Глубокий анализ портфеля и рыночной среды" />

      <div style={{ padding: isMobile ? "12px" : "16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Top metrics */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(7, 1fr)", gap: 10 }}>
          {[
            { label: "Общая прибыль (USD)", value: `${app.totalPnl >= 0 ? "+" : ""}${Math.round(app.totalPnl).toLocaleString("en-US")}`, sub: `${app.totalPnlPct.toFixed(2)}%`, color: app.totalPnl >= 0 ? "#22c55e" : "#ef4444" },
            { label: "Средняя доходность (YTD)", value: `${app.totalPnlPct >= 0 ? "+" : ""}${app.totalPnlPct.toFixed(2)}%`, color: app.totalPnlPct >= 0 ? "#22c55e" : "#ef4444" },
            { label: "Волатильность портфеля", value: histLoading ? "…" : `${liveVol30d}%`, sub: "Умеренная", color: "#f59e0b" },
            { label: "Коэффициент Шарпа", value: histLoading ? "…" : (analyticsMetrics?.sharpe ?? "–"), sub: "Хороший", color: "#22c55e" },
            { label: "Макс. просадка (истор.)", value: histLoading ? "…" : `${analyticsMetrics?.maxDrawdown ?? drawdownStats.max.toFixed(2)}%`, sub: "Умеренная", color: "#ef4444" },
            { label: "Бета (рынок)", value: weightedBeta.toFixed(2), sub: betaSub },
            { label: "Корреляция с S&P 500", value: spyCorrelation.toString(), sub: spyCorrelation >= 0.75 ? "Высокая" : spyCorrelation >= 0.5 ? "Средняя" : "Низкая", color: "#f59e0b" },
          ].map((m) => (
            <div key={m.label} className="card" style={{ padding: 12 }}>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.value}</div>
              {m.sub && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{m.sub}</div>}
            </div>
          ))}
        </div>

        {/* Portfolio dynamics vs benchmarks */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr 1fr", gap: 12 }}>
          <div className="card">
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? 6 : 0, marginBottom: 8 }}>
              <div className="card-title" style={{ margin: 0 }}>Динамика портфеля</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {periodOptions.map((p) => (
                  <button key={p} className={`tab-btn ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)} style={{ fontSize: 10, padding: "3px 7px" }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: isMobile ? 8 : 12, marginBottom: 8, flexWrap: "wrap" }}>
              {[
                { label: "Портфель", color: "#7c3aed", value: portfolioReturn ?? "–" },
                { label: "S&P 500", color: "#22c55e", value: portfolioChartData.length ? `${(portfolioChartData[portfolioChartData.length - 1]?.sp500 ?? 0).toFixed(2)}%` : "–" },
                { label: "NASDAQ", color: "#3b82f6", value: portfolioChartData.length ? `${(portfolioChartData[portfolioChartData.length - 1]?.nasdaq ?? 0).toFixed(2)}%` : "–" },
                { label: "Золото", color: "#f59e0b", value: portfolioChartData.length ? `${(portfolioChartData[portfolioChartData.length - 1]?.gold ?? 0).toFixed(2)}%` : "–" },
              ].map((b) => (
                <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                  <span style={{ width: 12, height: 2, background: b.color, display: "inline-block" }} />
                  <span style={{ color: "var(--text-secondary)" }}>{b.label}</span>
                  <span style={{ color: b.color, fontWeight: 700 }}>{b.value}</span>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={portfolioChartData}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#555577" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: "#555577" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }} formatter={(v: any) => [`${v.toFixed(2)}%`]} />
                <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="portfolio" stroke="#7c3aed" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sp500" stroke="#22c55e" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="nasdaq" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="gold" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-title">Распределение по классам</div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={liveSectorDist} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={70}>
                  {liveSectorDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }} formatter={(v: any) => [`${v}%`]} />
              </PieChart>
            </ResponsiveContainer>
            {liveSectorDist.map((s) => (
              <div key={s.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block" }} />
                  <span style={{ color: "var(--text-secondary)" }}>{s.name}</span>
                </span>
                <span style={{ fontWeight: 600 }}>{s.value}%</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">Корреляционная матрица</div>
            {liveCorrelation ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", fontSize: 10 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "4px 6px", color: "var(--text-muted)" }}></th>
                      {liveCorrelation.tickers.map((t) => (
                        <th key={t} style={{ padding: "4px 6px", color: "var(--text-secondary)", fontWeight: 600, fontSize: 9 }}>{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {liveCorrelation.data.map((row, i) => (
                      <tr key={i}>
                        <td style={{ padding: "4px 6px", fontWeight: 700, color: "var(--text-secondary)", fontSize: 9, whiteSpace: "nowrap" }}>
                          {liveCorrelation.tickers[i]}
                        </td>
                        {row.map((val, j) => <CorrelationCell key={j} value={val} />)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>
                {histLoading ? "Загрузка данных…" : "Добавьте 2+ позиции (акции/ETF) для расчёта корреляции"}
              </div>
            )}
          </div>
        </div>

        {/* Risk metrics + Stress + Drawdown + Factor */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 12 }}>
          <div className="card">
            <div className="card-title">Распределение по типам активов</div>
            <ResponsiveContainer width="100%" height={130}>
              <PieChart>
                <Pie data={liveAssetDist} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55}>
                  {liveAssetDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }} formatter={(v: any) => [`${v}%`]} />
              </PieChart>
            </ResponsiveContainer>
            {liveAssetDist.map((e) => (
              <div key={e.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: e.color, display: "inline-block" }} />
                  <span style={{ color: "var(--text-secondary)" }}>{e.name}</span>
                </span>
                <span style={{ fontWeight: 600 }}>{e.value}%</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">Анализ риска</div>
            {[
              { label: "VaR (1д, 95%)", value: `${liveVar1d}%`, level: liveVar1d < 2 ? "Низкий" : "Умеренный", color: liveVar1d < 2 ? "#22c55e" : "#f59e0b" },
              { label: "VaR (10д, 95%)", value: `${liveVar10d}%`, level: liveVar10d < 7 ? "Умеренный" : "Высокий", color: liveVar10d < 7 ? "#f59e0b" : "#ef4444" },
              { label: "Exp. Shortfall", value: `${liveEs}%`, level: liveEs < 3 ? "Низкий" : "Умеренный", color: liveEs < 3 ? "#22c55e" : "#f59e0b" },
              { label: "Волатильность", value: `${liveVol30d}%`, level: "Умеренный", color: "#f59e0b" },
              { label: "Концентрация", value: `${liveConcentration}%`, level: liveConcentration > 60 ? "Высокий" : "Умеренный", color: liveConcentration > 60 ? "#ef4444" : "#f59e0b" },
              { label: "Леверидж", value: "1.00x", level: "Низкий", color: "#22c55e" },
            ].map((m) => (
              <div key={m.label} style={{ marginBottom: 8, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <span style={{ color: "var(--text-secondary)", fontSize: isMobile ? 10 : 12 }}>{m.label}</span>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontWeight: 700, color: m.color, fontSize: isMobile ? 11 : 12 }}>{m.value}</span>
                    <span style={{ fontSize: 9, color: m.color, marginLeft: 4 }}>{m.level}</span>
                  </div>
                </div>
                <div className="progress-bar" style={{ width: "100%" }}>
                  <div className="progress-fill" style={{ width: `${Math.abs(parseFloat(m.value)) * 5}%`, background: m.color }} />
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">Сценарный анализ (стресс-тест)</div>
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "4px 6px", textAlign: "left" }}>Сценарий</th>
                  <th style={{ padding: "4px 6px", textAlign: "right" }}>Изменение</th>
                  <th style={{ padding: "4px 6px", textAlign: "right" }}>Убыток</th>
                </tr>
              </thead>
              <tbody>
                {liveStressScenarios.map((s) => (
                  <tr key={s.scenario} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px", color: "var(--text-secondary)", fontSize: 10 }}>{s.scenario.split("(")[0].trim()}</td>
                    <td style={{ padding: "6px", textAlign: "right", color: s.lossPct >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                      {s.lossPct >= 0 ? "+" : ""}{s.lossPct.toFixed(1)}%
                    </td>
                    <td style={{ padding: "6px", textAlign: "right", color: s.lossUsd >= 0 ? "#22c55e" : "#ef4444" }}>
                      {s.lossUsd >= 0 ? "+" : ""}{(s.lossUsd / 1000).toFixed(0)}K
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-title">Факторный анализ (Exposure)</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={liveFactorExposure} layout="vertical" barSize={10}>
                <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 9, fill: "#555577" }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="factor" tick={{ fontSize: 9, fill: "#aaaacc" }} tickLine={false} axisLine={false} width={100} />
                <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }} />
                <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 10, fill: "#aaaacc" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dividends section */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 0.8fr 1fr", gap: 12 }}>
          {/* Monthly bar chart */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="card-title" style={{ margin: 0 }}>Дивидендный доход по месяцам</div>
              <div style={{ display: "flex", gap: 12, fontSize: 10, color: "var(--text-secondary)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--accent)", display: "inline-block" }} />Прогноз
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: "#22c55e", display: "inline-block" }} />Получено
                </span>
              </div>
            </div>
            {annualDivIncome === 0 ? (
              <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
                Нет дивидендных позиций в портфеле
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyDivChart} barSize={10} barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} width={36} />
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }} formatter={(v: any) => [`$${Number(v).toLocaleString("en-US")}`]} />
                  <Bar dataKey="projected" fill="var(--accent)" fillOpacity={0.5} radius={[3, 3, 0, 0]} name="Прогноз" />
                  <Bar dataKey="received" fill="#22c55e" radius={[3, 3, 0, 0]} name="Получено" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Summary */}
          <div className="card">
            <div className="card-title">Дивидендная доходность</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                { label: "Годовой доход (оценка)", value: `$${Math.round(annualDivIncome).toLocaleString("en-US")}`, color: "#22c55e" },
                { label: "Доходность портфеля", value: `${portfolioDivYield.toFixed(2)}%`, color: "#22c55e" },
                { label: "Ежемесячно", value: `~$${Math.round(annualDivIncome / 12).toLocaleString("en-US")}` },
                { label: "Квартально", value: `~$${Math.round(annualDivIncome / 4).toLocaleString("en-US")}` },
                { label: "Дивидендных позиций", value: `${divPositions.length}` },
                { label: "Получено YTD", value: `$${Math.round(receivedDividends.filter(d => d.date.startsWith(new Date().getFullYear().toString())).reduce((s, d) => s + d.totalUSD, 0)).toLocaleString("en-US")}`, color: "#22c55e" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                  <span style={{ fontWeight: 700, color: (item as any).color ?? "var(--text-primary)" }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Per-position table */}
          <div className="card">
            <div className="card-title">Дивиденды по позициям</div>
            {divPositions.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>Нет дивидендных позиций</div>
            ) : (
              <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                    {["Тикер", "Доходн.", "Год", "Квартал"].map(h => (
                      <th key={h} style={{ padding: "4px 6px", textAlign: h === "Тикер" ? "left" : "right", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {divPositions.map(p => (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px", fontWeight: 700, color: "var(--accent-light)" }}>{p.ticker}</td>
                      <td style={{ padding: "6px", textAlign: "right", color: "#22c55e", fontWeight: 600 }}>{p.yieldPct.toFixed(2)}%</td>
                      <td style={{ padding: "6px", textAlign: "right" }}>${Math.round(p.annual).toLocaleString("en-US")}</td>
                      <td style={{ padding: "6px", textAlign: "right", color: "var(--text-secondary)" }}>${Math.round(p.quarterly).toLocaleString("en-US")}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, background: "var(--bg-secondary)" }}>
                    <td colSpan={2} style={{ padding: "6px", color: "var(--text-secondary)", fontSize: 10 }}>ИТОГО</td>
                    <td style={{ padding: "6px", textAlign: "right" }}>${Math.round(annualDivIncome).toLocaleString("en-US")}</td>
                    <td style={{ padding: "6px", textAlign: "right", color: "var(--text-secondary)" }}>${Math.round(annualDivIncome / 4).toLocaleString("en-US")}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Drawdown chart */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "0.8fr 1.2fr", gap: 12 }}>
          <div className="card">
            <div className="card-title">Распределение по рынкам</div>
            {marketDist.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>Нет позиций в портфеле</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                {marketDist.map((m) => (
                  <div key={m.market}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--text-secondary)" }}>{m.market}</span>
                      <span style={{ fontWeight: 700 }}>{m.value}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${m.value}%`, background: m.color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="card-title" style={{ margin: 0 }}>Динамика просадки (история)</div>
              <div style={{ display: "flex", gap: 4 }}>
                {["1Г", "2Г", "ВСЕ"].map((p) => (
                  <button key={p} className={`tab-btn ${p === "1Г" ? "active" : ""}`} style={{ fontSize: 10, padding: "3px 7px" }}>{p}</button>
                ))}
              </div>
            </div>
            {drawdownData.length > 0 ? (
              <ResponsiveContainer width="100%" height={170}>
                <AreaChart data={drawdownData}>
                  <defs>
                    <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#555577" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: "#555577" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }} formatter={(v: any) => [`${v.toFixed(2)}%`, "Просадка"]} />
                  <Area type="monotone" dataKey="drawdown" stroke="#ef4444" strokeWidth={1.5} fill="url(#ddGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 170, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
                Нет истории портфеля для отображения просадки
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
              {[
                { label: "Текущая просадка", value: drawdownStats.current !== 0 ? `${drawdownStats.current.toFixed(2)}%` : "0%", color: "#ef4444" },
                { label: "Макс. просадка", value: drawdownStats.max !== 0 ? `${drawdownStats.max.toFixed(2)}%` : "0%", color: "#ef4444" },
                { label: "Средняя просадка", value: `${drawdownStats.avg.toFixed(2)}%`, color: "#f59e0b" },
                { label: "Время восстановления", value: "–", color: "var(--text-primary)" },
              ].map((item) => (
                <div key={item.label} style={{ textAlign: "center", padding: "8px", background: "var(--bg-secondary)", borderRadius: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
