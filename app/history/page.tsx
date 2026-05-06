"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import PageHeader from "@/components/PageHeader";
import ApexChart from "@/components/ApexChart";
import { useApp } from "@/lib/useApp";
import { useMobile } from "@/lib/useMobile";

const TYPE_COLOR: Record<string, string> = {
  "Акция": "#7c3aed", "ETF": "#3b82f6", "Сырьё": "#f59e0b",
  "Крипто": "#f97316", "Облигация": "#06b6d4", "Кэш": "#22c55e",
};

type Snapshot = {
  date: string; time: string; capital: number; cost: number;
  profit: number; profitPct: string; comment: string;
};

type Operation = {
  date: string; ticker: string; action: string; qty: number; price: number; sum: number;
};

type RecommendedAction = { action: string; priority: "Высокий" | "Средний" | "Низкий"; reason: string };
type EventItem = { kind?: string; date: string; isoDate?: string; event: string; importance: string; estimate?: string | null; actual?: string | null; ticker?: string | null };
type TargetRow = { ticker: string; target: number };

const FALLBACK_EVENTS: EventItem[] = (() => {
  const dFwd = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  };
  return [
    { date: dFwd(3),  event: "Протокол FOMC",           importance: "Высокая" },
    { date: dFwd(7),  event: "Инфляция CPI (м/м)",      importance: "Высокая" },
    { date: dFwd(12), event: "Решение ФРС по ставке",   importance: "Высокая" },
    { date: dFwd(16), event: "ВВП (кв/кв)",             importance: "Высокая" },
    { date: dFwd(20), event: "Занятость вне с/х (NFP)", importance: "Высокая" },
    { date: dFwd(25), event: "Базовый PCE (м/м)",       importance: "Высокая" },
  ];
})();

