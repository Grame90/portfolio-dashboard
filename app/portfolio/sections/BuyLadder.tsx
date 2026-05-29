"use client";

import type { Dispatch, SetStateAction } from "react";
import type { LivePosition } from "../types";

interface BuyLadderProps {
  positions: LivePosition[];
  ladderTickers: string[];
  setLadderTickers: Dispatch<SetStateAction<string[]>>;
  ladderStep: number;
  setLadderStep: Dispatch<SetStateAction<number>>;
  ladderLevels: number;
  setLadderLevels: Dispatch<SetStateAction<number>>;
  ladderSaved: boolean;
  setLadderSaved: Dispatch<SetStateAction<boolean>>;
  ladderExpanded: boolean;
  setLadderExpanded: Dispatch<SetStateAction<boolean>>;
}

export function BuyLadder({
  positions,
  ladderTickers,
  setLadderTickers,
  ladderStep,
  setLadderStep,
  ladderLevels,
  setLadderLevels,
  ladderSaved,
  setLadderSaved,
  ladderExpanded,
  setLadderExpanded,
}: BuyLadderProps) {
  const allTickers = positions.filter(p => p.type !== "Кэш" && p.value >= 10);
  const selectedPositions = allTickers.filter(p => ladderTickers.includes(p.ticker));
  const levels = Array.from({ length: ladderLevels }, (_, i) => (i + 1) * ladderStep);

  function saveSettings() {
    try {
      localStorage.setItem("ladder-step", String(ladderStep));
      localStorage.setItem("ladder-levels", String(ladderLevels));
    } catch {}
    setLadderSaved(true);
    setTimeout(() => setLadderSaved(false), 2000);
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Лесенка докупки</div>
        <button
          onClick={() => setLadderExpanded(o => !o)}
          style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
        >
          {ladderExpanded ? "▲ Свернуть" : "⚙ Настройки"}
        </button>
      </div>

      {ladderExpanded && (
        <div style={{ marginBottom: 12, padding: "10px 12px", background: "var(--bg-secondary)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
              Шаг (%):
              <input
                type="number" min={1} max={20} value={ladderStep}
                onChange={(e) => setLadderStep(Number(e.target.value))}
                style={{ width: 52, padding: "3px 6px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }}
              />
            </label>
            <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
              Уровней:
              <input
                type="number" min={1} max={8} value={ladderLevels}
                onChange={(e) => setLadderLevels(Number(e.target.value))}
                style={{ width: 52, padding: "3px 6px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }}
              />
            </label>
            <button
              onClick={saveSettings}
              style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: ladderSaved ? "#22c55e" : "var(--accent)", color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer", transition: "background 0.2s" }}
            >
              {ladderSaved ? "✓ Сохранено" : "Сохранить"}
            </button>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 5 }}>Инструменты:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {allTickers.map(p => (
                <button
                  key={p.id}
                  onClick={() => setLadderTickers(prev => prev.includes(p.ticker) ? prev.filter(t => t !== p.ticker) : [...prev, p.ticker])}
                  style={{
                    padding: "3px 8px", borderRadius: 5,
                    border: `1px solid ${ladderTickers.includes(p.ticker) ? p.color : "var(--border)"}`,
                    background: ladderTickers.includes(p.ticker) ? `${p.color}22` : "transparent",
                    color: ladderTickers.includes(p.ticker) ? p.color : "var(--text-secondary)",
                    fontSize: 10, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  {p.ticker}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "4px 6px", textAlign: "left" }}>Тикер</th>
              <th style={{ padding: "4px 6px", textAlign: "right" }}>Текущая</th>
              {levels.map(l => (
                <th key={l} style={{ padding: "4px 6px", textAlign: "right", color: "#f59e0b" }}>−{l}%</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {selectedPositions.map(p => {
              const current = p.currentPrice || p.avgPrice;
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "6px", fontWeight: 700, color: p.color }}>{p.ticker}</td>
                  <td style={{ padding: "6px", textAlign: "right", fontWeight: 600 }}>{current.toFixed(2)}</td>
                  {levels.map(l => (
                    <td key={l} style={{ padding: "6px", textAlign: "right", color: l <= ladderStep ? "#f59e0b" : "#ef4444" }}>
                      {(current * (1 - l / 100)).toFixed(2)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {selectedPositions.length === 0 && (
              <tr><td colSpan={2 + ladderLevels} style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>Выберите инструменты в настройках</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
