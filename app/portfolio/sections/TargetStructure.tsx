"use client";

import type { LivePosition } from "../types";

interface TargetStructureProps {
  positions: LivePosition[];
  portfolioTotal: number;
}

export function TargetStructure({ positions, portfolioTotal }: TargetStructureProps) {
  const tickerMap = new Map<string, { value: number; name: string; color: string }>();
  positions.filter(p => p.type !== "Кэш" && p.value >= 10).forEach(p => {
    const ex = tickerMap.get(p.ticker);
    if (ex) ex.value += p.value;
    else tickerMap.set(p.ticker, { value: p.value, name: p.name, color: p.color });
  });
  const mergedTotal = [...tickerMap.values()].reduce((s, v) => s + v.value, 0) || 1;
  const uniqueTickers = [...tickerMap.entries()];
  const eqTarget = uniqueTickers.length > 0 ? parseFloat((100 / uniqueTickers.length).toFixed(2)) : 0;
  const rows = uniqueTickers.map(([ticker, meta]) => {
    const current = (meta.value / mergedTotal) * 100;
    const target = eqTarget;
    const gap = target - current;
    const gapUsd = Math.round((gap / 100) * portfolioTotal);
    const fillPct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
    const isOver  = gap < -1.5;
    const isUnder = gap > 1.5;
    return { id: ticker, ticker, name: meta.name, current, target, gap, gapUsd, fillPct, color: meta.color, isOver, isUnder };
  }).sort((a, b) => b.gap - a.gap);

  const ok    = rows.filter(r => !r.isOver && !r.isUnder).length;
  const under = rows.filter(r => r.isUnder).length;
  const over  = rows.filter(r => r.isOver).length;

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Целевая структура</div>
        <span style={{ fontSize: 9, color: "var(--text-muted)" }}>равновзвешенная</span>
      </div>

      <div style={{ display: "flex", gap: 5, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "rgba(34,197,94,0.12)", color: "#22c55e", fontWeight: 600 }}>✓ {ok} норма</span>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "rgba(59,130,246,0.12)", color: "#3b82f6", fontWeight: 600 }}>↓ {under} докупить</span>
        <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: "rgba(239,68,68,0.12)", color: "#ef4444", fontWeight: 600 }}>↑ {over} перевес</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", maxHeight: 400 }}>
        {rows.map(r => {
          const barColor = r.isOver ? "#ef4444" : r.isUnder ? r.color : "#22c55e";
          const gapColor = r.isOver ? "#ef4444" : r.isUnder ? "#3b82f6" : "#22c55e";
          const gapLabel = r.isOver
            ? `▼ продать $${Math.abs(r.gapUsd).toLocaleString()}`
            : r.isUnder
              ? `+ $${r.gapUsd.toLocaleString()}`
              : "✓";
          return (
            <div key={r.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: r.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{r.ticker}</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{r.name.length > 16 ? r.name.slice(0, 16) + "…" : r.name}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: gapColor }}>{gapLabel}</span>
              </div>

              <div style={{ position: "relative", height: 10, background: "var(--bg-secondary)", borderRadius: 5, overflow: "hidden" }}>
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: `${r.fillPct}%`,
                  background: barColor,
                  opacity: r.isOver ? 0.9 : 0.75,
                  borderRadius: 5,
                  transition: "width 0.5s ease",
                }} />
                {r.isOver && (
                  <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 3, background: "#ef4444", borderRadius: "0 5px 5px 0" }} />
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                <span style={{ fontSize: 9, color: "var(--text-muted)" }}>куплено {r.current.toFixed(1)}%</span>
                <span style={{ fontSize: 9, color: "var(--text-muted)" }}>цель {r.target.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
