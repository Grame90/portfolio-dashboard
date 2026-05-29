"use client";

import type { Position } from "../types";

interface DeleteConfirmDialogProps {
  target: Position | null;
  onClose: () => void;
  onConfirm: (id: number) => void;
}

export function DeleteConfirmDialog({ target, onClose, onConfirm }: DeleteConfirmDialogProps) {
  if (!target) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 14, padding: "28px 32px", width: 360,
          boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
          animation: "fadeIn 0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%", background: target.color,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "white", flexShrink: 0,
          }}>
            {target.ticker.slice(0, 2)}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{target.ticker}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{target.name}</div>
          </div>
        </div>

        <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 8 }}>
          Удалить эту позицию из портфеля?
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 20, padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: 8, fontSize: 12, color: "var(--text-secondary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Количество</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{target.qty > 0 ? target.qty.toFixed(2) : "–"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Стоимость</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>${target.value.toLocaleString("en-US")}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>P/L</span>
            <span style={{ fontWeight: 600, color: target.pnl >= 0 ? "#22c55e" : "#ef4444" }}>
              {target.pnl >= 0 ? "+" : ""}{target.pnl.toLocaleString("en-US")} USD
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "10px", borderRadius: 8, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
            }}
          >
            Отмена
          </button>
          <button
            onClick={() => onConfirm(target.id)}
            style={{
              flex: 1, padding: "10px", borderRadius: 8, border: "none",
              background: "#ef4444", color: "white", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
            }}
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}
