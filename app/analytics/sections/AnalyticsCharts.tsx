"use client";

import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { periodOptions, CorrelationCell } from "../analytics-shared";

type SectorEntry = { name: string; value: number; color: string };
type CorrelationData = { tickers: string[]; data: number[][] } | null;
type PortfolioPoint = {
  date: string;
  portfolio: number;
  sp500: number;
  nasdaq: number;
  gold: number;
};

type AnalyticsChartsProps = {
  isMobile: boolean;
  period: string;
  setPeriod: (p: string) => void;
  portfolioReturn: string | null;
  portfolioChartData: PortfolioPoint[];
  liveSectorDist: SectorEntry[];
  liveCorrelation: CorrelationData;
  histLoading: boolean;
};

// Row 2: portfolio dynamics line chart + asset allocation pie + correlation matrix
export default function AnalyticsCharts({
  isMobile,
  period,
  setPeriod,
  portfolioReturn,
  portfolioChartData,
  liveSectorDist,
  liveCorrelation,
  histLoading,
}: AnalyticsChartsProps) {
  const lastPoint = portfolioChartData[portfolioChartData.length - 1];
  const benchmarkLegend = [
    { label: "Портфель", color: "#7c3aed", value: portfolioReturn ?? "–" },
    { label: "S&P 500", color: "#22c55e", value: portfolioChartData.length ? `${(lastPoint?.sp500 ?? 0).toFixed(2)}%` : "–" },
    { label: "NASDAQ", color: "#3b82f6", value: portfolioChartData.length ? `${(lastPoint?.nasdaq ?? 0).toFixed(2)}%` : "–" },
    { label: "Золото", color: "#f59e0b", value: portfolioChartData.length ? `${(lastPoint?.gold ?? 0).toFixed(2)}%` : "–" },
  ];

  return (
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
          {benchmarkLegend.map((b) => (
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
  );
}
