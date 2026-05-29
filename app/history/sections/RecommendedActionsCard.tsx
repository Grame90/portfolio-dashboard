"use client";

import type { RecommendedAction } from "../types";

interface RecommendedActionsCardProps {
  actions: RecommendedAction[];
  hasPositions: boolean;
}

function actionIcon(action: string): string {
  if (action.startsWith("Снизить"))    return "↓";
  if (action.startsWith("Фиксировать")) return "✓";
  if (action.startsWith("Сократить"))   return "⚠";
  if (action.startsWith("Диверс"))      return "⊕";
  if (action.startsWith("Портфель"))    return "✓";
  return "⚖";
}

export function RecommendedActionsCard({ actions, hasPositions }: RecommendedActionsCardProps) {
  return (
    <div className="card">
      <div className="card-title">Рекомендуемые действия</div>
      {!hasPositions ? (
        <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 12, textAlign: "center" }}>Нет инструментов в портфеле</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {actions.map((r, i) => {
            const icon = actionIcon(r.action);
            const color = r.priority === "Высокий" ? "#ef4444" : r.priority === "Средний" ? "#f59e0b" : "#22c55e";
            return (
              <div key={i} style={{ padding: "8px", background: "var(--bg-secondary)", borderRadius: 8, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontWeight: 700 }}>{icon} {r.action}</span>
                  <span className="badge" style={{ background: `${color}22`, color }}>{r.priority}</span>
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: 11 }}>{r.reason}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
