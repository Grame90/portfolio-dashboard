"use client";

import ApexChart from "@/components/ApexChart";
import { HIST_PERIODS, type HistPeriod } from "../constants";

interface CapitalDynamicsCardProps {
  liveTotal: number;
  livePnl: number;
  livePnlPct: number;
  liveCost: number;
  dailyChangePct: number;
  instrumentCount: number;
  chartData: { date: string; value: number }[];
  histPeriod: HistPeriod;
  onPeriodChange: (p: HistPeriod) => void;
}

export function CapitalDynamicsCard({
  liveTotal,
  livePnl,
  livePnlPct,
  liveCost,
  dailyChangePct,
  instrumentCount,
  chartData,
  histPeriod,
  onPeriodChange,
}: CapitalDynamicsCardProps) {
  const bottomStats = [
    { label: "Вложено",   value: liveCost > 0 ? `$${Math.round(liveCost).toLocaleString("en-US")}` : "—" },
    { label: "P&L",        value: liveCost > 0 ? `${livePnl >= 0 ? "+" : ""}${Math.round(livePnl).toLocaleString("en-US")}` : "—", neg: livePnl < 0, pos: livePnl > 0 },
    { label: "Дн. изм.",   value: liveCost > 0 ? `${dailyChangePct >= 0 ? "+" : ""}${dailyChangePct.toFixed(2)}%` : "—", neg: dailyChangePct < 0, pos: dailyChangePct > 0 },
    { label: "Инструм.",   value: `${instrumentCount}` },
  ];

  return (
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
          {HIST_PERIODS.map(p => (
            <button key={p} onClick={() => onPeriodChange(p)} style={{
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
        {bottomStats.map(s => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: s.neg ? "#ef4444" : s.pos ? "#22c55e" : "var(--text-primary)" }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
