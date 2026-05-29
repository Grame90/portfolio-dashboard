"use client";

interface SummaryCardsProps {
  pendingCount: number;
  highCount: number;
  doneCount: number;
  maxDeviation: number;
}

export function SummaryCards({ pendingCount, highCount, doneCount, maxDeviation }: SummaryCardsProps) {
  const cards = [
    { label: "Всего действий",      value: pendingCount,                    sub: "требует внимания" },
    { label: "Высокий приоритет",   value: highCount,                       sub: "срочно",      color: "#ef4444" },
    { label: "Выполнено (всего)",   value: doneCount,                       sub: "операций",    color: "#22c55e" },
    { label: "Отклонение портфеля", value: `${maxDeviation.toFixed(2)}%`,   sub: "от целей",    color: "#f59e0b" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
      {cards.map((m) => (
        <div key={m.label} className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>{m.label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: m.color ?? "var(--text-primary)" }}>{m.value}</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{m.sub}</div>
        </div>
      ))}
    </div>
  );
}
