"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { Position } from "../types";

interface PortfolioStructureProps {
  positions: Position[];
  byValue: Position[];
}

export function PortfolioStructure({ positions, byValue }: PortfolioStructureProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="card">
        <div className="card-title">Структура портфеля</div>
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie
              data={positions.map(p => ({ name: p.ticker, value: p.share }))}
              dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={65}
            >
              {positions.map((p) => <Cell key={p.id} fill={p.color} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }}
              formatter={(v) => [`${Number(v).toFixed(2)}%`]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, marginTop: 4, maxHeight: 120, overflowY: "auto" }}>
          {positions.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.color, display: "inline-block", flexShrink: 0 }} />
              <span style={{ color: "var(--text-secondary)" }}>{p.ticker}</span>
              <span style={{ marginLeft: "auto", fontWeight: 600 }}>{p.share.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Топ по стоимости</div>
        {byValue.map((p, i) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12 }}>
            <span style={{ color: "var(--text-muted)", width: 14 }}>{i + 1}</span>
            <span style={{ fontWeight: 700, width: 50 }}>{p.ticker}</span>
            <div className="progress-bar" style={{ flex: 1 }}>
              <div className="progress-fill" style={{ width: `${(p.value / byValue[0].value) * 100}%`, background: p.color }} />
            </div>
            <span style={{ width: 55, textAlign: "right", fontSize: 11 }}>{p.value.toLocaleString("en-US")}</span>
            <span style={{ width: 38, textAlign: "right", color: "var(--text-secondary)", fontSize: 11 }}>{p.share.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
