"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { PRIORITY_BG, PRIORITY_COLOR } from "../constants";
import type { DeviationPoint, Recommendation } from "../types";

interface DeviationPanelProps {
  deviationData: DeviationPoint[];
  recommendations: Recommendation[];
  hasPositions: boolean;
}

export function DeviationPanel({ deviationData, recommendations, hasPositions }: DeviationPanelProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="card">
        <div className="card-title">Отклонение от цели</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={deviationData} layout="vertical" barSize={10}>
            <XAxis
              type="number"
              tick={{ fontSize: 9, fill: "#555577" }}
              tickLine={false} axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category" dataKey="ticker"
              tick={{ fontSize: 9, fill: "#aaaacc" }}
              tickLine={false} axisLine={false} width={45}
            />
            <Tooltip
              contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }}
              formatter={(v) => [`${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(2)}%`, "Отклонение"]}
            />
            <Bar dataKey="deviation" radius={[0, 4, 4, 0]}>
              {deviationData.map((d, i) => (
                <Cell key={i} fill={d.deviation >= 0 ? "#ef4444" : "#22c55e"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="card-title">AI-рекомендации</div>
        {recommendations.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 12, padding: "8px 0" }}>
            {!hasPositions ? "Добавьте позиции для получения рекомендаций" : "Портфель в хорошем состоянии — отклонений нет"}
          </div>
        ) : recommendations.map((r, i) => (
          <div
            key={i}
            style={{
              borderBottom: "1px solid var(--border)", padding: "10px 0",
              display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 12 }}>{r.action}</div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{r.reason}</div>
            </div>
            <span style={{
              padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600, flexShrink: 0,
              color: PRIORITY_COLOR[r.priority], background: PRIORITY_BG[r.priority],
            }}>{r.priority}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
