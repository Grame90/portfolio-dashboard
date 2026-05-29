"use client";

interface PeriodSummaryCardProps {
  liveTotal: number;
  liveCost: number;
  livePnl: number;
  livePnlPct: number;
  dailyChange: number;
  dailyChangePct: number;
  instrumentCount: number;
  assetClassCount: number;
  hasPositions: boolean;
}

export function PeriodSummaryCard({
  liveTotal,
  liveCost,
  livePnl,
  livePnlPct,
  dailyChange,
  dailyChangePct,
  instrumentCount,
  assetClassCount,
  hasPositions,
}: PeriodSummaryCardProps) {
  const items = [
    { label: "Вложено (себестоимость)", value: `${Math.round(liveCost).toLocaleString("en-US")} USD` },
    { label: "Текущий капитал",         value: `${Math.round(liveTotal).toLocaleString("en-US")} USD`, bold: true },
    { label: "P&L",                     value: `${livePnl >= 0 ? "+" : ""}${Math.round(livePnl).toLocaleString("en-US")} USD`, color: livePnl >= 0 ? "#22c55e" : "#ef4444" },
    { label: "P&L (%)",                 value: `${livePnlPct >= 0 ? "+" : ""}${livePnlPct.toFixed(2)}%`, color: livePnlPct >= 0 ? "#22c55e" : "#ef4444" },
    { label: "Инструментов",            value: `${instrumentCount}` },
    { label: "Классов активов",         value: `${assetClassCount}` },
    { label: "Дневное изм.",            value: `${dailyChange >= 0 ? "+" : ""}${Math.round(dailyChange).toLocaleString("en-US")} USD`, color: dailyChange >= 0 ? "#22c55e" : "#ef4444" },
    { label: "Дневное изм. (%)",        value: `${dailyChangePct >= 0 ? "+" : ""}${dailyChangePct.toFixed(2)}%`, color: dailyChangePct >= 0 ? "#22c55e" : "#ef4444" },
  ];

  return (
    <div className="card">
      <div className="card-title">Итоги за период</div>
      {!hasPositions ? (
        <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 16, textAlign: "center" }}>Нет инструментов в портфеле</div>
      ) : (
        items.map(item => (
          <div key={item.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
            <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
            <span style={{ fontWeight: item.bold ? 700 : 600, color: item.color ?? "var(--text-primary)" }}>{item.value}</span>
          </div>
        ))
      )}
    </div>
  );
}
