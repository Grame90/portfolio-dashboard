"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import PageHeader from "@/components/PageHeader";
import { useApp } from "@/lib/useApp";
import { useMobile } from "@/lib/useMobile";

import { TYPE_COLOR, FALLBACK_EVENTS, type HistPeriod } from "./constants";
import type {
  Snapshot, Operation, RecommendedAction, EventItem, TargetRow,
} from "./types";
import { CapitalDynamicsCard } from "./sections/CapitalDynamicsCard";
import { PeriodSummaryCard } from "./sections/PeriodSummaryCard";
import { PortfolioStructureCard } from "./sections/PortfolioStructureCard";
import { GoalGaugeCard } from "./sections/GoalGaugeCard";
import { SnapshotsTable } from "./sections/SnapshotsTable";
import { OperationsTable } from "./sections/OperationsTable";
import { RecommendedActionsCard } from "./sections/RecommendedActionsCard";
import { EventsCard } from "./sections/EventsCard";
import { RebalancePlanCard } from "./sections/RebalancePlanCard";
import { CashFlowCard } from "./sections/CashFlowCard";
import { GoalsListCard } from "./sections/GoalsListCard";

export default function HistoryPage() {
  const isMobile = useMobile();
  const app = useApp();
  const [cashFlowPeriod, setCashFlowPeriod] = useState("1М");
  const [histPeriod, setHistPeriod] = useState<HistPeriod>("ALL");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<EventItem[]>(FALLBACK_EVENTS);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [lsHistory, setLsHistory] = useState<{ date: string; value: number }[]>([]);
  const [histData, setHistData] = useState<Record<string, { dates: string[]; closes: number[] }>>({});
  const [snapExpanded, setSnapExpanded] = useState(false);
  const [opsExpanded, setOpsExpanded] = useState(false);

  const liveTotal = app.portfolioTotal;
  const livePnl   = app.totalPnl;
  const livePnlPct = app.totalPnlPct;
  const liveCost  = app.totalCost;
  const realPositions = app.positions;
  const liveQuotes = app.liveQuotes;

  // Load snapshots from localStorage
  const loadSnapshots = useCallback(() => {
    try {
      const raw = localStorage.getItem("snapshots-data");
      if (raw) setSnapshots(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    loadSnapshots();
    const handler = () => loadSnapshots();
    window.addEventListener("portfolio-snapshot", handler);
    return () => window.removeEventListener("portfolio-snapshot", handler);
  }, [loadSnapshots]);

  // Stable ticker key — useApp returns a fresh positions array every render (quote
  // ticks fire every 300ms), so depending on the array reference re-fires the
  // fetch dozens of times. Reduce to a sorted string keyed on the ticker set only.
  const calendarTickerKey = useMemo(
    () => realPositions.filter(p => p.type !== "Кэш").map(p => p.ticker).sort().join(","),
    [realPositions]
  );

  // Fetch real economic calendar (Finnhub macro + FMP earnings/dividends for portfolio)
  useEffect(() => {
    let cancelled = false;
    const CACHE_KEY = "calendar-cache-v2";
    const CACHE_TTL = 3600_000; // 1 hour
    const tickers = calendarTickerKey;

    async function fetchCalendar() {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { ts, events, cachedTickers } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL && cachedTickers === tickers) {
            if (!cancelled) { setCalendarEvents(events); setCalendarLoading(false); }
            return;
          }
        }
      } catch {}

      try {
        const url = `/api/calendar${tickers ? `?tickers=${encodeURIComponent(tickers)}` : ""}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("calendar fetch failed");
        const { events } = await res.json();
        if (events?.length && !cancelled) {
          setCalendarEvents(events);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), events, cachedTickers: tickers }));
        }
      } catch {
        // keep fallback events
      } finally {
        if (!cancelled) setCalendarLoading(false);
      }
    }

    fetchCalendar();
    return () => { cancelled = true; };
  }, [calendarTickerKey]);

  // Stable ticker key — same pattern as calendarTickerKey. realPositions
  // gets a fresh array reference on every quote tick (300ms), so depending
  // on the array directly causes the historical-prices fetch to re-fire in
  // an infinite loop. Reduce to a sorted string keyed on the ticker set only.
  const histTickerKey = useMemo(
    () => realPositions.filter(p => p.type !== "Кэш" && p.type !== "Крипто").map(p => p.ticker).sort().join(","),
    [realPositions]
  );

  // Load localStorage portfolio-chart-history + fetch historical candles.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("portfolio-chart-history");
      if (raw) {
        const parsed: { date: string; value: number }[] = JSON.parse(raw);
        setLsHistory(parsed);
      }
    } catch {}

    if (histTickerKey.length === 0) return;
    fetch(`/api/historical?tickers=${histTickerKey}&days=500`)
      .then(r => r.ok ? r.json() : {})
      .then(data => setHistData(data || {}))
      .catch(() => {});
  }, [histTickerKey]);

  // Compute portfolio value at each date using instrument prices × current quantities
  const computedTimeline = useMemo((): { date: string; value: number }[] => {
    if (!realPositions.length || Object.keys(histData).length === 0) return [];
    const allDates = new Set<string>();
    for (const hist of Object.values(histData)) hist.dates.forEach(d => allDates.add(d));
    return [...allDates].sort().map(date => {
      let val = 0;
      for (const p of realPositions) {
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
  }, [histData, realPositions]);

  // Merge: computed (higher priority) over localStorage snapshots
  const mergedTimeline = useMemo((): { date: string; value: number }[] => {
    const byDate = new Map<string, number>();
    for (const p of lsHistory) byDate.set(p.date, p.value);
    for (const p of computedTimeline) byDate.set(p.date, p.value);
    const today = new Date().toISOString().slice(0, 10);
    if (liveTotal > 0) byDate.set(today, Math.round(liveTotal));
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
  }, [lsHistory, computedTimeline, liveTotal]);

  // Filter by selected period
  const chartData = useMemo(() => {
    const now = new Date();
    let cutoff = "0000-00-00";
    if (histPeriod === "1M") { const d = new Date(now); d.setMonth(d.getMonth() - 1); cutoff = d.toISOString().slice(0, 10); }
    else if (histPeriod === "3M") { const d = new Date(now); d.setMonth(d.getMonth() - 3); cutoff = d.toISOString().slice(0, 10); }
    else if (histPeriod === "6M") { const d = new Date(now); d.setMonth(d.getMonth() - 6); cutoff = d.toISOString().slice(0, 10); }
    else if (histPeriod === "YTD") { cutoff = `${now.getFullYear()}-01-01`; }
    else if (histPeriod === "1Y") { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); cutoff = d.toISOString().slice(0, 10); }
    const fmtDate = (iso: string) => { const [, m, day] = iso.split("-"); return `${day}.${m}`; };
    return mergedTimeline.filter(p => p.date >= cutoff).map(p => ({ date: fmtDate(p.date), value: p.value }));
  }, [mergedTimeline, histPeriod]);

  // Asset distribution from real positions
  const realDistribution = useMemo(() => {
    if (!realPositions.length) return [];
    const groups: Record<string, { value: number; color: string }> = {};
    for (const p of realPositions) {
      const price = liveQuotes[p.ticker]?.current ?? p.avgPrice;
      const val = p.qty * price;
      if (!groups[p.type]) groups[p.type] = { value: 0, color: TYPE_COLOR[p.type] ?? "#94a3b8" };
      groups[p.type].value += val;
    }
    const totalVal = Object.values(groups).reduce((s, g) => s + g.value, 0);
    return Object.entries(groups).map(([name, g]) => ({
      name, value: Math.round(g.value), color: g.color,
      pct: totalVal > 0 ? ((g.value / totalVal) * 100).toFixed(1) + "%" : "0%",
    }));
  }, [realPositions, liveQuotes]);

  // Operations: prefer an explicit operations-log; otherwise derive initial
  // "Покупка" rows from each position's real purchaseDate. Sorted newest-first.
  const operations = useMemo((): Operation[] => {
    try {
      const raw = localStorage.getItem("operations-log");
      if (raw) {
        const parsed = JSON.parse(raw) as Operation[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    // Derive from current positions using their actual purchase date.
    const fmt = (iso: string): string => {
      if (!iso) return "—";
      const [y, m, d] = iso.split("-");
      return d && m && y ? `${d}.${m}.${y}` : iso;
    };
    return realPositions
      .filter((p) => p.type !== "Кэш")
      .map((p) => ({
        date: fmt(p.purchaseDate),
        // raw ISO kept for sorting
        _sort: p.purchaseDate || "",
        ticker: p.ticker,
        action: "Покупка",
        qty: p.qty,
        price: p.avgPrice,
        sum: -(Math.round(p.qty * p.avgPrice)),
      }))
      .sort((a, b) => (b._sort || "").localeCompare(a._sort || ""))
      .map(({ _sort, ...op }) => op);
  }, [realPositions]);

  // Recommended actions from real portfolio
  const recommendedActions = useMemo((): RecommendedAction[] => {
    if (!realPositions.length) return [];
    const instruments = realPositions.filter(p => p.type !== "Кэш");
    const totalVal = instruments.reduce((s, p) => {
      const price = liveQuotes[p.ticker]?.current ?? p.avgPrice;
      return s + p.qty * price;
    }, 0);
    const actions: RecommendedAction[] = [];

    for (const p of instruments) {
      const price = liveQuotes[p.ticker]?.current ?? p.avgPrice;
      const val = p.qty * price;
      const share = totalVal > 0 ? val / totalVal : 0;
      const pnlPct = p.avgPrice > 0 ? (price - p.avgPrice) / p.avgPrice : 0;

      if (share > 0.30) {
        actions.push({
          action: `Снизить долю ${p.ticker}`,
          priority: "Высокий",
          reason: `Концентрация ${(share * 100).toFixed(1)}% — превышает порог 30%`,
        });
      } else if (share > 0.20 && pnlPct > 0.05) {
        actions.push({
          action: `Контролировать ${p.ticker}`,
          priority: "Средний",
          reason: `Доля ${(share * 100).toFixed(1)}%, рост ${(pnlPct * 100).toFixed(1)}% — риск перевеса`,
        });
      }

      if (pnlPct >= 0.20) {
        actions.push({
          action: `Фиксировать прибыль ${p.ticker}`,
          priority: "Средний",
          reason: `Рост ${(pnlPct * 100).toFixed(1)}% — частичная фиксация целесообразна`,
        });
      } else if (pnlPct <= -0.15) {
        actions.push({
          action: `Сократить позицию ${p.ticker}`,
          priority: "Высокий",
          reason: `Просадка ${(pnlPct * 100).toFixed(1)}% — рассмотрите стоп-лосс`,
        });
      }
    }

    if (instruments.length < 3) {
      actions.push({
        action: "Диверсифицировать портфель",
        priority: "Средний",
        reason: `${instruments.length} инструмент(а) — высокая концентрация риска`,
      });
    }

    if (!actions.length) {
      actions.push({
        action: "Портфель сбалансирован",
        priority: "Низкий",
        reason: "Явных дисбалансов не обнаружено, продолжайте мониторинг",
      });
    }
    return actions.slice(0, 6);
  }, [realPositions, liveQuotes]);

  // Rebalance plan from target-structure
  const rebalancePlan = useMemo(() => {
    const instruments = realPositions.filter(p => p.type !== "Кэш");
    const totalVal = instruments.reduce((s, p) => {
      const price = liveQuotes[p.ticker]?.current ?? p.avgPrice;
      return s + p.qty * price;
    }, 0);
    if (!totalVal || !instruments.length) return [];

    let targets: TargetRow[] = [];
    try {
      const raw = localStorage.getItem("target-structure");
      if (raw) targets = JSON.parse(raw);
    } catch {}

    const targetMap: Record<string, number> = {};
    for (const t of targets) targetMap[t.ticker] = t.target;

    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);
    const deadlineStr = deadline.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

    return instruments
      .map(p => {
        const price = liveQuotes[p.ticker]?.current ?? p.avgPrice;
        const val = p.qty * price;
        const actual = (val / totalVal) * 100;
        const targetPct = targetMap[p.ticker] ?? 0;
        const deviation = actual - targetPct;
        if (Math.abs(deviation) < 1 && targetPct === 0) return null;
        const action = deviation > 0
          ? `Снизить ${p.ticker}`
          : targetPct > 0 ? `Увеличить ${p.ticker}` : null;
        if (!action) return null;
        return {
          action,
          deviation: `${deviation >= 0 ? "+" : ""}${deviation.toFixed(2)}%`,
          target: targetPct > 0 ? `${targetPct.toFixed(2)}%` : "не задана",
          deadline: deadlineStr,
        };
      })
      .filter(Boolean)
      .sort((a, b) => Math.abs(parseFloat(b!.deviation)) - Math.abs(parseFloat(a!.deviation)))
      .slice(0, 7) as { action: string; deviation: string; target: string; deadline: string }[];
  }, [realPositions, liveQuotes]);

  // Cash flow derived from portfolio metrics
  const cashFlow = useMemo(() => {
    const snapshotProfits = snapshots.reduce((s, sn) => s + (sn.profit > 0 ? sn.profit : 0), 0);
    return {
      deposits: Math.round(liveCost),
      withdrawals: 0,
      fixedProfit: snapshotProfits,
      reinvested: 0,
      netFlow: Math.round(livePnl),
    };
  }, [liveCost, livePnl, snapshots]);

  // Goals — connected to real portfolio data
  const goals = useMemo(() => {
    const instruments = realPositions.filter(p => p.type !== "Кэш");
    const items: { goal: string; detail: string; pct: number; status: string; color: string }[] = [];

    // 1. Capital
    const targetAmt = app.settings.targetAmount;
    if (targetAmt > 0) {
      const pct = Math.min(100, Math.round((liveTotal / targetAmt) * 100));
      items.push({
        goal: "Целевой капитал",
        detail: `${Math.round(liveTotal).toLocaleString("en-US")} / ${targetAmt.toLocaleString("en-US")} USD`,
        pct,
        status: pct >= 100 ? "Достигнута" : "В процессе",
        color: "var(--accent)",
      });
    }

    // 2. Portfolio return (target = 15%)
    const returnTarget = 15;
    const returnPct = Math.min(100, Math.max(0, Math.round((livePnlPct / returnTarget) * 100)));
    items.push({
      goal: "Доходность портфеля",
      detail: `${livePnlPct >= 0 ? "+" : ""}${livePnlPct.toFixed(2)}% / цель ${returnTarget}%`,
      pct: returnPct,
      status: livePnlPct >= returnTarget ? "Достигнута" : livePnlPct > 0 ? "В процессе" : "Убыток",
      color: livePnlPct >= 0 ? "var(--green)" : "var(--red)",
    });

    // 3. Diversification (target = 8 instruments)
    const divTarget = 8;
    const divPct = Math.min(100, Math.round((instruments.length / divTarget) * 100));
    items.push({
      goal: "Диверсификация",
      detail: `${instruments.length} / ${divTarget} инструментов`,
      pct: divPct,
      status: divPct >= 100 ? "Достигнута" : "В процессе",
      color: "var(--blue)",
    });

    // 4. Passive income (~0.5%/month yield)
    const targetIncome = app.settings.targetIncome;
    if (targetIncome > 0) {
      const estMonthly = Math.round(liveTotal * 0.005);
      const pct = Math.min(100, Math.round((estMonthly / targetIncome) * 100));
      items.push({
        goal: "Пассивный доход",
        detail: `~${estMonthly.toLocaleString("en-US")} / ${targetIncome.toLocaleString("en-US")} USD/мес`,
        pct,
        status: pct >= 100 ? "Достигнута" : "В процессе",
        color: "var(--yellow)",
      });
    }

    // 5. Investment horizon
    const horizon = app.settings.investmentHorizon;
    if (horizon > 0) {
      const startYear = 2024;
      const elapsed = Math.max(1, new Date().getFullYear() - startYear);
      const pct = Math.min(100, Math.round((elapsed / horizon) * 100));
      items.push({
        goal: "Горизонт инвестирования",
        detail: `${elapsed} / ${horizon} лет`,
        pct,
        status: pct >= 100 ? "Завершён" : "Идёт",
        color: "var(--text-secondary)",
      });
    }

    return items;
  }, [app.settings, liveTotal, livePnlPct, realPositions]);

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader title="ИСТОРИЯ" subtitle="История фиксаций, операций и изменения портфеля" showSnapshot />

      <div style={{ padding: isMobile ? "12px" : "16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr 1fr 0.8fr", gap: 12 }}>
          <CapitalDynamicsCard
            liveTotal={liveTotal}
            livePnl={livePnl}
            livePnlPct={livePnlPct}
            liveCost={liveCost}
            dailyChangePct={app.dailyChangePct}
            instrumentCount={realPositions.filter(p => p.type !== "Кэш").length}
            chartData={chartData}
            histPeriod={histPeriod}
            onPeriodChange={setHistPeriod}
          />
          <PeriodSummaryCard
            liveTotal={liveTotal}
            liveCost={liveCost}
            livePnl={livePnl}
            livePnlPct={livePnlPct}
            dailyChange={app.dailyChange}
            dailyChangePct={app.dailyChangePct}
            instrumentCount={realPositions.filter(p => p.type !== "Кэш").length}
            assetClassCount={new Set(realPositions.map(p => p.type)).size}
            hasPositions={realPositions.length > 0}
          />
          <PortfolioStructureCard
            distribution={realDistribution}
            liveTotal={liveTotal}
            hasPositions={realPositions.length > 0}
          />
          <GoalGaugeCard liveTotal={liveTotal} targetAmount={app.settings.targetAmount} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 0.8fr", gap: 12 }}>
          <SnapshotsTable snapshots={snapshots} expanded={snapExpanded} setExpanded={setSnapExpanded} />
          <OperationsTable operations={operations} expanded={opsExpanded} setExpanded={setOpsExpanded} />
          <RecommendedActionsCard actions={recommendedActions} hasPositions={realPositions.length > 0} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 0.8fr 1fr", gap: 12 }}>
          <EventsCard events={calendarEvents} loading={calendarLoading} />
          <RebalancePlanCard plan={rebalancePlan} hasPositions={realPositions.length > 0} />
          <CashFlowCard data={cashFlow} period={cashFlowPeriod} onPeriodChange={setCashFlowPeriod} />
          <GoalsListCard goals={goals} />
        </div>
      </div>
    </div>
  );
}
