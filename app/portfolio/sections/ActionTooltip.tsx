"use client";

import type { LivePosition } from "../types";

interface ActionTooltipProps {
  state: { id: number; x: number; y: number } | null;
  positions: LivePosition[];
}

export function ActionTooltip({ state, positions }: ActionTooltipProps) {
  if (!state) return null;
  const p = positions.find((pos) => pos.id === state.id);
  if (!p) return null;

  const dev = p.share - p.targetShare;
  const actionColor =
    p.action === "ДОКУПИТЬ" ? "#22c55e" :
    p.action === "СОКРАТИТЬ" ? "#ef4444" :
    p.action === "ФИКСИРОВАТЬ" ? "#f59e0b" :
    "var(--accent-light)";

  const reasons: { label: string; value: string; color?: string }[] = [
    {
      label: "P/L позиции",
      value: `${p.pnlPct >= 0 ? "+" : ""}${p.pnlPct.toFixed(2)}% (${p.pnl >= 0 ? "+" : ""}$${p.pnl.toLocaleString("en-US")})`,
      color: p.pnlPct >= 0 ? "#22c55e" : "#ef4444",
    },
    {
      label: "Откл. от цели",
      value: `${p.share.toFixed(2)}% / цель ${p.targetShare.toFixed(2)}% (${dev >= 0 ? "+" : ""}${dev.toFixed(2)}pp)`,
      color: Math.abs(dev) <= 1.5 ? "#22c55e" : dev > 0 ? "#22c55e" : "#ef4444",
    },
  ];
  if (p.avgPrice > 0) {
    reasons.push({
      label: "Цена",
      value: `Тек. $${p.currentPrice.toFixed(2)} / Ср. $${p.avgPrice.toFixed(2)}`,
    });
  }

  const why =
    p.action === "ДОКУПИТЬ"    ? `Позиция недовешена (${dev.toFixed(2)}pp ниже цели). Добавить до целевой доли.` :
    p.action === "СОКРАТИТЬ"   ? `Позиция перевешена (+${dev.toFixed(2)}pp). Частичная продажа восстановит баланс.` :
    p.action === "ФИКСИРОВАТЬ" ? `Значительная прибыль (+${p.pnlPct.toFixed(2)}%). Рекомендуется зафиксировать часть.` :
    `Позиция сбалансирована. Отклонение ${Math.abs(dev).toFixed(2)}pp — в допустимых пределах.`;

  return (
    <div
      style={{
        position: "fixed",
        left: Math.min(state.x, window.innerWidth - 280),
        top: state.y,
        zIndex: 9999,
        background: "var(--bg-card)",
        border: `1px solid ${actionColor}55`,
        borderRadius: 10,
        padding: "10px 14px",
        width: 260,
        boxShadow: `0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px ${actionColor}22`,
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
        <span style={{ fontWeight: 700, fontSize: 12 }}>{p.ticker}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 4, background: `${actionColor}20`, color: actionColor }}>
          {p.action}
        </span>
      </div>

      <div style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 8, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
        {why}
      </div>

      {reasons.map((r) => (
        <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
          <span style={{ color: "var(--text-muted)" }}>{r.label}</span>
          <span style={{ fontWeight: 600, color: r.color ?? "var(--text-primary)" }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}
