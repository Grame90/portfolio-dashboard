"use client";

import type { RebalanceItem } from "../types";

interface RebalancePlanCardProps {
  plan: RebalanceItem[];
  hasPositions: boolean;
}

export function RebalancePlanCard({ plan, hasPositions }: RebalancePlanCardProps) {
  return (
    <div className="card">
      <div className="card-title">План ребалансировки</div>
      {plan.length === 0 ? (
        <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 12 }}>
          {!hasPositions
            ? "Нет инструментов в портфеле"
            : "Целевая структура не задана. Настройте её на странице Действия."}
        </div>
      ) : (
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
              {["Действие", "Отклонение", "Цель", "К сроку"].map(h => (
                <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plan.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "7px 8px", fontWeight: 600 }}>{r.action}</td>
                <td style={{ padding: "7px 8px", color: parseFloat(r.deviation) >= 0 ? "#ef4444" : "#22c55e", fontWeight: 700 }}>{r.deviation}</td>
                <td style={{ padding: "7px 8px", color: "var(--text-secondary)" }}>{r.target}</td>
                <td style={{ padding: "7px 8px", color: "var(--text-muted)", fontSize: 11 }}>{r.deadline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
