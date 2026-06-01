"use client";

import {
  AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

type MarketEntry = { market: string; value: number; color: string };
type DrawdownPoint = { date: string; drawdown: number };
type DrawdownStats = { current: number; max: number; avg: number };

type DrawdownSectionProps = {
  isMobile: boolean;
  marketDist: MarketEntry[];
  drawdownData: DrawdownPoint[];
  drawdownStats: DrawdownStats;
};

// Row 5: market distribution bars + drawdown area chart with stat tiles
export default function DrawdownSection({
  isMobile,
  marketDist,
  drawdownData,
  drawdownStats,
}: DrawdownSectionProps) {
  const ddTiles = [
    { label: "Текущая просадка", value: drawdownStats.current !== 0 ? `${drawdownStats.current.toFixed(2)}%` : "0%", color: "#ef4444" },
    { label: "Макс. просадка", value: drawdownStats.max !== 0 ? `${drawdownStats.max.toFixed(2)}%` : "0%", color: "#ef4444" },
    { label: "Средняя просадка", value: `${drawdownStats.avg.toFixed(2)}%`, color: "#f59e0b" },
    { label: "Время восстановления", value: "–", color: "var(--text-primary)" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "0.8fr 1.2fr", gap: 12 }}>
      <div className="card">
        <div className="card-title">Распределение по рынкам</div>
        {marketDist.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>Нет позиций в портфеле</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            {marketDist.map((m) => (
              <div key={m.market}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{m.market}</span>
                  <span style={{ fontWeight: 700 }}>{m.value}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${m.value}%`, background: m.color }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div className="card-title" style={{ margin: 0 }}>Динамика просадки (история)</div>
          <div style={{ display: "flex", gap: 4 }}>
            {["1Г", "2Г", "ВСЕ"].map((p) => (
              <button key={p} className={`tab-btn ${p === "1Г" ? "active" : ""}`} style={{ fontSize: 10, padding: "3px 7px" }}>{p}</button>
            ))}
          </div>
        </div>
        {drawdownData.length > 0 ? (
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={drawdownData}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#555577" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: "#555577" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }} formatter={(v: any) => [`${v.toFixed(2)}%`, "Просадка"]} />
              <Area type="monotone" dataKey="drawdown" stroke="#ef4444" strokeWidth={1.5} fill="url(#ddGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height: 170, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
            Нет истории портфеля для отображения просадки
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
          {ddTiles.map((item) => (
            <div key={item.label} style={{ textAlign: "center", padding: "8px", background: "var(--bg-secondary)", borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
