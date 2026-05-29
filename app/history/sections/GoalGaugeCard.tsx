"use client";

interface GoalGaugeCardProps {
  liveTotal: number;
  targetAmount: number;
}

export function GoalGaugeCard({ liveTotal, targetAmount }: GoalGaugeCardProps) {
  const target = targetAmount || 400000;
  const pct = Math.min(100, Math.round((liveTotal / target) * 100));
  const remaining = Math.max(0, target - liveTotal);
  const r = 50;
  const circ = 2 * Math.PI * r;

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div className="card-title">Следующая цель</div>
      <div style={{ position: "relative", width: 120, height: 120 }}>
        <svg viewBox="0 0 120 120" width={120} height={120}>
          <circle cx={60} cy={60} r={r} fill="none" stroke="var(--border)" strokeWidth={10} />
          <circle
            cx={60} cy={60} r={r} fill="none" stroke="#7c3aed" strokeWidth={10}
            strokeDasharray={`${circ * pct / 100} ${circ * (1 - pct / 100)}`}
            strokeDashoffset={circ * 0.25} strokeLinecap="round"
          />
          <text x={60} y={55} textAnchor="middle" style={{ fill: "var(--text-primary)" }} fontSize={22} fontWeight={700}>{pct}%</text>
        </svg>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "center", marginTop: 8 }}>
        Цель: {target.toLocaleString("en-US")} USD<br />Осталось: {Math.round(remaining).toLocaleString("en-US")} USD
      </div>
    </div>
  );
}
