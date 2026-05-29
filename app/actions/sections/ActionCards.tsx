"use client";

import { actionItems } from "@/lib/mockData";
import { PRIORITY_BG, PRIORITY_COLOR } from "../constants";

interface ActionCardsProps {
  actions: typeof actionItems;
  executed: number[];
  onExecute: (id: number) => void;
  onDismiss: (id: number) => void;
}

export function ActionCards({ actions, executed, onExecute, onDismiss }: ActionCardsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {actions.map((a) => (
        <div key={a.id} className="card" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%", background: a.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700, color: "white", flexShrink: 0,
              }}>
                {a.ticker.slice(0, 2)}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{a.action}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                  {a.ticker} · Срок: {a.deadline}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <span style={{
                padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: PRIORITY_BG[a.priority], color: PRIORITY_COLOR[a.priority],
              }}>{a.priority}</span>
              <span style={{
                padding: "2px 8px", borderRadius: 20, fontSize: 10,
                background: "var(--bg-secondary)", color: "var(--text-secondary)",
              }}>{a.status}</span>
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {a.reason}
          </div>

          {(a.amount > 0 || a.qty > 0) && (
            <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
              {a.amount > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>Сумма</div>
                  <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>${a.amount.toLocaleString("en-US")}</div>
                </div>
              )}
              {a.qty > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>Количество</div>
                  <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{Number(a.qty).toFixed(2)} шт.</div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {executed.includes(a.id) ? (
              <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>✓ Выполнено</div>
            ) : (
              <>
                <button
                  onClick={() => onExecute(a.id)}
                  style={{
                    padding: "6px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 600, background: "var(--accent)", color: "white",
                  }}
                >Выполнить</button>
                <button
                  onClick={() => onDismiss(a.id)}
                  style={{
                    padding: "6px 18px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer",
                    fontSize: 12, fontWeight: 600, background: "transparent", color: "var(--text-secondary)",
                  }}
                >Отложить</button>
              </>
            )}
          </div>
        </div>
      ))}
      {actions.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
          Нет действий в этой категории
        </div>
      )}
    </div>
  );
}
