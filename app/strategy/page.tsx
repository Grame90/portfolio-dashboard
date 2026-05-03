"use client";

import { useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import {
  LineChart, Line, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { useApp } from "@/lib/AppContext";
import { useMobile } from "@/lib/useMobile";

const TICKER_BETA: Record<string, number> = {
  BTC: 2.5, ETH: 2.8, SOL: 3.0, DOGE: 3.5, XRP: 2.2,
  TSLA: 2.0, NVDA: 1.8, META: 1.4, AMZN: 1.3, GOOGL: 1.2, AAPL: 1.2, MSFT: 1.1,
  QQQ: 1.1, ARKK: 1.6, SMH: 1.5, SOXX: 1.4, XLK: 1.2,
  SPY: 1.0, VOO: 1.0, IVV: 1.0, VTI: 1.0,
  GLD: 0.0, SLV: 0.1, IAU: 0.0,
  "BRK.B": 0.9, JPM: 1.2, BAC: 1.3, V: 0.9, MA: 0.9, IBKR: 1.1,
  JNJ: 0.5, PFE: 0.6, KO: 0.5, PG: 0.5, T: 0.5,
};

const TYPE_RETURN: Record<string, number> = {
  ETF: 10, Акция: 13, Крипто: 25, Сырьё: 6, Кэш: 4, Облигация: 5,
};

const PORTFOLIO_RULES = [
  "Никогда не рисковать более 1–2% на одну идею",
  "Фиксируй минимум 10% прибыли при достижении цели",
  "Максимальная просадка портфеля: 20%",
  "Ребалансировка каждые 3 месяца или при отклонении > 5%",
  "Держи кэш не менее 5% для манёвра",
  "Инвестируй в растущие активы и тренды",
];

const MACRO_FACTORS = [
  { factor: "Инфляция (CPI)", current: "2.9%", forecast: "↓ 2.5%", impact: "Положительное" },
  { factor: "Ставка ФРС", current: "4.25–4.50%", forecast: "↓ 3.75%", impact: "Положительное" },
  { factor: "ВВП (США)", current: "2.3%", forecast: "→ 2.1%", impact: "Нейтральное" },
  { factor: "Безработица", current: "4.1%", forecast: "↑ 4.3%", impact: "Нейтральное" },
  { factor: "Рынок акций (S&P 500)", current: "5,560", forecast: "↑ 5,900", impact: "Положительное" },
  { factor: "Цена золота", current: "3,200", forecast: "↑ 3,500", impact: "Положительное" },
];

const TYPE_COLORS: Record<string, string> = {
  ETF: "#7c3aed", Акция: "#3b82f6", Крипто: "#f59e0b",
  Сырьё: "#22c55e", Кэш: "#94a3b8", Облигация: "#06b6d4",
};

const RATING_COLORS: Record<string, string> = {
  A: "#22c55e", "A-": "#22c55e", "B+": "#f59e0b", B: "#f59e0b",
};


function CircleProgress({ value, size = 90, color = "#7c3aed" }: { value: number; size?: number; color?: string }) {
  const r = size * 0.4;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" style={{ fill: "var(--text-primary)" }} fontSize={size * 0.18} fontWeight={700}>
        {value}%
      </text>
    </svg>
  );
}

export default function StrategyPage() {
  const isMobile = useMobile();
  const app = useApp();
  const goalProgress = app.settings.targetAmount > 0
    ? Math.min(100, (app.portfolioTotal / app.settings.targetAmount) * 100)
    : 0;
  const forecastBase = app.portfolioTotal || app.totalCost || 100000;

  const weightedBeta = useMemo(() => {
    if (!app.portfolioTotal) return 1.0;
    return app.positions.reduce((s, p) => {
      const val = p.qty * (app.liveQuotes[p.ticker]?.current || p.avgPrice);
      return s + (TICKER_BETA[p.ticker] ?? 1.0) * (val / app.portfolioTotal);
    }, 0);
  }, [app.positions, app.liveQuotes, app.portfolioTotal]);

  const liveStrategyRating = useMemo(() => {
    const n = app.positions.length;
    if (n === 0) return { overall: "–", label: "Нет данных", categories: [] };
    const types = new Set(app.positions.map(p => p.type));

    const retRating = app.totalPnlPct > 15 ? "A" : app.totalPnlPct > 5 ? "A-" : app.totalPnlPct > 0 ? "B+" : "B";
    const topWeight = app.portfolioTotal > 0
      ? Math.max(...app.positions.map(p => (p.qty * (app.liveQuotes[p.ticker]?.current || p.avgPrice)) / app.portfolioTotal * 100))
      : 0;
    const riskRating = topWeight > 40 ? "B" : topWeight > 25 ? "B+" : "A-";
    const divRating = types.size >= 3 && n >= 5 ? "A" : types.size >= 2 && n >= 3 ? "B+" : "B";
    const annVol = Math.max(5, weightedBeta * 15);
    const sharpe = annVol > 0 ? (app.totalPnlPct - 5) / annVol : 0;
    const effRating = sharpe > 1 ? "A" : sharpe > 0.5 ? "A-" : "B+";
    const stabRating = weightedBeta < 0.9 ? "A" : weightedBeta < 1.2 ? "A-" : "B+";
    const scores = [retRating, riskRating, divRating, effRating, stabRating];
    const aCount = scores.filter(r => r.startsWith("A")).length;
    const overall = aCount >= 4 ? "A" : aCount >= 2 ? "A-" : "B+";
    const label = overall === "A" ? "Превосходно" : overall === "A-" ? "Отлично" : "Хорошо";
    return {
      overall, label,
      categories: [
        { name: "Доходность", rating: retRating },
        { name: "Риск-менеджмент", rating: riskRating },
        { name: "Диверсификация", rating: divRating },
        { name: "Эффективность", rating: effRating },
        { name: "Устойчивость", rating: stabRating },
      ],
    };
  }, [app.positions, app.liveQuotes, app.portfolioTotal, app.totalPnlPct, weightedBeta]);

  const liveAiForecasts = useMemo(() => {
    const total = app.portfolioTotal || app.totalCost || 1;
    const baseReturn = app.positions.reduce((s, p) => {
      const val = p.qty * (app.liveQuotes[p.ticker]?.current || p.avgPrice);
      return s + (TYPE_RETURN[p.type] ?? 10) * (val / total);
    }, 0) || 12;
    return [
      { label: "Консервативный", value: parseFloat((baseReturn * 0.65).toFixed(1)) },
      { label: "Базовый", value: parseFloat(baseReturn.toFixed(1)) },
      { label: "Агрессивный", value: parseFloat((baseReturn * 1.45).toFixed(1)) },
    ];
  }, [app.positions, app.liveQuotes, app.portfolioTotal, app.totalCost]);

  const liveGoalProbabilities = useMemo(() => {
    const current = app.portfolioTotal;
    const target = app.settings.targetAmount;
    const monthly = app.settings.monthlyContribution;
    if (target <= 0) return [{ years: 5, probability: 0 }, { years: 10, probability: 0 }, { years: 15, probability: 0 }];
    const baseR = (liveAiForecasts[1]?.value ?? 12) / 100 / 12;
    function probability(years: number): number {
      const n = years * 12;
      const fv = current * Math.pow(1 + baseR, n) + (baseR > 0 ? monthly * (Math.pow(1 + baseR, n) - 1) / baseR : monthly * n);
      const ratio = fv / target;
      if (ratio >= 1.5) return 95;
      if (ratio >= 1.0) return Math.round(70 + (ratio - 1.0) * 50);
      if (ratio >= 0.6) return Math.round(40 + (ratio - 0.6) * 75);
      return Math.max(5, Math.round(ratio * 60));
    }
    return [
      { years: 5, probability: Math.min(98, Math.max(5, probability(5))) },
      { years: 10, probability: Math.min(98, Math.max(10, probability(10))) },
      { years: 15, probability: Math.min(99, Math.max(20, probability(15))) },
    ];
  }, [app.portfolioTotal, app.settings, liveAiForecasts]);

  const liveTargetAllocation = useMemo(() => {
    const groups: Record<string, number> = {};
    const total = app.portfolioTotal || 1;
    app.positions.forEach(p => {
      const val = p.qty * (app.liveQuotes[p.ticker]?.current || p.avgPrice);
      groups[p.type] = (groups[p.type] || 0) + val;
    });
    if (Object.keys(groups).length === 0) {
      return [
        { name: "Акции США", value: 60, color: "#7c3aed" },
        { name: "ETF", value: 20, color: "#3b82f6" },
        { name: "Драг. металлы", value: 10, color: "#f59e0b" },
        { name: "Облигации", value: 5, color: "#22c55e" },
        { name: "Кэш", value: 5, color: "#94a3b8" },
      ];
    }
    return Object.entries(groups)
      .map(([name, val]) => ({ name, value: parseFloat((val / total * 100).toFixed(1)), color: TYPE_COLORS[name] ?? "#9d6ef5" }))
      .sort((a, b) => b.value - a.value);
  }, [app.positions, app.liveQuotes, app.portfolioTotal]);

  const liveActionPlan = useMemo(() => {
    if (!app.positions.length) return [
      { action: "Добавьте позиции в портфель", target: "Начните с индексных ETF", status: "Запланировано" },
      { action: "Установите финансовую цель", target: "В разделе Настройки", status: "Запланировано" },
    ];
    const actions: { action: string; target: string; status: string }[] = [];
    const byPnl = [...app.positions].filter(p => p.type !== "Кэш")
      .map(p => {
        const price = app.liveQuotes[p.ticker]?.current || p.avgPrice;
        const pnlPct = p.avgPrice > 0 ? ((price - p.avgPrice) / p.avgPrice) * 100 : 0;
        return { ...p, pnlPct };
      })
      .sort((a, b) => a.pnlPct - b.pnlPct);
    if (byPnl.length > 0 && byPnl[0].pnlPct < -5) {
      actions.push({ action: `Докупка ${byPnl[0].ticker} на просадке`, target: `Просадка ${byPnl[0].pnlPct.toFixed(1)}% — возможная точка входа`, status: "В процессе" });
    }
    const winner = byPnl[byPnl.length - 1];
    if (winner && winner.pnlPct > 20) {
      actions.push({ action: `Фиксация прибыли ${winner.ticker}`, target: `Прибыль +${winner.pnlPct.toFixed(1)}% — рассмотреть частичную продажу`, status: "Запланировано" });
    }
    if (app.settings.monthlyContribution > 0) {
      actions.push({ action: "Пополнение портфеля", target: `Плановый взнос: ${app.settings.monthlyContribution.toLocaleString("en-US")} USD`, status: "Запланировано" });
    }
    actions.push({ action: "Ребалансировка портфеля", target: `Цикл: ${app.settings.rebalancePeriod || "Квартально"}`, status: "Ожидание" });
    if (actions.length < 4) {
      actions.push({ action: "Анализ новых инструментов", target: "Расширить диверсификацию портфеля", status: "Запланировано" });
    }
    return actions.slice(0, 5);
  }, [app.positions, app.liveQuotes, app.settings]);

  const liveAiInsights = useMemo(() => {
    const insights: string[] = [];
    const n = app.positions.length;
    if (n === 0) return ["Добавьте позиции для получения AI-аналитики"];
    const types = new Set(app.positions.map(p => p.type));
    const total = app.portfolioTotal || 1;
    const cryptoShare = app.positions.filter(p => p.type === "Крипто")
      .reduce((s, p) => s + p.qty * (app.liveQuotes[p.ticker]?.current || p.avgPrice), 0) / total * 100;
    const cashShare = app.positions.filter(p => p.type === "Кэш")
      .reduce((s, p) => s + p.qty * p.avgPrice, 0) / total * 100;
    const profitable = app.positions.filter(p => {
      const price = app.liveQuotes[p.ticker]?.current || p.avgPrice;
      return price > p.avgPrice;
    }).length;
    if (types.size >= 3 && n >= 5) insights.push("Портфель хорошо диверсифицирован по классам активов");
    else if (types.size < 3) insights.push("Рассмотрите добавление разных классов активов для диверсификации");
    if (cryptoShare > 20) insights.push(`Высокий риск: доля криптовалюты ${cryptoShare.toFixed(1)}% — выше рекомендуемых 20%`);
    else if (cryptoShare > 0) insights.push(`Криптовалюта ${cryptoShare.toFixed(1)}% — добавляет диверсификацию и риск`);
    if (cashShare < 3) insights.push("Рекомендуется держать 5%+ кэша для манёвра при просадках");
    else if (cashShare > 15) insights.push(`Избыток кэша (${cashShare.toFixed(1)}%) — рассмотрите инвестирование`);
    if (profitable > n * 0.7) insights.push(`${profitable} из ${n} позиций в прибыли — портфель растёт`);
    else if (profitable < n * 0.4) insights.push(`Только ${profitable} из ${n} позиций прибыльны — проведите анализ убыточных`);
    insights.push("Следите за решениями ФРС и инфляционными данными");
    return insights.slice(0, 5);
  }, [app.positions, app.liveQuotes, app.portfolioTotal]);

  const liveSignals = useMemo(() => {
    if (!app.positions.length) return [];
    return app.positions.filter(p => p.type !== "Кэш").map(p => {
      const price = app.liveQuotes[p.ticker]?.current || p.avgPrice;
      const pnlPct = p.avgPrice > 0 ? ((price - p.avgPrice) / p.avgPrice) * 100 : 0;
      const quote = app.liveQuotes[p.ticker];
      const dayChgPct = quote && quote.previousClose > 0 ? ((quote.current - quote.previousClose) / quote.previousClose) * 100 : 0;
      let signal: string, color: string, confidence: number, reason: string;
      if (pnlPct < -12) {
        signal = "ВЫЙТИ"; color = "#ef4444"; confidence = 78;
        reason = `Просадка ${pnlPct.toFixed(1)}% — стоп-лосс`;
      } else if (pnlPct > 20 && dayChgPct > 1) {
        signal = "СНИЗИТЬ"; color = "#f59e0b"; confidence = 65;
        reason = `Рост +${pnlPct.toFixed(1)}%, перегрет — зафиксировать часть`;
      } else if (pnlPct < -5 && dayChgPct < -2) {
        signal = "ДОКУПИТЬ"; color = "#22c55e"; confidence = 60;
        reason = `Откат ${pnlPct.toFixed(1)}% с падением ${dayChgPct.toFixed(1)}%`;
      } else {
        signal = "ДЕРЖАТЬ"; color = "#7c3aed"; confidence = 80;
        reason = `Позиция в норме, P&L ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%`;
      }
      return { ticker: p.ticker, signal, color, confidence, reason };
    });
  }, [app.positions, app.liveQuotes]);

  const forecastData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const pv = forecastBase;
    const pmt = app.settings.monthlyContribution;
    const compute = (annualRate: number, months: number) => {
      const r = annualRate / 12;
      const fv = r > 0
        ? pv * Math.pow(1 + r, months) + pmt * (Math.pow(1 + r, months) - 1) / r
        : pv + pmt * months;
      return Math.round(fv);
    };
    return Array.from({ length: 6 }, (_, i) => ({
      year: i === 0 ? "Сейчас" : String(currentYear + i),
      conservative: compute(0.07, i * 12),
      base: compute(0.12, i * 12),
      aggressive: compute(0.18, i * 12),
    }));
  }, [forecastBase, app.settings.monthlyContribution]);

  const today = new Date();
  const aiUpdateTime = `${String(today.getDate()).padStart(2,"0")}.${String(today.getMonth()+1).padStart(2,"0")}.${today.getFullYear()} ${String(today.getHours()).padStart(2,"0")}:${String(today.getMinutes()).padStart(2,"0")}`;

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader title="СТРАТЕГИЯ И ПЛАН ДЕЙСТВИЙ" subtitle="Стратегия, правила, AI-решения и долгосрочный план" showSnapshot />

      <div style={{ padding: isMobile ? "12px" : "16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Row 1: Rating + Long-term goal + AI forecast + Goal probability */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1.5fr 1fr", gap: 12 }}>
          <div className="card">
            <div className="card-title">Стратегический рейтинг портфеля</div>
            {liveStrategyRating.categories.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Добавьте позиции для расчёта рейтинга</div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: "50%",
                  border: `3px solid ${RATING_COLORS[liveStrategyRating.overall] ?? "#22c55e"}`,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: RATING_COLORS[liveStrategyRating.overall] ?? "#22c55e" }}>
                    {liveStrategyRating.overall}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{liveStrategyRating.label}</div>
                </div>
                <div style={{ flex: 1 }}>
                  {liveStrategyRating.categories.map((c) => (
                    <div key={c.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: "var(--text-secondary)" }}>{c.name}</span>
                      <span style={{ fontWeight: 700, color: RATING_COLORS[c.rating] ?? "#22c55e" }}>{c.rating}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">Долгосрочная цель</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent-light)", marginBottom: 4 }}>
              Финансовая свобода
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#22c55e" }}>{goalProgress.toFixed(1)}%</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
              Цель: {app.settings.targetAmount.toLocaleString("en-US")} USD
            </div>
            <div className="progress-bar" style={{ marginBottom: 8 }}>
              <div className="progress-fill" style={{ width: `${goalProgress}%` }} />
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {Math.round(app.portfolioTotal).toLocaleString("en-US")} / {app.settings.targetAmount.toLocaleString("en-US")} USD
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>Текущий прогресс</div>
          </div>

          <div className="card">
            <div className="card-title">Ожидаемая доходность (прогноз)</div>
            <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
              {liveAiForecasts.map((f) => (
                <div key={f.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{f.label}</div>
                  <div className="positive" style={{ fontSize: 20, fontWeight: 700 }}>+{f.value}%</div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>в год</div>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={forecastData}>
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#555577" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#555577" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }} formatter={(v: any) => [`$${Number(v).toLocaleString("en-US")}`]} />
                <Line type="monotone" dataKey="conservative" stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="base" stroke="#7c3aed" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="aggressive" stroke="#22c55e" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, fontSize: 10, color: "var(--text-secondary)" }}>
              {[{ label: "Конс. 7%", color: "#3b82f6" }, { label: "Базовый 12%", color: "#7c3aed" }, { label: "Агрес. 18%", color: "#22c55e" }].map(l => (
                <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{ width: 12, height: 2, background: l.color, display: "inline-block" }} />{l.label}
                </span>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Вероятность достижения цели</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
              {liveGoalProbabilities.map((g) => (
                <div key={g.years} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
                  <CircleProgress value={g.probability} size={70} color={g.probability >= 80 ? "#22c55e" : "#f59e0b"} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{g.years} лет</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>При текущей стратегии</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Target allocation + Action plan + Portfolio rules + AI insights */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1.2fr 1fr 1fr", gap: 12 }}>
          <div className="card">
            <div className="card-title">Текущее распределение активов</div>
            <div style={{ position: "relative" }}>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={liveTargetAllocation} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={65}>
                    {liveTargetAllocation.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }} formatter={(v: any) => [`${v}%`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {liveTargetAllocation.map((a) => (
              <div key={a.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: a.color, display: "inline-block" }} />
                  <span style={{ color: "var(--text-secondary)" }}>{a.name}</span>
                </span>
                <span style={{ fontWeight: 700 }}>{a.value}%</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">План действий на 30 дней</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {liveActionPlan.map((a) => (
                <div key={a.action} style={{ padding: "10px", background: "var(--bg-secondary)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{a.action}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{a.target}</div>
                  </div>
                  <span className={`badge ${a.status === "В процессе" ? "badge-blue" : a.status === "Запланировано" ? "badge-purple" : "badge-yellow"}`}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Правила портфеля</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {PORTFOLIO_RULES.map((rule, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px", background: "var(--bg-secondary)", borderRadius: 8 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", background: "var(--accent)", display: "flex",
                    alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "white", flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>{rule}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">AI-инсайты и рекомендации</div>
            <div style={{ marginBottom: 12 }}>
              {liveAiInsights.map((insight, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#7c3aed", marginTop: 5, flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{insight}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "16px", background: "linear-gradient(135deg, #1a0a3a, #0a0a1a)", borderRadius: 12, textAlign: "center", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 24 }}>🧠</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 8 }}>AI-анализ обновлён</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{aiUpdateTime}</div>
            </div>
          </div>
        </div>

        {/* Row 3: Macro + AI signals + Long-term strategy */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1.2fr 1fr", gap: 12 }}>
          <div className="card">
            <div className="card-title">Макроэкономический прогноз</div>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                  {["Фактор", "Текущая ситуация", "Прогноз (6-12 мес.)", "Влияние на портфель"].map((h) => (
                    <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MACRO_FACTORS.map((m) => (
                  <tr key={m.factor} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "7px 8px" }}>{m.factor}</td>
                    <td style={{ padding: "7px 8px", color: "var(--text-secondary)" }}>{m.current}</td>
                    <td style={{ padding: "7px 8px", fontWeight: 600 }}>{m.forecast}</td>
                    <td style={{ padding: "7px 8px" }}>
                      <span style={{ color: m.impact === "Положительное" ? "#22c55e" : m.impact === "Отрицательное" ? "#ef4444" : "#f59e0b", fontWeight: 600 }}>
                        {m.impact}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0 }}>AI-портфельные сигналы</div>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Живые</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {liveSignals.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 12, padding: "8px 0" }}>Добавьте позиции для AI-сигналов</div>
              ) : liveSignals.map((s) => (
                <div key={s.ticker} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", background: "var(--bg-secondary)", borderRadius: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: s.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: "white" }}>
                    {s.signal === "ДОКУПИТЬ" ? "↑" : s.signal === "СНИЗИТЬ" ? "↓" : s.signal === "ДЕРЖАТЬ" ? "→" : "✕"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.signal}</span>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{s.ticker}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{s.reason}</div>
                  </div>
                  <div style={{
                    padding: "3px 8px", borderRadius: 4,
                    background: `rgba(${s.color === "#22c55e" ? "34,197,94" : s.color === "#ef4444" ? "239,68,68" : "245,158,11"},0.15)`,
                    color: s.color, fontWeight: 700, fontSize: 12,
                  }}>
                    {s.confidence}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Долгосрочная стратегия</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
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
            <div style={{
              padding: "20px", background: "linear-gradient(135deg, #1a0a3a, #0d0020)", borderRadius: 12,
              textAlign: "center", border: "1px solid var(--border)", position: "relative", overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                width: 120, height: 120, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%)",
              }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-light)", letterSpacing: "0.1em", position: "relative" }}>
                ФИНАНСОВАЯ<br />СВОБОДА<br />ТВОЯ ЦЕЛЬ
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
