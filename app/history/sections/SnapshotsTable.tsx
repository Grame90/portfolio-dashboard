"use client";

import type { Dispatch, SetStateAction } from "react";
import type { Snapshot } from "../types";

interface SnapshotsTableProps {
  snapshots: Snapshot[];
  expanded: boolean;
  setExpanded: Dispatch<SetStateAction<boolean>>;
}

export function SnapshotsTable({ snapshots, expanded, setExpanded }: SnapshotsTableProps) {
  return (
    <div className="card">
      <div className="card-title">История фиксаций</div>
      {snapshots.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 120, gap: 8, color: "var(--text-muted)" }}>
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.3} opacity={0.4}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span style={{ fontSize: 12, opacity: 0.6 }}>Фиксаций ещё не было</span>
          <span style={{ fontSize: 11, opacity: 0.4, textAlign: "center" }}>Нажмите «Зафиксировать портфель» вверху страницы</span>
        </div>
      ) : (
        <>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                {["Дата", "Время", "Капитал", "P&L", "Вложено", "Доходн.", "Комментарий"].map(h => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(expanded ? snapshots : snapshots.slice(0, 8)).map((s, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "7px 8px" }}>{s.date}</td>
                  <td style={{ padding: "7px 8px", color: "var(--text-secondary)" }}>{s.time}</td>
                  <td style={{ padding: "7px 8px", fontWeight: 700 }}>{s.capital.toLocaleString("en-US")}</td>
                  <td style={{ padding: "7px 8px", color: s.profit >= 0 ? "#22c55e" : "#ef4444" }}>
                    {s.profit >= 0 ? "+" : ""}{s.profit.toLocaleString("en-US")}
                  </td>
                  <td style={{ padding: "7px 8px", color: "var(--text-secondary)" }}>{s.cost.toLocaleString("en-US")}</td>
                  <td style={{ padding: "7px 8px", color: "#22c55e", fontWeight: 700 }}>{s.profitPct}</td>
                  <td style={{ padding: "7px 8px", color: "var(--text-secondary)", fontSize: 11 }}>{s.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {snapshots.length > 8 && (
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <button
                onClick={() => setExpanded(o => !o)}
                style={{ background: "none", border: "none", color: "var(--accent-light)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "4px 8px" }}
              >
                {expanded ? "Свернуть ▲" : `Ещё ${snapshots.length - 8} записей ▼`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
