"use client";

import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { PERIOD_OPTIONS } from "../constants";

export interface AssetDist {
  name: string;
  value: number;
  color: string;
}

export interface ChartPoint {
  date: string;
  value: number;
  cost: number;
}

export interface PeriodValue {
  value: number;
  pct: number;
}

export interface PeriodPerf {
  week: PeriodValue | null;
  month: PeriodValue | null;
  year: PeriodValue | null;
}

export interface ClassPnl {
  currency: string;
  value: number;
  pct: number;
}

export interface KeyIndicators {
  beta: string;
  maxDrawdown: string;
  var95_1d: string;
  var95_10d: string;
  sharpe: string;
  diversification: string;
}

interface DashboardRowProps {
  isMobile: boolean;
  assetDist: AssetDist[];

  // Dynamics card
  livePortfolioTotal: number;
  liveDailyChange: number;
  liveDailyChangePct: number;
  liveCost: number;
  period: string;
  setPeriod: (p: string) => void;
  chartData: ChartPoint[];
  periodPerf: PeriodPerf;
  hasPositions: boolean;
  backfillDone: boolean;
  backfilling: boolean;
  onBackfill: () => void;

  // PnL by class
  pnlByClass: ClassPnl[];

  // Key indicators
  liveRiskLabel: string;
  liveKeyIndicators: KeyIndicators;
  portfolioMaxDrawdown: number;
}

export function DashboardRow({
  isMobile,
  assetDist,
  livePortfolioTotal,
  liveDailyChange,
  liveDailyChangePct,
  liveCost,
  period,
  setPeriod,
  chartData,
  periodPerf,
  hasPositions,
  backfillDone,
  backfilling,
  onBackfill,
  pnlByClass,
  liveRiskLabel,
  liveKeyIndicators,
  portfolioMaxDrawdown,
}: DashboardRowProps) {
  const pnl = livePortfolioTotal - liveCost;
  const pnlPct = liveCost > 0 ? (pnl / liveCost) * 100 : 0;
  const { week: wk, month: mo, year: yr } = periodPerf;

  const bottomStats = [
    { label: "Вложено",  value: liveCost > 0 ? `$${Math.round(liveCost).toLocaleString("en-US")}` : "—" },
    { label: "День",     value: liveDailyChange !== 0 ? `${liveDailyChange >= 0 ? "+" : ""}${Math.round(liveDailyChange).toLocaleString("en-US")}` : "—", pos: liveDailyChange > 0, neg: liveDailyChange < 0 },
    { label: "День %",   value: `${liveDailyChangePct >= 0 ? "+" : ""}${liveDailyChangePct.toFixed(2)}%`, pos: liveDailyChangePct > 0, neg: liveDailyChangePct < 0 },
    { label: "Неделя",   value: wk ? `${wk.value >= 0 ? "+" : ""}${Math.abs(wk.value).toLocaleString("en-US")}` : "—", pos: (wk?.value ?? 0) > 0, neg: (wk?.value ?? 0) < 0 },
    { label: "Месяц",    value: mo ? `${mo.value >= 0 ? "+" : ""}${Math.abs(mo.value).toLocaleString("en-US")}` : "—", pos: (mo?.value ?? 0) > 0, neg: (mo?.value ?? 0) < 0 },
    { label: "Год",      value: yr ? `${yr.value >= 0 ? "+" : ""}${Math.abs(yr.value).toLocaleString("en-US")}` : "—", pos: (yr?.value ?? 0) > 0, neg: (yr?.value ?? 0) < 0 },
    { label: "P&L %",    value: liveCost > 0 ? `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : "—", pos: pnlPct > 0, neg: pnlPct < 0 },
  ];

  const keyIndicatorsList = [
    { label: "Уровень риска",            value: livePortfolioTotal > 0 ? liveRiskLabel : "—", color: "#f59e0b" },
    { label: "Бета (рынок)",             value: hasPositions ? liveKeyIndicators.beta : "—" },
    { label: "Макс. просадка (истор.)",  value: portfolioMaxDrawdown > 0 ? `${liveKeyIndicators.maxDrawdown}%` : "—", color: "#ef4444" },
    { label: "VaR (95%, 1 день)",        value: hasPositions ? `${liveKeyIndicators.var95_1d}%` : "—", color: "#ef4444" },
    { label: "VaR (95%, 10 дней)",       value: hasPositions ? `${liveKeyIndicators.var95_10d}%` : "—", color: "#ef4444" },
    { label: "Sharpe Ratio",             value: liveKeyIndicators.sharpe, color: liveKeyIndicators.sharpe !== "–" && parseFloat(liveKeyIndicators.sharpe) > 0 ? "#22c55e" : "#ef4444" },
    { label: "Диверсификация",           value: liveKeyIndicators.diversification, color: "#22c55e" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr 1fr 1fr", gap: 12 }}>
      <div className="card">
        <div className="card-title">Распределение активов</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={assetDist} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={65} label={false}>
                {assetDist.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 12 }}
                formatter={(v) => [`${v}%`]}
              />
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
          <div style={{ display: "flex", gap: 2, background: "var(--bg-secondary)", borderRadius: 8, padding: 3, border: "1px solid var(--border)" }}>
            {PERIOD_OPTIONS.map((p) => (
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

        {chartData.length < 2 ? (
          <div style={{ height: 190, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--text-muted)" }}>
            <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} opacity={0.4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <span style={{ fontSize: 12, opacity: 0.6 }}>История накапливается — заходи каждый день</span>
            {hasPositions && !backfillDone && (
              <button
                onClick={onBackfill}
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
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} domain={["auto", "auto"]} width={40} />
              <Tooltip
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: "var(--text-secondary)", fontSize: 10 }}
                formatter={(v, name) => {
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

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          {bottomStats.map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: s.neg ? "#ef4444" : s.pos ? "#22c55e" : "var(--text-primary)" }}>{s.value}</div>
            </div>
          ))}
        </div>
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
          {keyIndicatorsList.map((item) => (
            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
              <span style={{ fontWeight: 700, color: item.color ?? "var(--text-primary)" }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
