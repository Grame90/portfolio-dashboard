"use client";

import { useState, useEffect, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import { useApp } from "@/lib/useApp";
import { useMobile } from "@/lib/useMobile";
import { usePortfolioHistory } from "@/lib/usePortfolioHistory";
import { DIVIDEND_YIELDS, loadDividends, ReceivedDividend } from "@/app/overview/page";
import {
  TICKER_BETA_A,
  typeColors,
  marketColors,
  FACTORS,
  pearsonCorr,
} from "./analytics-shared";
import MetricsRow from "./sections/MetricsRow";
import AnalyticsCharts from "./sections/AnalyticsCharts";
import RiskSection from "./sections/RiskSection";
import DividendsSection from "./sections/DividendsSection";
import DrawdownSection from "./sections/DrawdownSection";

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
        <MetricsRow
          isMobile={isMobile}
          totalPnl={app.totalPnl}
          totalPnlPct={app.totalPnlPct}
          histLoading={histLoading}
          liveVol30d={liveVol30d}
          analyticsMetrics={analyticsMetrics}
          drawdownStatsMax={drawdownStats.max}
          weightedBeta={weightedBeta}
          betaSub={betaSub}
          spyCorrelation={spyCorrelation}
        />

        {/* Portfolio dynamics vs benchmarks */}
        <AnalyticsCharts
          isMobile={isMobile}
          period={period}
          setPeriod={setPeriod}
          portfolioReturn={portfolioReturn}
          portfolioChartData={portfolioChartData}
          liveSectorDist={liveSectorDist}
          liveCorrelation={liveCorrelation}
          histLoading={histLoading}
        />

        {/* Risk metrics + Stress + Drawdown + Factor */}
        <RiskSection
          isMobile={isMobile}
          liveAssetDist={liveAssetDist}
          liveVar1d={liveVar1d}
          liveVar10d={liveVar10d}
          liveEs={liveEs}
          liveVol30d={liveVol30d}
          liveConcentration={liveConcentration}
          liveStressScenarios={liveStressScenarios}
          liveFactorExposure={liveFactorExposure}
        />

        {/* Dividends section */}
        <DividendsSection
          isMobile={isMobile}
          annualDivIncome={annualDivIncome}
          portfolioDivYield={portfolioDivYield}
          monthlyDivChart={monthlyDivChart}
          divPositions={divPositions}
          receivedDividends={receivedDividends}
        />

        {/* Drawdown chart */}
        <DrawdownSection
          isMobile={isMobile}
          marketDist={marketDist}
          drawdownData={drawdownData}
          drawdownStats={drawdownStats}
        />
      </div>
    </div>
  );
}
