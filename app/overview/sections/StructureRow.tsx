"use client";

export interface TargetRow {
  id: number;
  ticker: string;
  liveShare: number;
  target: number;
  deviation: number;
}

export interface RebalanceCondition {
  label: string;
  checked: boolean;
}

export interface NextRebalance {
  period: string;
  date: string;
  daysLeft: number;
}

export interface HistoryStats {
  bestDay: string | number;
  worstDay: string | number;
  avgDailyReturn: string | number;
  positiveDays: number | string;
  profitRiskRatio: string | number;
  tradingDays: number;
}

interface StructureRowProps {
  isMobile: boolean;
  targetRows: TargetRow[];
  nextRebalance: NextRebalance;
  rebalanceConditions: RebalanceCondition[];
  totalPnl: number;
  totalPnlPct: number;
  periodPerfYear: { value: number; pct: number } | null;
  historyStats: HistoryStats | null;
  historyLength: number;
}

export function StructureRow({
  isMobile,
  targetRows,
  nextRebalance,
  rebalanceConditions,
  totalPnl,
  totalPnlPct,
  periodPerfYear,
  historyStats,
  historyLength,
}: StructureRowProps) {
  const summary = [
    { label: "Общая прибыль (USD)",         value: `${totalPnl >= 0 ? "+" : ""}${Math.round(totalPnl).toLocaleString("en-US")}`, color: totalPnl >= 0 ? "#22c55e" : "#ef4444" },
    { label: "Общая прибыль (%)",           value: `${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}%`, color: totalPnlPct >= 0 ? "#22c55e" : "#ef4444" },
    { label: "Доходность (YTD)",            value: periodPerfYear ? `${periodPerfYear.pct >= 0 ? "+" : ""}${Math.abs(periodPerfYear.pct).toFixed(2)}%` : "—", color: periodPerfYear && periodPerfYear.pct >= 0 ? "#22c55e" : "#ef4444" },
    { label: "Лучший день",                 value: historyStats ? `+${historyStats.bestDay}%` : "—", color: "#22c55e" },
    { label: "Худший день",                 value: historyStats ? `${historyStats.worstDay}%` : "—", color: "#ef4444" },
    { label: "Средняя дневная",             value: historyStats ? `${Number(historyStats.avgDailyReturn) >= 0 ? "+" : ""}${historyStats.avgDailyReturn}%` : "—", color: historyStats && Number(historyStats.avgDailyReturn) >= 0 ? "#22c55e" : "#ef4444" },
    { label: "Положительных дней",          value: historyStats ? `${historyStats.positiveDays}%` : "—" },
    { label: "Коэффициент прибыль/риск",    value: historyStats ? historyStats.profitRiskRatio : "—" },
    { label: "Торговых дней",               value: historyStats ? historyStats.tradingDays.toString() : historyLength > 0 ? historyLength.toString() : "—" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 0.8fr 1fr", gap: 12 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="card-title" style={{ margin: 0 }}>Текущая структура VS целевая</div>
          <span style={{ fontSize: 9, color: "var(--text-muted)" }}>равновзвешенная</span>
        </div>
        {targetRows.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Нет позиций в портфеле</div>
        ) : (
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                {["Инструмент", "Текущая доля", "Целевая доля", "Отклонение", "Статус"].map((h) => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {targetRows.map((t) => {
                const status = t.deviation > 1.5 ? "Перевес" : t.deviation < -1.5 ? "Недовес" : "Норма";
                return (
                  <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px 8px", fontWeight: 600 }}>{t.ticker}</td>
                    <td style={{ padding: "6px 8px" }}>{t.liveShare.toFixed(2)}%</td>
                    <td style={{ padding: "6px 8px", color: "var(--text-secondary)" }}>{t.target.toFixed(2)}%</td>
                    <td style={{ padding: "6px 8px", color: t.deviation >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                      {t.deviation >= 0 ? "+" : ""}{t.deviation.toFixed(2)}%
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      <span className={`badge ${status === "Недовес" ? "badge-red" : status === "Перевес" ? "badge-purple" : "badge-green"}`}>
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="card-title">Следующий ребаланс</div>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>{nextRebalance.period}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent-light)" }}>{nextRebalance.date}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {nextRebalance.daysLeft === 0 ? "Сегодня" : `Через ${nextRebalance.daysLeft} дн.`}
          </div>
        </div>
        <div className="card-title">Условия для ребаланса</div>
        {rebalanceConditions.map((c) => (
          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12 }}>
            <div style={{
              width: 14, height: 14, borderRadius: 3, border: "1px solid var(--border)",
              background: c.checked ? "#22c55e" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {c.checked && <span style={{ color: "#fff", fontSize: 9, lineHeight: 1, display: "block" }}>✓</span>}
            </div>
            <span style={{ color: c.checked ? "var(--text-primary)" : "var(--text-secondary)" }}>{c.label}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Итоговая статистика</div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10 }}>
          {summary.map((item) => (
            <div key={item.label} style={{ padding: "8px", background: "var(--bg-secondary)", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: item.color ?? "var(--text-primary)" }}>{item.value}</div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
