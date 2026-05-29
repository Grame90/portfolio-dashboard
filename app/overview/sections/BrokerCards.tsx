"use client";

export interface BrokerStat {
  name: string;
  total: number;
  count: number;
  pnl: number;
  pnlPct: number;
  share: number;
  dailyChange: number;
  dailyChangePct: number;
}

interface BrokerCardsProps {
  brokerStats: BrokerStat[];
  isMobile: boolean;
}

const BCOLORS = [
  "#7c3aed", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#f97316", "#a855f7", "#84cc16",
];

function brokerColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return BCOLORS[Math.abs(h) % BCOLORS.length];
}

export function BrokerCards({ brokerStats, isMobile }: BrokerCardsProps) {
  if (brokerStats.length === 0) return null;

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Портфели по брокерам
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : `repeat(${Math.min(brokerStats.length, 4)}, 1fr)`, gap: 10 }}>
        {brokerStats.map(b => {
          const color = brokerColor(b.name);
          return (
            <div key={b.name} className="card" style={{ borderLeft: `3px solid ${color}`, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
                <div style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)" }}>{b.count} поз.</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>${b.total.toLocaleString("en-US")}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <div className={b.pnl >= 0 ? "positive" : "negative"} style={{ fontSize: 12, fontWeight: 600 }}>
                  {b.pnl >= 0 ? "+" : ""}{b.pnl.toLocaleString("en-US")} ({b.pnlPct >= 0 ? "+" : ""}{b.pnlPct.toFixed(2)}%)
                </div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{b.share.toFixed(1)}% портфеля</div>
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: b.dailyChange >= 0 ? "#22c55e" : "#ef4444" }}>
                День: {b.dailyChange >= 0 ? "+" : ""}{b.dailyChange.toLocaleString("en-US")} ({b.dailyChangePct >= 0 ? "+" : ""}{b.dailyChangePct.toFixed(2)}%)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
