"use client";

type MetricsRowProps = {
  isMobile: boolean;
  totalPnl: number;
  totalPnlPct: number;
  histLoading: boolean;
  liveVol30d: string;
  analyticsMetrics: { volatility: string; sharpe: string; maxDrawdown: string } | null;
  drawdownStatsMax: number;
  weightedBeta: number;
  betaSub: string;
  spyCorrelation: number;
};

// Top 7-card KPI strip (Общая прибыль / YTD / Vol / Sharpe / MaxDD / Beta / Corr S&P)
export default function MetricsRow({
  isMobile,
  totalPnl,
  totalPnlPct,
  histLoading,
  liveVol30d,
  analyticsMetrics,
  drawdownStatsMax,
  weightedBeta,
  betaSub,
  spyCorrelation,
}: MetricsRowProps) {
  const metrics = [
    { label: "Общая прибыль (USD)", value: `${totalPnl >= 0 ? "+" : ""}${Math.round(totalPnl).toLocaleString("en-US")}`, sub: `${totalPnlPct.toFixed(2)}%`, color: totalPnl >= 0 ? "#22c55e" : "#ef4444" },
    { label: "Средняя доходность (YTD)", value: `${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}%`, color: totalPnlPct >= 0 ? "#22c55e" : "#ef4444" },
    { label: "Волатильность портфеля", value: histLoading ? "…" : `${liveVol30d}%`, sub: "Умеренная", color: "#f59e0b" },
    { label: "Коэффициент Шарпа", value: histLoading ? "…" : (analyticsMetrics?.sharpe ?? "–"), sub: "Хороший", color: "#22c55e" },
    { label: "Макс. просадка (истор.)", value: histLoading ? "…" : `${analyticsMetrics?.maxDrawdown ?? drawdownStatsMax.toFixed(2)}%`, sub: "Умеренная", color: "#ef4444" },
    { label: "Бета (рынок)", value: weightedBeta.toFixed(2), sub: betaSub },
    { label: "Корреляция с S&P 500", value: spyCorrelation.toString(), sub: spyCorrelation >= 0.75 ? "Высокая" : spyCorrelation >= 0.5 ? "Средняя" : "Низкая", color: "#f59e0b" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(7, 1fr)", gap: 10 }}>
      {metrics.map((m) => (
        <div key={m.label} className="card" style={{ padding: 12 }}>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>{m.label}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.value}</div>
          {m.sub && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{m.sub}</div>}
        </div>
      ))}
    </div>
  );
}
