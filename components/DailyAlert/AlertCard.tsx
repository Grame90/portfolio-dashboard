"use client";

import { useState, useEffect } from "react";
import { dismissToday, isDismissed } from "./utils";
import { usePortfolioRisk } from "./usePortfolioRisk";
import type { AlertLevel } from "./types";

const COLORS: Record<AlertLevel, { bg: string; border: string; dot: string; label: string }> = {
  green:  { bg: "rgba(34,197,94,0.07)",  border: "#22c55e44", dot: "#22c55e", label: "СТАБИЛЬНО" },
  yellow: { bg: "rgba(245,158,11,0.08)", border: "#f59e0b55", dot: "#f59e0b", label: "ВНИМАНИЕ"  },
  red:    { bg: "rgba(239,68,68,0.08)",  border: "#ef444455", dot: "#ef4444", label: "КРИЗИС"    },
};

export default function AlertCard() {
  const risk = usePortfolioRisk();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setVisible(!isDismissed());
  }, []);

  if (!mounted || !visible) return null;

  const c = COLORS[risk.level];
  const alerts = risk.indicators.filter(i => i.level !== "green");

  const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const timeStr = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 12,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      position: "relative",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%", background: c.dot,
            boxShadow: `0 0 8px ${c.dot}`, flexShrink: 0,
            animation: risk.level !== "green" ? "pulse 1.8s infinite" : undefined,
          }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: c.dot }}>
            КРИЗИС-АЛЕРТ
          </span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: c.dot, color: "white" }}>
            {c.label}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {today}, {timeStr}
          </span>
        </div>

        <button
          onClick={() => { dismissToday(); setVisible(false); }}
          title="Скрыть до завтра"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", fontSize: 18, lineHeight: 1, padding: "0 4px",
          }}
        >×</button>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: c.dot }}>{risk.summary}</div>

      {alerts.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {alerts.map((a) => {
            const icon = a.level === "red" ? "🔴" : "🟡";
            return (
              <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                <span style={{ flexShrink: 0 }}>{icon}</span>
                <span>{a.label}: {a.value} — {a.note}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          ✅ Все триггеры в норме — нарушений не обнаружено
        </div>
      )}

      <div style={{ height: 1, background: c.border }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Рекомендации
        </div>
        {risk.recommendations.map((r, i) => (
          <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 6 }}>
            <span style={{ color: c.dot, flexShrink: 0 }}>→</span>
            <span>{r.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
