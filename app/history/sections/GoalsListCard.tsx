"use client";

import type { Goal } from "../types";

interface GoalsListCardProps {
  goals: Goal[];
}

function badgeClass(status: string): string {
  if (status === "Достигнута" || status === "Завершён") return "badge-green";
  if (status === "Убыток") return "badge-red";
  return "badge-blue";
}

export function GoalsListCard({ goals }: GoalsListCardProps) {
  return (
    <div className="card">
      <div className="card-title">Цели и планы</div>
      {goals.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 12, textAlign: "center" }}>
          Добавьте инструменты и настройте цели в Настройках
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {goals.map(g => (
            <div key={g.goal}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: "var(--text-primary)", fontSize: 11, fontWeight: 600 }}>{g.goal}</span>
                <span className={`badge ${badgeClass(g.status)}`}>{g.status}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4, color: "var(--text-muted)" }}>
                <span>{g.detail}</span>
                <span style={{ fontWeight: 700, color: g.color }}>{g.pct}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${g.pct}%`, background: g.color }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
