"use client";

import { CASH_FLOW_PERIODS } from "../constants";
import type { CashFlowData } from "../types";

interface CashFlowCardProps {
  data: CashFlowData;
  period: string;
  onPeriodChange: (p: string) => void;
}

export function CashFlowCard({ data, period, onPeriodChange }: CashFlowCardProps) {
  const items = [
    { label: "Вложено",             value: data.deposits,    color: "#22c55e" },
    { label: "Выводы",              value: data.withdrawals, color: "#ef4444" },
    { label: "Фиксации прибыли",    value: data.fixedProfit, color: "#22c55e" },
    { label: "Реинвестировано",     value: data.reinvested,  color: "#ef4444" },
    { label: "Нереализованный P&L", value: data.netFlow,     color: data.netFlow >= 0 ? "#22c55e" : "#ef4444", bold: true },
  ];

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div className="card-title" style={{ margin: 0 }}>Денежные потоки</div>
        <div style={{ display: "flex", gap: 4 }}>
          {CASH_FLOW_PERIODS.map(p => (
            <button
              key={p}
              className={`tab-btn ${period === p ? "active" : ""}`}
              onClick={() => onPeriodChange(p)}
              style={{ fontSize: 10, padding: "2px 5px" }}
            >{p}</button>
          ))}
        </div>
      </div>
      {items.map(item => (
        <div
          key={item.label}
          style={{
            display: "flex", justifyContent: "space-between",
            fontSize: 12, marginBottom: 8,
            borderBottom: item.bold ? "none" : "1px solid var(--border)",
            paddingBottom: 6,
          }}
        >
          <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
          <span style={{ fontWeight: item.bold ? 700 : 600, color: item.color }}>
            {item.value >= 0 ? "+" : ""}{item.value.toLocaleString("en-US")}
          </span>
        </div>
      ))}
    </div>
  );
}