export default function HistoryPage() {
  const isMobile = useMobile();
  const app = useApp();
  const [cashFlowPeriod, setCashFlowPeriod] = useState("1М");
  const [histPeriod, setHistPeriod] = useState<"1M"|"3M"|"6M"|"YTD"|"1Y"|"ALL">("ALL");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<EventItem[]>(FALLBACK_EVENTS);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [lsHistory, setLsHistory] = useState<{ date: string; value: number }[]>([]);
  const [histData, setHistData] = useState<Record<string, { dates: string[]; closes: number[] }>>({});

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

  // Fetch real economic calendar (Finnhub macro + FMP earnings/dividends for portfolio)
  useEffect(() => {
    let cancelled = false;
    const CACHE_KEY = "calendar-cache-v2";
    const CACHE_TTL = 3600_000; // 1 hour

    async function fetchCalendar() {
      const tickers = realPositions
        .filter(p => p.type !== "Кэш")
        .map(p => p.ticker)
        .join(",");

      // Use cached version if still fresh and tickers haven't changed
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

    if (realPositions.length > 0 || realPositions.length === 0) {
      fetchCalendar();
    }
    return () => { cancelled = true; };
  }, [realPositions]);

  // Load localStorage portfolio-chart-history + fetch Finnhub candles
  useEffect(() => {
    try {
      const raw = localStorage.getItem("portfolio-chart-history");
      if (raw) {
        const parsed: { date: string; value: number }[] = JSON.parse(raw);
        setLsHistory(parsed);
      }
    } catch {}

    const tickers = realPositions
      .filter(p => p.type !== "Кэш" && p.type !== "Крипто")
      .map(p => p.ticker);
    if (tickers.length > 0) {
      fetch(`/api/historical?tickers=${tickers.join(",")}&days=500`)
        .then(r => r.ok ? r.json() : {})
        .then(data => setHistData(data || {}))
        .catch(() => {});
    }
  }, [realPositions]);

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

  // Operations: generated from current positions as initial purchases
  const operations = useMemo((): Operation[] => {
    try {
      const raw = localStorage.getItem("operations-log");
      if (raw) return JSON.parse(raw);
    } catch {}
    // Fall back: generate from current positions
    const today = new Date();
    return realPositions
      .filter(p => p.type !== "Кэш")
      .map((p, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        return {
          date: d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }),
          ticker: p.ticker,
          action: "Покупка",
          qty: p.qty,
          price: p.avgPrice,
          sum: -(Math.round(p.qty * p.avgPrice)),
        };
      });
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
        {/* Row 1: Capital dynamics + Summary + Distributions + Goal */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr 1fr 0.8fr", gap: 12 }}>
          {/* Capital Dynamics */}
          <div className="card" style={{ position: "relative", overflow: "hidden", padding: "18px 20px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div className="card-title" style={{ margin: 0, marginBottom: 6 }}>Динамика капитала</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-primary)", lineHeight: 1 }}>
                    {liveTotal > 0 ? `$${Math.round(liveTotal).toLocaleString("en-US")}` : "—"}
                  </span>
                  {liveTotal > 0 && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>USD</span>}
                </div>
                {liveTotal > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: livePnl >= 0 ? "#22c55e" : "#ef4444" }}>
                      {livePnl >= 0 ? "▲ +" : "▼ "}{Math.round(livePnl).toLocaleString("en-US")}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: livePnlPct >= 0 ? "#22c55e" : "#ef4444",
                      background: livePnlPct >= 0 ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                      border: `1px solid ${livePnlPct >= 0 ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                      padding: "1px 8px", borderRadius: 20,
                    }}>
                      {livePnlPct >= 0 ? "+" : ""}{livePnlPct.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
              <div style={{
                display: "flex", gap: 2, background: "var(--bg-secondary)",
                borderRadius: 8, padding: 3, border: "1px solid var(--border)",
              }}>
                {(["1M","3M","6M","YTD","1Y","ALL"] as const).map(p => (
                  <button key={p} onClick={() => setHistPeriod(p)} style={{
                    padding: "4px 9px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontSize: 10, fontWeight: 700,
                    background: histPeriod === p ? "var(--accent)" : "transparent",
                    color: histPeriod === p ? "#fff" : "var(--text-muted)",
                    transition: "all 0.15s",
                  }}>{p}</button>
                ))}
              </div>
            </div>

            {chartData.length === 0 ? (
              <div style={{ height: 188, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12, flexDirection: "column", gap: 6 }}>
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} opacity={0.4}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <span style={{ opacity: 0.5 }}>{liveTotal <= 0 ? "Добавьте инструменты для отображения графика" : "Загрузка истории…"}</span>
              </div>
            ) : (
              <ApexChart
                type="area"
                height={200}
                series={[{ name: "Капитал", data: chartData.map(d => d.value) }]}
                options={{
                  chart: { type: "area", toolbar: { show: false }, background: "transparent", animations: { enabled: true, speed: 500 } },
                  stroke: { curve: "smooth", width: 2, colors: ["#8b5cf6"] },
                  fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.0, stops: [0, 100], colorStops: [{ offset: 0, color: "#8b5cf6", opacity: 0.35 }, { offset: 100, color: "#8b5cf6", opacity: 0 }] } },
                  xaxis: { categories: chartData.map(d => d.date), labels: { style: { fontSize: "9px", colors: "#888" }, rotate: 0 }, axisBorder: { show: false }, axisTicks: { show: false }, tickAmount: 6 },
                  yaxis: { labels: { formatter: (v: number) => `${(v / 1000).toFixed(0)}K`, style: { fontSize: "9px", colors: "#888" } }, tickAmount: 4 },
                  grid: { borderColor: "rgba(255,255,255,0.06)", strokeDashArray: 3, xaxis: { lines: { show: false } }, padding: { left: 0, right: 0 } },
                  tooltip: { theme: "dark", y: { formatter: (v: number) => `$${Number(v).toLocaleString("en-US")}` } },
                  dataLabels: { enabled: false },
                  markers: { size: 0, hover: { size: 5, sizeOffset: 2 } },
                  theme: { mode: "dark" },
                }}
              />
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
              {[
                { label: "Вложено", value: liveCost > 0 ? `$${Math.round(liveCost).toLocaleString("en-US")}` : "—" },
                { label: "P&L", value: liveCost > 0 ? `${livePnl >= 0 ? "+" : ""}${Math.round(livePnl).toLocaleString("en-US")}` : "—", neg: livePnl < 0, pos: livePnl > 0 },
                { label: "Дн. изм.", value: liveCost > 0 ? `${app.dailyChangePct >= 0 ? "+" : ""}${app.dailyChangePct.toFixed(2)}%` : "—", neg: app.dailyChangePct < 0, pos: app.dailyChangePct > 0 },
                { label: "Инструм.", value: `${realPositions.filter(p => p.type !== "Кэш").length}` },
              ].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: s.neg ? "#ef4444" : s.pos ? "#22c55e" : "var(--text-primary)" }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Period summary */}
          <div className="card">
            <div className="card-title">Итоги за период</div>
            {realPositions.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 16, textAlign: "center" }}>Нет инструментов в портфеле</div>
            ) : [
              { label: "Вложено (себестоимость)", value: `${Math.round(liveCost).toLocaleString("en-US")} USD` },
              { label: "Текущий капитал", value: `${Math.round(liveTotal).toLocaleString("en-US")} USD`, bold: true },
              { label: "P&L", value: `${livePnl >= 0 ? "+" : ""}${Math.round(livePnl).toLocaleString("en-US")} USD`, color: livePnl >= 0 ? "#22c55e" : "#ef4444" },
              { label: "P&L (%)", value: `${livePnlPct >= 0 ? "+" : ""}${livePnlPct.toFixed(2)}%`, color: livePnlPct >= 0 ? "#22c55e" : "#ef4444" },
              { label: "Инструментов", value: `${realPositions.filter(p => p.type !== "Кэш").length}` },
              { label: "Классов активов", value: `${new Set(realPositions.map(p => p.type)).size}` },
              { label: "Дневное изм.", value: `${app.dailyChange >= 0 ? "+" : ""}${Math.round(app.dailyChange).toLocaleString("en-US")} USD`, color: app.dailyChange >= 0 ? "#22c55e" : "#ef4444" },
              { label: "Дневное изм. (%)", value: `${app.dailyChangePct >= 0 ? "+" : ""}${app.dailyChangePct.toFixed(2)}%`, color: app.dailyChangePct >= 0 ? "#22c55e" : "#ef4444" },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                <span style={{ fontWeight: item.bold ? 700 : 600, color: (item as any).color ?? "var(--text-primary)" }}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Portfolio structure */}
          <div className="card">
            <div className="card-title">Структура портфеля</div>
            {realPositions.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 16, textAlign: "center" }}>Нет инструментов в портфеле</div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <ApexChart
                  type="donut"
                  width={130}
                  height={130}
                  series={realDistribution.map(d => d.value)}
                  options={{
                    labels: realDistribution.map(d => d.name),
                    colors: realDistribution.map(d => d.color),
                    chart: { background: "transparent", animations: { enabled: true, speed: 400 } },
                    stroke: { width: 2, colors: ["transparent"] },
                    dataLabels: { enabled: false },
                    legend: { show: false },
                    plotOptions: { pie: { donut: { size: "62%", labels: { show: true, total: { show: true, label: "USD", fontSize: "9px", color: "#888", formatter: () => `${Math.round(liveTotal / 1000)}K` }, value: { show: false } } } } },
                    tooltip: { theme: "dark", y: { formatter: (v: number) => `$${Number(v).toLocaleString("en-US")}` } },
                    theme: { mode: "dark" },
                  }}
                />
                <div style={{ flex: 1 }}>
                  {realDistribution.map(item => (
                    <div key={item.name} style={{ fontSize: 11, marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, display: "inline-block", flexShrink: 0 }} />
                        <span style={{ color: "var(--text-secondary)" }}>{item.name}</span>
                        <span style={{ marginLeft: "auto", fontWeight: 600 }}>{item.pct}</span>
                      </div>
                      <div style={{ color: "var(--text-muted)", paddingLeft: 10 }}>{item.value.toLocaleString("en-US")}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Goal */}
          <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div className="card-title">Следующая цель</div>
            {(() => {
              const target = app.settings.targetAmount || 400000;
              const pct = Math.min(100, Math.round((liveTotal / target) * 100));
              const remaining = Math.max(0, target - liveTotal);
              const r = 50, circ = 2 * Math.PI * r;
              return (
                <>
                  <div style={{ position: "relative", width: 120, height: 120 }}>
                    <svg viewBox="0 0 120 120" width={120} height={120}>
                      <circle cx={60} cy={60} r={r} fill="none" stroke="var(--border)" strokeWidth={10} />
                      <circle cx={60} cy={60} r={r} fill="none" stroke="#7c3aed" strokeWidth={10}
                        strokeDasharray={`${circ * pct / 100} ${circ * (1 - pct / 100)}`}
                        strokeDashoffset={circ * 0.25} strokeLinecap="round"
                      />
                      <text x={60} y={55} textAnchor="middle" style={{ fill: "var(--text-primary)" }} fontSize={22} fontWeight={700}>{pct}%</text>
                    </svg>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "center", marginTop: 8 }}>
                    Цель: {target.toLocaleString("en-US")} USD<br />Осталось: {Math.round(remaining).toLocaleString("en-US")} USD
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Row 2: Snapshot history + Operations + Recommended actions */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 0.8fr", gap: 12 }}>
          {/* Snapshots */}
          <div className="card">
            <div className="card-title">История фиксаций</div>
            {snapshots.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 120, gap: 8, color: "var(--text-muted)" }}>
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.3} opacity={0.4}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span style={{ fontSize: 12, opacity: 0.6 }}>Фиксаций ещё не было</span>
                <span style={{ fontSize: 11, opacity: 0.4, textAlign: "center" }}>Нажмите «Зафиксировать портфель» вверху страницы</span>
              </div>
            ) : (
              <>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                      {["Дата", "Время", "Капитал", "P&L", "Вложено", "Доходн.", "Комментарий"].map(h => (
                        <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.slice(0, 8).map((s, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "7px 8px" }}>{s.date}</td>
                        <td style={{ padding: "7px 8px", color: "var(--text-secondary)" }}>{s.time}</td>
                        <td style={{ padding: "7px 8px", fontWeight: 700 }}>{s.capital.toLocaleString("en-US")}</td>
                        <td style={{ padding: "7px 8px", color: s.profit >= 0 ? "#22c55e" : "#ef4444" }}>
                          {s.profit >= 0 ? "+" : ""}{s.profit.toLocaleString("en-US")}
                        </td>
                        <td style={{ padding: "7px 8px", color: "var(--text-secondary)" }}>{s.cost.toLocaleString("en-US")}</td>
                        <td style={{ padding: "7px 8px", color: "#22c55e", fontWeight: 700 }}>{s.profitPct}</td>
                        <td style={{ padding: "7px 8px", color: "var(--text-secondary)", fontSize: 11 }}>{s.comment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {snapshots.length > 8 && (
                  <div style={{ textAlign: "center", marginTop: 8 }}>
                    <span style={{ color: "var(--accent-light)", fontSize: 12 }}>Ещё {snapshots.length - 8} записей</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Operations */}
          <div className="card">
            <div className="card-title">История операций</div>
            {operations.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 120, gap: 8, color: "var(--text-muted)" }}>
                <span style={{ fontSize: 12, opacity: 0.6 }}>Нет инструментов в портфеле</span>
              </div>
            ) : (
              <>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                      {["Дата", "Тикер", "Действие", "Кол-во", "Цена", "Сумма (USD)"].map(h => (
                        <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {operations.slice(0, 8).map((o, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "7px 8px", color: "var(--text-secondary)" }}>{o.date}</td>
                        <td style={{ padding: "7px 8px", fontWeight: 700, color: "var(--accent-light)" }}>{o.ticker}</td>
                        <td style={{ padding: "7px 8px" }}>
                          <span className={`badge ${o.action === "Продажа" ? "badge-red" : "badge-green"}`}>{o.action}</span>
                        </td>
                        <td style={{ padding: "7px 8px" }}>{Number(o.qty).toFixed(2)}</td>
                        <td style={{ padding: "7px 8px" }}>{o.price.toFixed(2)}</td>
                        <td style={{ padding: "7px 8px", color: o.sum >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                          {o.sum >= 0 ? "+" : ""}{o.sum.toLocaleString("en-US")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {operations.length > 8 && (
                  <div style={{ textAlign: "center", marginTop: 8 }}>
                    <span style={{ color: "var(--accent-light)", fontSize: 12 }}>Ещё {operations.length - 8} операций</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Recommended actions */}
          <div className="card">
            <div className="card-title">Рекомендуемые действия</div>
            {realPositions.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 12, textAlign: "center" }}>Нет инструментов в портфеле</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {recommendedActions.map((r, i) => {
                  const icon = r.action.startsWith("Снизить") ? "↓" : r.action.startsWith("Фиксировать") ? "✓" : r.action.startsWith("Сократить") ? "⚠" : r.action.startsWith("Диверс") ? "⊕" : r.action.startsWith("Портфель") ? "✓" : "⚖";
                  const color = r.priority === "Высокий" ? "#ef4444" : r.priority === "Средний" ? "#f59e0b" : "#22c55e";
                  return (
                    <div key={i} style={{ padding: "8px", background: "var(--bg-secondary)", borderRadius: 8, fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontWeight: 700 }}>{icon} {r.action}</span>
                        <span className="badge" style={{ background: `${color}22`, color }}>{r.priority}</span>
                      </div>
                      <div style={{ color: "var(--text-secondary)", fontSize: 11 }}>{r.reason}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Events + Rebalance plan + Cash flow + Goals */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 0.8fr 1fr", gap: 12 }}>
          {/* Events */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="card-title" style={{ margin: 0 }}>Календарь событий</div>
              {calendarLoading
                ? <span style={{ fontSize: 10, color: "var(--text-muted)" }}>загрузка…</span>
                : <span style={{ fontSize: 10, color: "var(--text-muted)" }}>−3 дня / +45 дней</span>
              }
            </div>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "6px 8px", textAlign: "left" }}>Дата</th>
                  <th style={{ padding: "6px 8px", textAlign: "left" }}>Событие</th>
                  <th style={{ padding: "6px 8px", textAlign: "left" }}>Прогноз</th>
                  <th style={{ padding: "6px 8px", textAlign: "left" }}>Исполнено</th>
                </tr>
              </thead>
              <tbody>
                {calendarEvents.map((e, i) => {
                  const kindIcon = e.kind === "earnings" ? "📊" : e.kind === "dividend" ? "💰" : "🏛";
                  const isPast = e.isoDate ? new Date(e.isoDate) < new Date() : false;
                  const hasActual = e.actual != null;
                  return (
                    <tr key={i} style={{
                      borderBottom: "1px solid var(--border)",
                      opacity: isPast && !hasActual ? 0.55 : 1,
                      background: isPast ? "rgba(255,255,255,0.02)" : "transparent",
                    }}>
                      <td style={{ padding: "7px 8px", color: isPast ? "var(--text-muted)" : "var(--text-secondary)", whiteSpace: "nowrap" }}>{e.date}</td>
                      <td style={{ padding: "7px 8px" }}>
                        <span title={e.kind} style={{ marginRight: 4 }}>{kindIcon}</span>
                        {e.ticker && <span style={{ color: "var(--accent-light)", fontWeight: 700, marginRight: 4 }}>{e.ticker}</span>}
                        <span>{e.event.replace(/^(Отчёт|Дивиденд) \S+ /, "")}</span>
                      </td>
                      <td style={{ padding: "7px 8px", color: "var(--text-muted)", fontSize: 11 }}>{e.estimate ?? "—"}</td>
                      <td style={{ padding: "7px 8px", fontSize: 11, fontWeight: hasActual ? 700 : 400 }}>
                        {hasActual ? <span style={{ color: "#22c55e" }}>{e.actual}</span>
                          : isPast ? <span style={{ color: "var(--text-muted)" }}>ожидается</span>
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Rebalance plan */}
          <div className="card">
            <div className="card-title">План ребалансировки</div>
            {rebalancePlan.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 12 }}>
                {realPositions.length === 0
                  ? "Нет инструментов в портфеле"
                  : "Целевая структура не задана. Настройте её на странице Действия."}
              </div>
            ) : (
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                    {["Действие", "Отклонение", "Цель", "К сроку"].map(h => (
                      <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rebalancePlan.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "7px 8px", fontWeight: 600 }}>{r.action}</td>
                      <td style={{ padding: "7px 8px", color: parseFloat(r.deviation) >= 0 ? "#ef4444" : "#22c55e", fontWeight: 700 }}>{r.deviation}</td>
                      <td style={{ padding: "7px 8px", color: "var(--text-secondary)" }}>{r.target}</td>
                      <td style={{ padding: "7px 8px", color: "var(--text-muted)", fontSize: 11 }}>{r.deadline}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Cash flow */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="card-title" style={{ margin: 0 }}>Денежные потоки</div>
              <div style={{ display: "flex", gap: 4 }}>
                {["1М", "3М", "6М", "YTD"].map(p => (
                  <button key={p} className={`tab-btn ${cashFlowPeriod === p ? "active" : ""}`} onClick={() => setCashFlowPeriod(p)} style={{ fontSize: 10, padding: "2px 5px" }}>{p}</button>
                ))}
              </div>
            </div>
            {[
              { label: "Вложено",            value: cashFlow.deposits,     color: "#22c55e" },
              { label: "Выводы",             value: cashFlow.withdrawals,   color: "#ef4444" },
              { label: "Фиксации прибыли",   value: cashFlow.fixedProfit,   color: "#22c55e" },
              { label: "Реинвестировано",    value: cashFlow.reinvested,    color: "#ef4444" },
              { label: "Нереализованный P&L", value: cashFlow.netFlow,      color: cashFlow.netFlow >= 0 ? "#22c55e" : "#ef4444", bold: true },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8, borderBottom: item.bold ? "none" : "1px solid var(--border)", paddingBottom: 6 }}>
                <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                <span style={{ fontWeight: item.bold ? 700 : 600, color: item.color }}>
                  {item.value >= 0 ? "+" : ""}{item.value.toLocaleString("en-US")}
                </span>
              </div>
            ))}
          </div>

          {/* Goals */}
          <div className="card">
            <div className="card-title">Цели и планы</div>
            {goals.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 12, textAlign: "center" }}>
                Добавьте инструменты и настройте цели в Настройках
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {goals.map(g => (
                  <div key={g.goal}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: "var(--text-primary)", fontSize: 11, fontWeight: 600 }}>{g.goal}</span>
                      <span className={`badge ${g.status === "Достигнута" || g.status === "Завершён" ? "badge-green" : g.status === "Убыток" ? "badge-red" : "badge-blue"}`}>{g.status}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4, color: "var(--text-muted)" }}>
                      <span>{g.detail}</span>
                      <span style={{ fontWeight: 700, color: g.color }}>{g.pct}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${g.pct}%`, background: g.color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
