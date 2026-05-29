"use client";

import ApexChart from "@/components/ApexChart";
import { PERIOD_OPTIONS } from "../constants";
import type { LivePosition } from "../types";

interface PeriodMetric {
  usd: number;
  pct: string;
  noData: boolean;
}

interface ChartPoint {
  date: string;
  value: number;
  invested: number;
}

interface StressScenario {
  scenario: string;
  lossUsd: number;
  lossPct: number;
}

interface RecentAction {
  date: string;
  action: string;
}

interface ChartsRowProps {
  isMobile: boolean;
  positions: LivePosition[];
  portfolioTotal: number;
  totalCost: number;
  chartData: ChartPoint[];
  period: string;
  setPeriod: (p: string) => void;
  periodPnl: Record<string, PeriodMetric>;
  liveStressScenarios: StressScenario[];
  recentActions: RecentAction[];
}

const TYPE_COLORS: Record<string, string> = {
  ETF: "#7c3aed",
  Акция: "#3b82f6",
  Крипто: "#f59e0b",
  Сырьё: "#22c55e",
  Кэш: "#94a3b8",
  Облигация: "#06b6d4",
};

export function ChartsRow({
  isMobile,
  positions,
  portfolioTotal,
  totalCost,
  chartData,
  period,
  setPeriod,
  periodPnl,
  liveStressScenarios,
  recentActions,
}: ChartsRowProps) {
  // Asset distribution donut
  const groups: Record<string, { value: number; color: string }> = {};
  positions.filter(p => p.value >= 10).forEach((p) => {
    const val = p.qty * p.currentPrice;
    if (!groups[p.type]) groups[p.type] = { value: 0, color: TYPE_COLORS[p.type] ?? "#9d6ef5" };
    groups[p.type].value += val;
  });
  const total = Object.values(groups).reduce((s, g) => s + g.value, 0) || 1;
  const liveDist = Object.entries(groups).map(([name, g]) => ({
    name,
    value: Math.round((g.value / total) * 100),
    color: g.color,
  }));

  const periodInfo = periodPnl[period];
  const pnlTotal = portfolioTotal - totalCost;

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr 1fr 0.8fr", gap: 12 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>Динамика портфеля</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 700 }}>{portfolioTotal.toLocaleString("en-US")} USD</span>
              {periodInfo.noData ? (
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>нет данных за период</span>
              ) : (
                <span style={{ fontSize: 13, fontWeight: 600, color: periodInfo.usd >= 0 ? "#22c55e" : "#ef4444" }}>
                  {periodInfo.usd >= 0 ? "+" : ""}{periodInfo.usd.toLocaleString("en-US")} ({periodInfo.usd >= 0 ? "+" : ""}{periodInfo.pct}%)
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 2, background: "#7c3aed", display: "inline-block", borderRadius: 2 }} />
                Стоимость портфеля
              </span>
              <span style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 10, height: 2, background: "#f59e0b", display: "inline-block", borderRadius: 2, opacity: 0.8 }} />
                Вложено
              </span>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                P/L: <span style={{ color: pnlTotal >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                  {pnlTotal >= 0 ? "+" : ""}{pnlTotal.toLocaleString("en-US")} USD
                </span>
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 260 }}>
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p}
                className={`tab-btn ${period === p ? "active" : ""}`}
                onClick={() => setPeriod(p)}
              >{p}</button>
            ))}
          </div>
        </div>
        {chartData.length < 2 ? (
          <div style={{ height: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-muted)" }}>
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} opacity={0.4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <span style={{ fontSize: 12, opacity: 0.6 }}>История накапливается — заходи каждый день</span>
            <span style={{ fontSize: 10, opacity: 0.4 }}>Сегодняшняя точка уже сохранена</span>
          </div>
        ) : (
          <ApexChart
            type="area"
            height={185}
            series={[
              { name: "Стоимость", data: chartData.map(d => d.value) },
              { name: "Вложено",   data: chartData.map(d => d.invested) },
            ]}
            options={{
              chart: { type: "area", toolbar: { show: false }, background: "transparent", animations: { enabled: true, speed: 500 } },
              stroke: { curve: "smooth", width: [2, 1.5], dashArray: [0, 5], colors: ["#8b5cf6", "#f59e0b"] },
              fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: [0.3, 0.1], opacityTo: [0, 0], stops: [0, 100] } },
              colors: ["#8b5cf6", "#f59e0b"],
              xaxis: { categories: chartData.map(d => d.date), labels: { style: { fontSize: "9px", colors: "#888" } }, axisBorder: { show: false }, axisTicks: { show: false }, tickAmount: 6 },
              yaxis: { labels: { formatter: (v: number) => `$${(v / 1000).toFixed(0)}K`, style: { fontSize: "9px", colors: "#888" } }, tickAmount: 4 },
              grid: { borderColor: "rgba(255,255,255,0.06)", strokeDashArray: 3, xaxis: { lines: { show: false } }, padding: { left: 0, right: 0 } },
              tooltip: { theme: "dark", y: { formatter: (v: number) => `$${Number(v).toLocaleString("en-US")}` } },
              legend: { show: true, position: "top", horizontalAlign: "right", fontSize: "10px", labels: { colors: "#888" }, markers: { size: 4 } },
              dataLabels: { enabled: false },
              markers: { size: 0, hover: { size: 4 } },
              theme: { mode: "dark" },
            }}
          />
        )}
      </div>

      <div className="card">
        <div className="card-title">Распределение активов</div>
        <ApexChart
          type="donut"
          height={125}
          series={liveDist.map(d => d.value)}
          options={{
            labels: liveDist.map(d => d.name),
            colors: liveDist.map(d => d.color),
            chart: { background: "transparent", animations: { enabled: true, speed: 400 } },
            stroke: { width: 2, colors: ["transparent"] },
            dataLabels: { enabled: false },
            legend: { show: false },
            plotOptions: { pie: { donut: { size: "58%" } } },
            tooltip: { theme: "dark", y: { formatter: (v: number) => `${v}%` } },
            theme: { mode: "dark" },
          }}
        />
        <div style={{ marginTop: 8 }}>
          {liveDist.map((e) => (
            <div key={e.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.color, display: "inline-block" }} />
                <span style={{ color: "var(--text-secondary)" }}>{e.name}</span>
              </span>
              <span style={{ fontWeight: 600 }}>{e.value}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Анализ риска (стресс-сценарии)</div>
        <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "4px 6px", textAlign: "left" }}>Сценарий</th>
              <th style={{ padding: "4px 6px", textAlign: "right" }}>Падение</th>
              <th style={{ padding: "4px 6px", textAlign: "right" }}>Просадка</th>
            </tr>
          </thead>
          <tbody>
            {liveStressScenarios.map((s) => (
              <tr key={s.scenario} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "6px", color: "var(--text-secondary)" }}>{s.scenario.split("(")[0].trim()}</td>
                <td style={{ padding: "6px", textAlign: "right", color: s.lossUsd >= 0 ? "#22c55e" : "#ef4444" }}>
                  {s.lossUsd >= 0 ? "+" : ""}{(s.lossUsd / 1000).toFixed(0)}K
                </td>
                <td style={{ padding: "6px", textAlign: "right", color: s.lossPct >= 0 ? "#22c55e" : "#ef4444" }}>
                  {s.lossPct >= 0 ? "+" : ""}{s.lossPct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Последние действия</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {recentActions.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: "8px 0" }}>
              Нет записей.<br />Используйте «Фиксировать» в шапке.
            </div>
          ) : recentActions.map((a) => (
            <div key={a.date} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", marginTop: 4, flexShrink: 0 }} />
              <div>
                <div style={{ color: "var(--text-secondary)", fontSize: 10 }}>{a.date}</div>
                <div>{a.action}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
