"use client";

import { useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import {
  LineChart, Line, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  strategyRating, longTermGoal, aiForecasts, goalProbabilities,
  targetStrategicAllocation, actionPlan, portfolioRules,
  macroFactors, aiInsights,
} from "@/lib/mockData";
import { useApp } from "@/lib/AppContext";

function CircleProgress({ value, size = 90, color = "#7c3aed" }: { value: number; size?: number; color?: string }) {
  const r = size * 0.4;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={c} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" style={{ fill: "var(--text-primary)" }} fontSize={size * 0.18} fontWeight={700}>
        {value}%
      </text>
    </svg>
  );
}

// AI forecast chart data (static % returns — scaled by forecastBase at render time)
const FORECAST_RETURNS = [
  { year: "2024", conservative: 12, base: 18, aggressive: 26 },
  { year: "2025", conservative: 25, base: 40, aggressive: 58 },
  { year: "2026", conservative: 40, base: 65, aggressive: 95 },
  { year: "2027", conservative: 56, base: 92, aggressive: 135 },
  { year: "2028", conservative: 74, base: 122, aggressive: 180 },
];

const ratingColors: Record<string, string> = {
  "A": "#22c55e", "A-": "#22c55e", "B+": "#f59e0b", "B": "#f59e0b",
};

export default function StrategyPage() {
  const app = useApp();
  const goalProgress = app.settings.targetAmount > 0 ? Math.min(100, (app.portfolioTotal / app.settings.targetAmount) * 100) : 0;
  const forecastBase = app.portfolioTotal || app.totalCost || 260000;

  const liveSignals = useMemo(() => {
    if (!app.positions.length) return [];
    return app.positions.filter(p => p.type !== "Кэш").map(p => {
      const price = app.liveQuotes[p.ticker]?.current || p.avgPrice;
      const pnlPct = ((price - p.avgPrice) / p.avgPrice) * 100;
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

  const forecastData = FORECAST_RETURNS.map(r => ({
    year: r.year,
    conservative: Math.round(forecastBase * (1 + r.conservative / 100)),
    base: Math.round(forecastBase * (1 + r.base / 100)),
    aggressive: Math.round(forecastBase * (1 + r.aggressive / 100)),
  }));

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader title="СТРАТЕГИЯ И ПЛАН ДЕЙСТВИЙ" subtitle="Стратегия, правила, AI-решения и долгосрочный план" showSnapshot />

      <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Row 1: Rating + Long-term goal + AI forecast + Goal probability */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr 1fr", gap: 12 }}>
          <div className="card">
            <div className="card-title">Стратегический рейтинг портфеля</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                border: `3px solid ${ratingColors[strategyRating.overall] ?? "#22c55e"}`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: ratingColors[strategyRating.overall] ?? "#22c55e" }}>
                  {strategyRating.overall}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{strategyRating.label}</div>
              </div>
              <div style={{ flex: 1 }}>
                {strategyRating.categories.map((c) => (
                  <div key={c.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{c.name}</span>
                    <span style={{ fontWeight: 700, color: ratingColors[c.rating] ?? "#22c55e" }}>{c.rating}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Долгосрочная цель</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent-light)", marginBottom: 4 }}>
              {longTermGoal.name}
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
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
              Текущий прогресс
            </div>
          </div>

          <div className="card">
            <div className="card-title">Ожидаемая доходность (прогноз AI)</div>
            <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
              {aiForecasts.map((f) => (
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
            <div style={{ fontSize: 10, color: "var(--text-secondary)", textAlign: "center" }}>• Базовый сценарий</div>
          </div>

          <div className="card">
            <div className="card-title">Вероятность достижения цели</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
              {goalProbabilities.map((g) => (
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

        {/* Row 2: Strategic allocation + Action plan + Portfolio rules + AI insights */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr 1fr", gap: 12 }}>
          <div className="card">
            <div className="card-title">Стратегическое распределение активов (целевое)</div>
            <div style={{ position: "relative" }}>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={targetStrategicAllocation} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={65}>
                    {targetStrategicAllocation.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }} formatter={(v: any) => [`${v}%`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {targetStrategicAllocation.map((a) => (
              <div key={a.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: a.color, display: "inline-block" }} />
                  <span style={{ color: "var(--text-secondary)" }}>{a.name}</span>
                </span>
                <span style={{ fontWeight: 700 }}>{a.value}%</span>
              </div>
            ))}
            <div style={{ marginTop: 8, textAlign: "center" }}>
              <span style={{ color: "var(--accent-light)", fontSize: 12, cursor: "pointer" }}>Сравнить с текущим портфелем →</span>
            </div>
          </div>

          <div className="card">
            <div className="card-title">План действий на 30 дней</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {actionPlan.map((a) => (
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
            <div style={{ marginTop: 8, textAlign: "center" }}>
              <span style={{ color: "var(--accent-light)", fontSize: 12, cursor: "pointer" }}>Смотреть полный план →</span>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Правила портфеля</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {portfolioRules.map((rule, i) => (
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
            <div style={{ marginTop: 8, textAlign: "center" }}>
              <span style={{ color: "var(--accent-light)", fontSize: 12, cursor: "pointer" }}>Редактировать правила →</span>
            </div>
          </div>

          <div className="card">
            <div className="card-title">AI-инсайты и рекомендации</div>
            <div style={{ marginBottom: 12 }}>
              {aiInsights.map((insight, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#7c3aed", marginTop: 5, flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{insight}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "16px", background: "linear-gradient(135deg, #1a0a3a, #0a0a1a)", borderRadius: 12, textAlign: "center", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 24 }}>🧠</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 8 }}>AI-анализ обновлён</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>21.05.2024 01:52</div>
            </div>
            <div style={{ marginTop: 8, textAlign: "center" }}>
              <span style={{ color: "var(--accent-light)", fontSize: 12, cursor: "pointer" }}>Все инсайты AI →</span>
            </div>
          </div>
        </div>

        {/* Row 3: Macro + AI signals + Long-term strategy */}
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr 1fr", gap: 12 }}>
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
                {macroFactors.map((m) => (
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
            <div style={{ marginTop: 8, textAlign: "center" }}>
              <span style={{ color: "var(--accent-light)", fontSize: 12, cursor: "pointer" }}>Смотреть полный прогноз →</span>
            </div>
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0 }}>AI-портфельные сигналы</div>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Яркие</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {liveSignals.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 12, padding: "8px 0" }}>Добавьте позиции для AI-сигналов</div>
              ) : liveSignals.map((s) => (
                <div key={s.ticker} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", background: "var(--bg-secondary)", borderRadius: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: s.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8 }}>
                    {s.signal === "ПОКУПАТЬ" ? "↑" : s.signal === "СНИЗИТЬ" ? "↓" : s.signal === "ДЕРЖАТЬ" ? "→" : "👁"}
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
            <div style={{ marginTop: 8, textAlign: "center" }}>
              <span style={{ color: "var(--accent-light)", fontSize: 12, cursor: "pointer" }}>Все сигналы →</span>
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
            <div style={{ marginTop: 8, textAlign: "center" }}>
              <span style={{ color: "var(--accent-light)", fontSize: 12, cursor: "pointer" }}>Редактировать стратегию →</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
