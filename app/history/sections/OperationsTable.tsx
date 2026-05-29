"use client";

import type { Dispatch, SetStateAction } from "react";
import type { Operation } from "../types";

interface OperationsTableProps {
  operations: Operation[];
  expanded: boolean;
  setExpanded: Dispatch<SetStateAction<boolean>>;
}

export function OperationsTable({ operations, expanded, setExpanded }: OperationsTableProps) {
  return (
    <div className="card">
      <div className="card-title">История операций</div>
      {operations.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 120, gap: 8, color: "var(--text-muted)" }}>
          <span style={{ fontSize: 12, opacity: 0.6 }}>Нет инструментов в портфеле</span>
        </div>
      ) : (
        <>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                {["Дата", "Тикер", "Действие", "Кол-во", "Цена", "Сумма (USD)"].map(h => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(expanded ? operations : operations.slice(0, 8)).map((o, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "7px 8px", color: "var(--text-secondary)" }}>{o.date}</td>
                  <td style={{ padding: "7px 8px", fontWeight: 700, color: "var(--accent-light)" }}>{o.ticker}</td>
                  <td style={{ padding: "7px 8px" }}>
                    <span className={`badge ${o.action === "Продажа" ? "badge-red" : "badge-green"}`}>{o.action}</span>
                  </td>
                  <td style={{ padding: "7px 8px" }}>{Number(o.qty).toFixed(2)}</td>
                  <td style={{ padding: "7px 8px" }}>{o.price.toFixed(2)}</td>
                  <td style={{ padding: "7px 8px", color: o.sum >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                    {o.sum >= 0 ? "+" : ""}{o.sum.toLocaleString("en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {operations.length > 8 && (
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <button
                onClick={() => setExpanded(o => !o)}
                style={{ background: "none", border: "none", color: "var(--accent-light)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "4px 8px" }}
              >
                {expanded ? "Свернуть ▲" : `Ещё ${operations.length - 8} операций ▼`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
