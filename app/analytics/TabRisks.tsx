"use client";

import { useMemo, useState, useEffect } from "react";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from "recharts";
import { useApp } from "@/lib/useApp";
import { useMobile } from "@/lib/useMobile";
import { usePortfolioHistory } from "@/lib/usePortfolioHistory";

function buildPotentialDrawdown(annualVol: number, days: number) {
  const result: { date: string; band95: number; band68: number; expected: number }[] = [];
  const now = new Date();
  const dailyVol = (annualVol / Math.sqrt(252)) * 100;
  for (let t = 0; t <= days; t++) {
    const d = new Date(now);
    d.setDate(d.getDate() + t);
    const label = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
    const sqrtT = Math.sqrt(t + 1);
    result.push({
      date: label,
      band95: parseFloat((-(1.645 * dailyVol * sqrtT)).toFixed(2)),
      band68: parseFloat((-(1.000 * dailyVol * sqrtT)).toFixed(2)),
      expected: 0,
    });
  }
  return result;
}

const TYPE_VOL:  Record<string, number> = { ETF: 0.15, Акция: 0.25, Крипто: 0.65, Сырьё: 0.20, Облигация: 0.07, Кэш: 0 };
const TYPE_BETA: Record<string, number> = { ETF: 1.00, Акция: 1.20, Крипто: 1.80, Сырьё: 0.50, Облигация: 0.05, Кэш: 0 };

function typePairCorr(a: string, b: string): number {
  if (a === b) return 1.00;
  const equity = ["ETF","Акция"];
  if (equity.includes(a) && equity.includes(b)) return 0.80;
  if ((a === "Сырьё" || b === "Сырьё") && (equity.includes(a) || equity.includes(b))) return -0.15;
  if ((a === "Крипто" || b === "Крипто") && equity.includes(a === "Крипто" ? b : a)) return 0.35;
  if (a === "Облигация" || b === "Облигация") return -0.20;
  if (a === "Кэш" || b === "Кэш") return 0.00;
  return 0.10;
}

function RiskGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.min(100, Math.max(0, value)) / 100;
  const angle = pct * 180 - 90;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const r = 60, cx = 90, cy = 90;
  const nx = cx + r * Math.cos(toRad(angle - 90));
  const ny = cy + r * Math.sin(toRad(angle - 90));
  const arc = (s: number, e: number, radius: number) => {
    const s1 = toRad(s), e1 = toRad(e);
    return `M ${cx + radius * Math.cos(s1)} ${cy + radius * Math.sin(s1)} A ${radius} ${radius} 0 0 1 ${cx + radius * Math.cos(e1)} ${cy + radius * Math.sin(e1)}`;
  };
  return (
    <svg width={180} height={110} viewBox="0 0 180 110">
      {[
        { s: -180, e: -90, c: "#22c55e" }, { s: -90, e: 0, c: "#f59e0b" },
        { s: 0, e: 90, c: "#f97316" }, { s: 90, e: 180, c: "#ef4444" },
      ].map((a, i) => (
        <path key={i} d={arc(a.s, a.e, 55)} fill="none" stroke={a.c} strokeWidth={13} strokeLinecap="round" />
      ))}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--text-primary)" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill="var(--text-primary)" />
      <text x={cx} y={cy + 16} textAnchor="middle" fill="var(--text-primary)" fontSize={22} fontWeight={700}>{value}</text>
      <text x={cx} y={cy + 28} textAnchor="middle" fill="var(--text-muted)" fontSize={10}>из 100</text>
    </svg>
  );
}

const crisisStrategies = [
  { scenario: "Рынок падает > 15%", action: "Увеличить кэш до 10%", priority: "Высокий", comment: "Сохранение капитала" },
  { scenario: "VIX > 25", action: "Хедж через опционы", priority: "Высокий", comment: "Защита от падения" },
  { scenario: "Рост ставок > 2%", action: "Снизить Duration", priority: "Средний", comment: "Снижение риска" },
  { scenario: "Инфляция > 6%", action: "Увеличить GLD/SLV", priority: "Средний", comment: "Хедж инфляции" },
  { scenario: "Рецессия", action: "Снизить акции на 10-20%", priority: "Высокий", comment: "Управление риском" },
];

