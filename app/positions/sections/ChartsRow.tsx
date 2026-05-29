"use client";

import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { PERIOD_OPTIONS } from "../constants";
import type { Position } from "../types";

type ProfitMode = "USD" | "%";

interface ChartPoint {
  date: string;
  value: number;
  cost: number;
}

interface ChartsRowProps {
  isMobile: boolean;
  positions: Position[];
  chartData: ChartPoint[];
  allChartData: ChartPoint[];
  totalForChart: number;
  period: string;
  onPeriodChange: (p: string) => void;
  profitMode: ProfitMode;
  onProfitModeChange: (m: ProfitMode) => void;
}

const legendDot = (color: string, opacity = 1) => (
  <span style={{ width: 14, height: 2, background: color, display: "inline-block", borderRadius: 1, opacity }} />
);

const valueTooltipFormatter = (v: unknown, name: unknown): [string, string] => [
  `$${Number(v).toLocaleString("en-US")}`,
  name === "value" ? "Стоимость" : "Вложено",
];

export function ChartsRow({
  isMobile,
  positions,
  chartData,
  allChartData,
  totalForChart,
  period,
  onPeriodChange,
  profitMode,
  onProfitModeChange,
}: ChartsRowProps) {
  const periodDiff = chartData.length >= 2 ? chartData[chartData.length - 1].value - chartData[0].value : 0;
  const periodDiffPct = chartData.length >= 2 && chartData[0].value > 0 ? (periodDiff / chartData[0].value) * 100 : 0;

  const allTimeFirst = allChartData[0]?.value ?? 0;
  const allTimeLast = allChartData[allChartData.length - 1]?.value ?? 0;
  const allTimeDiff = allTimeLast - allTimeFirst;
  const allTimePct = allTimeFirst > 0 ? (allTimeDiff / allTimeFirst) * 100 : 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div className="card-title" style={{ margin: 0 }}>Динамика портфеля</div>
            <div style={{ display: "flex", gap: 4 }}>
              {PERIOD_OPTIONS.map((p) => (
                <button
                  key={p}
                  className={`tab-btn ${period === p ? "active" : ""}`}
                  onClick={() => onPeriodChange(p)}
                  style={{ fontSize: 10, padding: "3px 6px" }}
                >{p}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 6, display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 700 }}>
              ${(chartData[chartData.length - 1]?.value ?? totalForChart).toLocaleString("en-US")}
            </span>
            {chartData.length >= 2 && (
              <span style={{ fontSize: 12, fontWeight: 600, color: periodDiff >= 0 ? "var(--green)" : "var(--red)" }}>
                {periodDiff >= 0 ? "+" : ""}{periodDiff.toLocaleString("en-US")} ({periodDiff >= 0 ? "+" : ""}{periodDiffPct.toFixed(2)}%)
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 6, fontSize: 10, color: "var(--text-secondary)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{legendDot("var(--accent)")}Стоимость</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{legendDot("var(--yellow)", 0.8)}Вложено</span>
          </div>
          <ResponsiveContainer width="100%" height={130}>
            <AreaChart data={chartData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPeriod" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} width={32} />
              <Tooltip
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
                formatter={valueTooltipFormatter}
              />
              <Area type="monotone" dataKey="cost" stroke="var(--yellow)" strokeWidth={1.5} strokeDasharray="5 3" fill="none" dot={false} />
              <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#gradPeriod)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Динамика с начала отслеживания</div>
            <div style={{ display: "flex", gap: 12, fontSize: 10, color: "var(--text-secondary)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{legendDot("var(--accent)")}Стоимость</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{legendDot("var(--yellow)", 0.8)}Вложено</span>
            </div>
          </div>
          {allChartData.length >= 2 && (
            <div style={{ marginBottom: 6, display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>${allTimeLast.toLocaleString("en-US")}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: allTimeDiff >= 0 ? "var(--green)" : "var(--red)" }}>
                {allTimeDiff >= 0 ? "+" : ""}{allTimeDiff.toLocaleString("en-US")} ({allTimeDiff >= 0 ? "+" : ""}{allTimePct.toFixed(2)}%)
              </span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>всё время</span>
            </div>
          )}
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={allChartData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradAllTime" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} width={32} />
              <Tooltip
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
                formatter={valueTooltipFormatter}
              />
              <Area type="monotone" dataKey="cost" stroke="var(--yellow)" strokeWidth={1.5} strokeDasharray="5 3" fill="none" dot={false} />
              <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#gradAllTime)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div className="card-title" style={{ margin: 0 }}>Прибыль по позициям</div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["USD", "%"] as const).map((m) => (
              <button
                key={m}
                className={`tab-btn ${profitMode === m ? "active" : ""}`}
                onClick={() => onProfitModeChange(m)}
                style={{ fontSize: 11, padding: "4px 10px" }}
              >{m}</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(180, positions.length * 22)}>
          <BarChart data={[...positions].sort((a, b) => b.pnlPct - a.pnlPct)} layout="vertical" barSize={10}>
            <XAxis type="number" tick={{ fontSize: 9, fill: "#555577" }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="ticker" tick={{ fontSize: 10, fill: "#aaaacc" }} tickLine={false} axisLine={false} width={45} />
            <Tooltip
              contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }}
              formatter={(v) => [profitMode === "USD" ? `$${Number(v).toLocaleString("en-US")}` : `${Number(v).toFixed(2)}%`]}
            />
            <Bar dataKey={profitMode === "USD" ? "pnl" : "pnlPct"} radius={[0, 4, 4, 0]}>
              {positions.map((p) => (
                <Cell key={p.id} fill={(profitMode === "USD" ? p.pnl : p.pnlPct) >= 0 ? "#22c55e" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
