"use client";

interface LongTermStrategyProps {
  isMobile: boolean;
}

const STRATEGY_BULLETS = [
  "Рост капитала через качественные компании и ETF",
  "Дивиденды и сложный процент",
  "Защита капитала в кризисы",
  "Реинвестирование прибыли",
  "Финансовая свобода и независимость",
];

export function LongTermStrategy({ isMobile }: LongTermStrategyProps) {
  return (
    <div style={{ padding: isMobile ? "0 12px 12px" : "0 24px 16px" }}>
      <div className="card">
        <div style={{ display: "flex", gap: isMobile ? 12 : 24, flexDirection: isMobile ? "column" : "row" }}>
          <div style={{ flex: 1 }}>
            <div className="card-title">Долгосрочная стратегия</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {STRATEGY_BULLETS.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", marginTop: 5, flexShrink: 0 }} />
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{
            padding: "20px 32px", background: "linear-gradient(135deg, #1a0a3a, #0d0020)", borderRadius: 12,
            textAlign: "center", border: "1px solid var(--border)", position: "relative", overflow: "hidden", minWidth: isMobile ? 0 : 160,
          }}>
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              width: 100, height: 100, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%)",
            }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-light)", letterSpacing: "0.1em", position: "relative" }}>
              ФИНАНСОВАЯ<br />СВОБОДА<br />ТВОЯ ЦЕЛЬ
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