export default function TabRisks() {
  const isMobile = useMobile();
  const app = useApp();
  const positions = app.positions;
  const liveQuotes = app.liveQuotes;
  const total = app.portfolioTotal;

  const [lsHistory, setLsHistory] = useState<{ date: string; value: number; cost: number }[]>([]);
  useEffect(() => {
    try { const r = localStorage.getItem("portfolio-chart-history"); if (r) setLsHistory(JSON.parse(r)); } catch {}
  }, []);

  const { mergedTimeline, histLoaded } = usePortfolioHistory(positions, lsHistory, total, app.totalCost);

  const { historicalDrawdown, maxHistDrawdown } = useMemo(() => {
    if (!mergedTimeline.length) return { historicalDrawdown: [] as { date: string; drawdown: number }[], maxHistDrawdown: 0 };
    let peak = mergedTimeline[0].value;
    const drawdown = mergedTimeline.map(h => {
      if (h.value > peak) peak = h.value;
      const dd = peak > 0 ? ((h.value - peak) / peak) * 100 : 0;
      const date = new Date(h.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
      return { date, drawdown: parseFloat(dd.toFixed(2)) };
    });
    return { historicalDrawdown: drawdown, maxHistDrawdown: Math.min(0, ...drawdown.map(d => d.drawdown)) };
  }, [mergedTimeline]);

  const posValue = (p: typeof positions[0]) => p.qty * (liveQuotes[p.ticker]?.current ?? p.avgPrice);

  const { metrics, riskScore, categories, stressScenarios, varRows,
          concentrationData, hedgingRows, highRiskRows, correlMatrix,
          cashShare, top5pct, potentialDrawdown } = useMemo(() => {
    if (!positions.length || total <= 0) return {
      metrics: null, riskScore: 0, categories: [], stressScenarios: [],
      varRows: [], concentrationData: [], hedgingRows: [], highRiskRows: [],
      correlMatrix: null, cashShare: 0, dailyChgPct: 0, top5pct: 0,
      potentialDrawdown: [] as { date: string; band95: number; band68: number; expected: number }[],
    };

    let wBeta = 0, wVol = 0;
    for (const p of positions) {
      const val = posValue(p);
      const share = val / total;
      wBeta += (TYPE_BETA[p.type] ?? 1) * share;
      wVol  += (TYPE_VOL[p.type]  ?? 0.15) * share;
    }

    const annReturn = app.totalPnlPct / 100;
    const sharpe = wVol > 0 ? Math.max(-2, Math.min(4, (annReturn - 0.045) / wVol)) : 0;

    const sigmaDaily = wVol / Math.sqrt(252);
    const var95_1d_pct  = -(1.645 * sigmaDaily * 100);
    const var99_1d_pct  = -(2.326 * sigmaDaily * 100);
    const var95_10d_pct = var95_1d_pct * Math.sqrt(10);
    const var99_10d_pct = var99_1d_pct * Math.sqrt(10);
    const var95_30d_pct = var95_1d_pct * Math.sqrt(30);
    const var99_30d_pct = var99_1d_pct * Math.sqrt(30);
    const pctToUsd = (pct: number) => Math.round(pct / 100 * total);

    const cashVal   = positions.filter(p => p.type === "Кэш").reduce((s, p) => s + posValue(p), 0);
    const cashShare = cashVal / total * 100;

    const sorted = [...positions].map(p => ({ ...p, val: posValue(p) })).sort((a, b) => b.val - a.val);
    const top3pct = sorted.slice(0, 3).reduce((s, p) => s + p.val, 0) / total * 100;
    const top5pct = sorted.slice(0, 5).reduce((s, p) => s + p.val, 0) / total * 100;

    const concPts = Math.min(35, top5pct * 0.45);
    const cashPts = Math.max(0, 20 - cashShare * 2);
    const typePts = Math.min(25, (TYPE_VOL[positions.sort((a,b) => posValue(b)-posValue(a))[0]?.type] ?? 0.15) * 60);
    const pnlPts  = app.totalPnlPct < -15 ? 20 : app.totalPnlPct < -5 ? 10 : 0;
    const riskScore = Math.min(100, Math.round(concPts + cashPts + typePts + pnlPts));

    const riskLabel = riskScore >= 70 ? "Высокий риск" : riskScore >= 40 ? "Умеренный риск" : "Низкий риск";
    const riskColor = riskScore >= 70 ? "#ef4444" : riskScore >= 40 ? "#f59e0b" : "#22c55e";

    const volPct = Math.round(wVol * 100);
    const betaPct = Math.round(Math.min(100, wBeta * 55));
    const liquidPct = Math.max(0, Math.round(100 - cashShare * 4));
    const concPct = Math.round(Math.min(100, top5pct));
    const categories = [
      { name: "Рыночный риск",    value: betaPct,   color: betaPct > 70 ? "#ef4444" : betaPct > 50 ? "#f59e0b" : "#22c55e" },
      { name: "Концентрация",     value: concPct,   color: concPct > 70 ? "#ef4444" : concPct > 50 ? "#f59e0b" : "#22c55e" },
      { name: "Волатильность",    value: volPct,    color: volPct > 25 ? "#ef4444" : volPct > 15 ? "#f59e0b" : "#22c55e" },
      { name: "Ликвидность",      value: liquidPct, color: liquidPct > 70 ? "#ef4444" : liquidPct > 50 ? "#f59e0b" : "#22c55e" },
      { name: "Валютный риск",    value: 30,        color: "#22c55e" },
      { name: "Процентный риск",  value: 20,        color: "#22c55e" },
    ];

    const metrics = {
      var95_1d: var95_1d_pct.toFixed(2),
      var95_10d: var95_10d_pct.toFixed(2),
      expectedShortfall: (var95_1d_pct * 1.43).toFixed(2),
      maxDrawdown: Math.min(app.totalPnlPct, -(wVol * 100 * 1.5)).toFixed(2),
      volatility30d: volPct,
      sharpe: sharpe.toFixed(2),
      beta: wBeta.toFixed(2),
      varUsd_95_1d: pctToUsd(var95_1d_pct),
      riskLabel,
      riskColor,
    };

    const stressScenarios = [
      { scenario: "Финансовый кризис (2008)", description: "Падение рынка на 45%", pct: -34.9, prob: "Низкая" },
      { scenario: "Пандемия (COVID-19)",       description: "Резкое падение на 30%", pct: -21.7, prob: "Низкая" },
      { scenario: "Инфляционный шок",          description: "Рост инфляции до 8%",   pct: -11.3, prob: "Средняя" },
      { scenario: "Рецессия (мягкая)",          description: "Снижение прибыли",       pct: -8.4,  prob: "Средняя" },
      { scenario: "Рост ставок (+2%)",          description: "Ужесточение политики",   pct: -6.8,  prob: "Высокая" },
      { scenario: "Геополитический кризис",     description: "Эскалация конфликта",    pct: -6.0,  prob: "Средняя" },
      { scenario: "Бычий сценарий +20%",        description: "Рост рынка на 20%",      pct: 20.0,  prob: "Средняя" },
    ].map(s => ({ ...s, lossUsd: Math.round(s.pct / 100 * total) }));

    const varRows = [
      { period: "1 день",  level: "95%", varPct: var95_1d_pct,  es: var95_1d_pct * 1.43 },
      { period: "1 день",  level: "99%", varPct: var99_1d_pct,  es: var99_1d_pct * 1.43 },
      { period: "10 дней", level: "95%", varPct: var95_10d_pct, es: var95_10d_pct * 1.43 },
      { period: "10 дней", level: "99%", varPct: var99_10d_pct, es: var99_10d_pct * 1.43 },
      { period: "30 дней", level: "95%", varPct: var95_30d_pct, es: var95_30d_pct * 1.43 },
      { period: "30 дней", level: "99%", varPct: var99_30d_pct, es: var99_30d_pct * 1.43 },
    ].map(r => ({ ...r, varUsd: pctToUsd(r.varPct), esUsd: pctToUsd(r.es) }));

    const concentrationData = [
      { name: "Топ 3",       value: Math.round(top3pct),                              color: "#7c3aed" },
      { name: "4-5 позиции", value: Math.round(Math.max(0, top5pct - top3pct)),       color: "#3b82f6" },
      { name: "Остальные",   value: Math.round(Math.max(0, 100 - top5pct)),           color: "#555577" },
    ].filter(d => d.value > 0);

    const HEDGE_TICKERS = ["GLD","IAU","GOLD","SLV","SIVR","TLT","BND","AGG","SHY","TIPS"];
    const hedgingRows: { instrument: string; purpose: string; share: string; recommendation: string }[] = [];
    if (cashVal > 0) hedgingRows.push({ instrument: "Кэш (USD)", purpose: "Буфер ликвидности", share: cashShare.toFixed(1) + "%", recommendation: cashShare >= 5 ? "Держать" : "Увеличить" });
    for (const p of positions.filter(p => HEDGE_TICKERS.slice(0, 5).includes(p.ticker))) {
      hedgingRows.push({ instrument: `${p.name} (${p.ticker})`, purpose: "Защита от инфляции", share: (posValue(p) / total * 100).toFixed(1) + "%", recommendation: "Держать" });
    }
    for (const p of positions.filter(p => HEDGE_TICKERS.slice(5).includes(p.ticker))) {
      hedgingRows.push({ instrument: `${p.name} (${p.ticker})`, purpose: "Защита от ставок", share: (posValue(p) / total * 100).toFixed(1) + "%", recommendation: "Держать" });
    }
    if (!positions.some(p => HEDGE_TICKERS.slice(0, 5).includes(p.ticker))) hedgingRows.push({ instrument: "Золото (GLD)", purpose: "Защита от инфляции", share: "0%", recommendation: "Рассмотреть" });
    if (!positions.some(p => p.type === "Облигация" || HEDGE_TICKERS.slice(5).includes(p.ticker))) hedgingRows.push({ instrument: "Облигации (TLT)", purpose: "Защита от ставок", share: "0%", recommendation: "Рассмотреть" });
    if (cashShare < 5) hedgingRows.push({ instrument: "Inverse ETF (SH)", purpose: "Краткосрочный хедж", share: "0%", recommendation: "Рассмотреть" });

    const highRiskRows = positions.map(p => {
      const val = posValue(p);
      const share = val / total * 100;
      const currentPrice = liveQuotes[p.ticker]?.current ?? p.avgPrice;
      const drawdown = p.avgPrice > 0 ? ((currentPrice - p.avgPrice) / p.avgPrice) * 100 : 0;
      const reasons: string[] = [];
      if (share > 25) reasons.push("Высокая концентрация");
      if (p.type === "Крипто") reasons.push("Крипто-риск");
      if (drawdown < -15) reasons.push("Просадка " + drawdown.toFixed(1) + "%");
      if (TYPE_VOL[p.type] >= 0.25) reasons.push("Высокая волатильность");
      const risk = share > 25 || p.type === "Крипто" ? "Высокий" : share > 15 || drawdown < -10 ? "Средний" : null;
      return { id: p.id, ticker: p.ticker, name: p.name, share, reason: reasons[0] ?? "", risk, drawdown };
    }).filter(p => p.risk !== null).sort((a, b) => b.share - a.share);

    const topTickers = sorted.filter(p => p.type !== "Кэш").slice(0, 6);
    const correlMatrix = topTickers.length > 1 ? {
      tickers: topTickers.map(p => p.ticker),
      types: topTickers.map(p => p.type),
      data: topTickers.map((a, i) =>
        topTickers.map((b, j) => {
          if (i === j) return 1.00;
          const base = typePairCorr(a.type, b.type);
          const noise = ((a.ticker.charCodeAt(0) + b.ticker.charCodeAt(0)) % 10 - 5) * 0.02;
          return Math.max(-1, Math.min(1, parseFloat((base + noise).toFixed(2))));
        })
      ),
    } : null;

    const potentialDrawdown = buildPotentialDrawdown(wVol, 90);

    return { metrics, riskScore, categories, stressScenarios, varRows,
             concentrationData, hedgingRows, highRiskRows, correlMatrix,
             cashShare, dailyChgPct: 0, top5pct, potentialDrawdown };
  }, [positions, total, app.totalPnlPct, liveQuotes]);

  const isEmpty = positions.length === 0 || total <= 0;

  const riskAlerts = [
    { trigger: "VIX (индекс страха)", current: "18.6", threshold: "> 25", ok: true },
    { trigger: "Просадка портфеля (день)", current: `${app.dailyChangePct >= 0 ? "+" : ""}${app.dailyChangePct.toFixed(2)}%`, threshold: "< −3%", ok: app.dailyChangePct >= -3 },
    { trigger: "Концентрация (топ 5)", current: isEmpty ? "—" : `${top5pct.toFixed(1)}%`, threshold: "> 80%", ok: top5pct <= 80 },
    { trigger: "Доля кэша", current: isEmpty ? "—" : `${cashShare.toFixed(1)}%`, threshold: "< 5%", ok: cashShare >= 5 },
    { trigger: "Волатильность (30д)", current: isEmpty ? "—" : `${metrics?.volatility30d ?? 0}%`, threshold: "> 30%", ok: (metrics?.volatility30d ?? 0) <= 30 },
    { trigger: "Леверидж", current: "1.00×", threshold: "> 1.5×", ok: true },
    { trigger: "Бета (рынок)", current: isEmpty ? "—" : metrics?.beta ?? "—", threshold: "> 1.5", ok: parseFloat(metrics?.beta ?? "0") <= 1.5 },
  ].map(a => ({ ...a, color: a.ok ? "#22c55e" : "#ef4444", status: a.ok ? "Норма" : "Внимание" }));

  return (
    <div style={{ padding: isMobile ? "12px" : "16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
      {isEmpty && (
        <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
          <div style={{ fontSize: 13, marginBottom: 6 }}>Портфель пуст</div>
          <div style={{ fontSize: 11 }}>Добавьте инструменты в раздел «Позиции» — риск-анализ сформируется автоматически</div>
        </div>
      )}

      {/* Row 1: Gauge + Categories + Metrics + Concentration + Drawdown */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "0.8fr 1fr 1fr 0.8fr 1fr", gap: 12 }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div className="card-title">Общая оценка риска</div>
          <RiskGauge value={riskScore} label={metrics?.riskLabel ?? ""} color={metrics?.riskColor ?? "#22c55e"} />
          <div style={{ fontSize: 13, fontWeight: 700, color: metrics?.riskColor ?? "var(--text-secondary)", marginTop: 4 }}>
            {isEmpty ? "Нет данных" : metrics?.riskLabel}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Уровень риска по категориям</div>
          {isEmpty ? (
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>Добавьте инструменты</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {categories.map((c) => (
                <div key={c.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{c.name}</span>
                    <span style={{ fontWeight: 700, color: c.color }}>{c.value}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${c.value}%`, background: c.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Ключевые риск-метрики</div>
          {isEmpty ? (
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>Нет данных</div>
          ) : [
            { label: "Value at Risk (1д, 95%)",    value: `${metrics!.var95_1d}%`,          color: "#ef4444" },
            { label: "Value at Risk (10д, 95%)",   value: `${metrics!.var95_10d}%`,         color: "#ef4444" },
            { label: "Expected Shortfall (95%)",   value: `${metrics!.expectedShortfall}%`, color: "#ef4444" },
            { label: "Макс. просадка (оценка)",    value: `${metrics!.maxDrawdown}%`,       color: "#ef4444" },
            { label: "Волатильность (30д, оцен.)", value: `${metrics!.volatility30d}%` },
            { label: "Коэффициент Шарпа",          value: metrics!.sharpe,                  color: parseFloat(metrics!.sharpe) >= 1 ? "#22c55e" : "#f59e0b" },
            { label: "Бета (рынок)",               value: metrics!.beta },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
              <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
              <span style={{ fontWeight: 700, color: (item as any).color ?? "var(--text-primary)" }}>{item.value}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title">Риск концентрации</div>
          {isEmpty ? (
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>Нет данных</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={concentrationData} dataKey="value" cx="50%" cy="50%" innerRadius={34} outerRadius={52}>
                    {concentrationData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }} formatter={(v: any) => [`${v}%`]} />
                </PieChart>
              </ResponsiveContainer>
              {concentrationData.map((c) => (
                <div key={c.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color, display: "inline-block" }} />
                    <span style={{ color: "var(--text-secondary)" }}>{c.name}</span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{c.value}%</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="card">
          <div className="card-title">Потенциальная просадка (90 дней)</div>
          {isEmpty ? (
            <div style={{ height: 130, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>Нет данных</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={potentialDrawdown} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fan95" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="fan68" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.06} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <ReferenceLine y={0} stroke="var(--text-muted)" strokeWidth={1} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval={29} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`}
                    domain={[Math.floor(potentialDrawdown[potentialDrawdown.length - 1]?.band95 ?? -20) - 2, 2]} width={34} />
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
                    formatter={(v: any, name: any) => [`${Number(v).toFixed(2)}%`, name === "band95" ? "VaR 95%" : name === "band68" ? "VaR 68%" : "Ожид."]} />
                  <Area type="monotone" dataKey="band95" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" fill="url(#fan95)" dot={false} />
                  <Area type="monotone" dataKey="band68" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" fill="url(#fan68)" dot={false} />
                  <Area type="monotone" dataKey="expected" stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="6 3" fill="none" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 10, marginTop: 5, justifyContent: "center" }}>
                {[
                  { color: "#ef4444", label: `VaR 95%: ${metrics!.var95_1d}%/день` },
                  { color: "#f59e0b", label: "VaR 68% (1σ)" },
                  { color: "var(--accent)", label: "Ожидаемый" },
                ].map(z => (
                  <div key={z.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9 }}>
                    <div style={{ width: 16, height: 1.5, background: z.color }} />
                    <span style={{ color: "var(--text-muted)" }}>{z.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row 2: Stress + Alerts + Hedging */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr 1fr", gap: 12 }}>
        <div className="card">
          <div className="card-title">Стресс-сценарии (влияние на портфель)</div>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                {["Сценарий", "Описание", "Потери (USD)", "Потери (%)", "Вероятность"].map((h) => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(isEmpty ? [] : stressScenarios).map((s) => (
                <tr key={s.scenario} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "7px 8px", fontWeight: 600, fontSize: 11 }}>{s.scenario}</td>
                  <td style={{ padding: "7px 8px", color: "var(--text-secondary)", fontSize: 10 }}>{s.description}</td>
                  <td style={{ padding: "7px 8px", color: s.lossUsd >= 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
                    {s.lossUsd >= 0 ? "+" : ""}{s.lossUsd.toLocaleString("en-US")}
                  </td>
                  <td style={{ padding: "7px 8px", color: s.pct >= 0 ? "#22c55e" : "#ef4444" }}>
                    {s.pct >= 0 ? "+" : ""}{s.pct.toFixed(1)}%
                  </td>
                  <td style={{ padding: "7px 8px" }}>
                    <span className={`badge ${s.prob === "Низкая" ? "badge-green" : s.prob === "Высокая" ? "badge-red" : "badge-yellow"}`}>{s.prob}</span>
                  </td>
                </tr>
              ))}
              {isEmpty && <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>Нет данных портфеля</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title">Алерты и триггеры рисков</div>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                {["Триггер", "Текущее", "Порог", "Статус"].map((h) => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {riskAlerts.map((a) => (
                <tr key={a.trigger} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "7px 8px", fontSize: 11 }}>
                    <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: a.color, marginRight: 6 }} />
                    {a.trigger}
                  </td>
                  <td style={{ padding: "7px 8px", fontWeight: 600 }}>{a.current}</td>
                  <td style={{ padding: "7px 8px", color: "var(--text-secondary)" }}>{a.threshold}</td>
                  <td style={{ padding: "7px 8px" }}>
                    <span className={`badge ${a.status === "Норма" ? "badge-green" : "badge-yellow"}`}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title">Защитные инструменты (хеджирование)</div>
          {isEmpty ? (
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>Добавьте инструменты в портфель</div>
          ) : (
            <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                  {["Инструмент", "Назначение", "Доля", "Рек."].map((h) => (
                    <th key={h} style={{ padding: "5px 6px", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hedgingRows.map((h, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px", fontWeight: 600 }}>{h.instrument}</td>
                    <td style={{ padding: "6px", color: "var(--text-secondary)" }}>{h.purpose}</td>
                    <td style={{ padding: "6px" }}>{h.share}</td>
                    <td style={{ padding: "6px" }}>
                      <span style={{ color: h.recommendation === "Держать" ? "#22c55e" : "#f59e0b", fontWeight: 600 }}>
                        {h.recommendation}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Row 3: Correlation + Drawdown + VaR table */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr 1.2fr", gap: 12 }}>
        <div className="card">
          <div className="card-title">Корреляционная матрица (топ позиции)</div>
          {!correlMatrix ? (
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>
              {isEmpty ? "Нет данных" : "Нужно минимум 2 инструмента (не кэш)"}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 10 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "4px 5px" }} />
                    {correlMatrix.tickers.map((t) => (
                      <th key={t} style={{ padding: "4px 5px", color: "var(--text-secondary)", fontWeight: 600 }}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {correlMatrix.data.map((row, i) => (
                    <tr key={i}>
                      <td style={{ padding: "4px 5px", fontWeight: 700, color: "var(--text-secondary)", fontSize: 9 }}>{correlMatrix.tickers[i]}</td>
                      {row.map((val, j) => {
                        const abs = Math.abs(val);
                        const bg = val > 0 ? `rgba(124,58,237,${abs * 0.7})` : `rgba(239,68,68,${abs * 0.7})`;
                        return (
                          <td key={j} style={{ padding: "5px", textAlign: "center", fontSize: 10, fontWeight: 600, background: bg, color: abs > 0.5 ? "white" : "var(--text-primary)", border: "1px solid var(--border)" }}>
                            {val.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div className="card-title" style={{ margin: 0 }}>
              Динамика просадки
              {histLoaded && mergedTimeline.length > 0 && (
                <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>
                  {mergedTimeline[0]?.date} — {mergedTimeline[mergedTimeline.length - 1]?.date}
                </span>
              )}
            </div>
            {!histLoaded && !isEmpty && (
              <span style={{ fontSize: 10, color: "var(--accent-light)", animation: "pulse 1.5s infinite" }}>Загрузка данных…</span>
            )}
          </div>
          {isEmpty ? (
            <div style={{ height: 152, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>Нет данных</div>
          ) : !histLoaded && historicalDrawdown.length === 0 ? (
            <div style={{ height: 152, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>Загрузка исторических цен…</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={152}>
                <AreaChart data={historicalDrawdown} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ddGrad3" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <ReferenceLine y={0} stroke="var(--text-muted)" strokeWidth={1} />
                  <ReferenceLine y={-5} stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.5} label={{ value: "-5%", position: "insideTopRight", fill: "#f59e0b", fontSize: 8 }} />
                  <ReferenceLine y={-10} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.5} label={{ value: "-10%", position: "insideTopRight", fill: "#ef4444", fontSize: 8 }} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(historicalDrawdown.length / 10))} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} domain={[Math.min(-15, Math.floor(maxHistDrawdown) - 2), 2]} width={34} />
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }} formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "Просадка от пика"]} />
                  <Area type="monotoneX" dataKey="drawdown" stroke="#ef4444" strokeWidth={2} fill="url(#ddGrad3)" dot={false} activeDot={{ r: 4, fill: "#ef4444", stroke: "var(--bg-card)", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                {[
                  { label: "Дневное изм.", value: `${app.dailyChangePct >= 0 ? "+" : ""}${app.dailyChangePct.toFixed(2)}%`, color: app.dailyChangePct >= 0 ? "#22c55e" : "#ef4444" },
                  { label: "P&L (всего)",  value: `${app.totalPnlPct >= 0 ? "+" : ""}${app.totalPnlPct.toFixed(2)}%`, color: app.totalPnlPct >= 0 ? "#22c55e" : "#ef4444" },
                  { label: "Макс. просадка", value: `${maxHistDrawdown.toFixed(2)}%`, color: "#ef4444" },
                  { label: "VaR 95% (1д)", value: `${metrics!.var95_1d}%`, color: "#ef4444" },
                ].map((item) => (
                  <div key={item.label} style={{ textAlign: "center", padding: "6px", background: "var(--bg-secondary)", borderRadius: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: item.color }}>{item.value}</div>
                    <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 1 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-title">Value at Risk (VaR) детализация</div>
          {isEmpty ? (
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>Нет данных портфеля</div>
          ) : (
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                  {["Период", "Уровень", "VaR (USD)", "VaR (%)", "Exp. Shortfall"].map((h) => (
                    <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {varRows.map((v, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "7px 8px" }}>{v.period}</td>
                    <td style={{ padding: "7px 8px", color: "var(--text-secondary)" }}>{v.level}</td>
                    <td style={{ padding: "7px 8px", color: "#ef4444", fontWeight: 700 }}>{Math.abs(v.varUsd).toLocaleString("en-US")}</td>
                    <td style={{ padding: "7px 8px", color: "#ef4444" }}>{v.varPct.toFixed(2)}%</td>
                    <td style={{ padding: "7px 8px", color: "#ef4444" }}>{Math.abs(v.esUsd).toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Row 4: High risk positions + Crisis strategies + Liquidity */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 0.8fr", gap: 12 }}>
        <div className="card">
          <div className="card-title">Позиции с повышенным риском</div>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                {["Тикер", "Причина", "Риск", "Доля", "Просадка"].map((h) => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {highRiskRows.length > 0 ? highRiskRows.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "7px 8px", fontWeight: 700, color: "var(--accent-light)" }}>{p.ticker}</td>
                  <td style={{ padding: "7px 8px", color: "var(--text-secondary)", fontSize: 11 }}>{p.reason || "—"}</td>
                  <td style={{ padding: "7px 8px" }}>
                    <span className={`badge ${p.risk === "Высокий" ? "badge-red" : "badge-yellow"}`}>{p.risk}</span>
                  </td>
                  <td style={{ padding: "7px 8px" }}>{p.share.toFixed(2)}%</td>
                  <td style={{ padding: "7px 8px", color: p.drawdown < 0 ? "#ef4444" : "#22c55e", fontWeight: 600 }}>
                    {p.drawdown >= 0 ? "+" : ""}{p.drawdown.toFixed(2)}%
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} style={{ padding: "12px 8px", textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>
                  {isEmpty ? "Нет данных" : "Нет позиций с повышенным риском ✓"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title">Стратегии защиты в кризис</div>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                {["Сценарий", "Действие", "Приоритет", "Комментарий"].map((h) => (
                  <th key={h} style={{ padding: "5px 6px", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {crisisStrategies.map((c) => (
                <tr key={c.scenario} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "6px", color: "var(--text-secondary)", fontSize: 10 }}>{c.scenario}</td>
                  <td style={{ padding: "6px", fontWeight: 600 }}>{c.action}</td>
                  <td style={{ padding: "6px" }}>
                    <span className={`badge ${c.priority === "Высокий" ? "badge-red" : "badge-yellow"}`}>{c.priority}</span>
                  </td>
                  <td style={{ padding: "6px", color: "var(--text-secondary)", fontSize: 10 }}>{c.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title">Ликвидность</div>
          {(() => {
            if (isEmpty) return <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>Нет данных</div>;
            const posV = (p: typeof positions[0]) => p.qty * (liveQuotes[p.ticker]?.current ?? p.avgPrice);
            const cashVal   = positions.filter(p => p.type === "Кэш").reduce((s, p) => s + posV(p), 0);
            const etfVal    = positions.filter(p => p.type === "ETF").reduce((s, p) => s + posV(p), 0);
            const stockVal  = positions.filter(p => p.type === "Акция").reduce((s, p) => s + posV(p), 0);
            const cryptoVal = positions.filter(p => p.type === "Крипто").reduce((s, p) => s + posV(p), 0);
            const pct = (v: number) => total > 0 ? (v / total * 100).toFixed(1) : "0.0";
            const pieData = [
              { name: "Кэш",    value: parseFloat(pct(cashVal)),   color: "#7c3aed" },
              { name: "ETF",    value: parseFloat(pct(etfVal)),    color: "#3b82f6" },
              { name: "Акции",  value: parseFloat(pct(stockVal)),  color: "#22c55e" },
              { name: "Крипто", value: parseFloat(pct(cryptoVal)), color: "#f59e0b" },
            ].filter(d => d.value > 0);
            const cashPct = parseFloat(pct(cashVal));
            const liqStatus = cashPct >= 5 ? "Хороший" : cashPct >= 2 ? "Умеренный" : "Низкий";
            const liqColor  = cashPct >= 5 ? "#22c55e" : cashPct >= 2 ? "#f59e0b" : "#ef4444";
            return (
              <>
                <ResponsiveContainer width="100%" height={110}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={46}>
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }} formatter={(v: any) => [`${v}%`]} />
                  </PieChart>
                </ResponsiveContainer>
                {pieData.map(item => (
                  <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, fontSize: 11 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, display: "inline-block" }} />
                    <span style={{ color: "var(--text-secondary)", flex: 1 }}>{item.name}</span>
                    <span style={{ fontWeight: 600 }}>{item.value}%</span>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 8, padding: 8, background: "var(--bg-secondary)", borderRadius: 8 }}>
                  Кэш-буфер (рек. 5-10%): <span style={{ color: liqColor, fontWeight: 700 }}>{liqStatus}</span>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
