"use client";

import type { EventItem } from "../types";

interface EventsCardProps {
  events: EventItem[];
  loading: boolean;
}

function kindIconFor(kind: string | undefined): string {
  if (kind === "earnings") return "📊";
  if (kind === "dividend") return "💰";
  return "🏛";
}

export function EventsCard({ events, loading }: EventsCardProps) {
  const now = new Date();

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div className="card-title" style={{ margin: 0 }}>Календарь событий</div>
        {loading
          ? <span style={{ fontSize: 10, color: "var(--text-muted)" }}>загрузка…</span>
          : <span style={{ fontSize: 10, color: "var(--text-muted)" }}>−3 дня / +45 дней</span>
        }
      </div>
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
            <th style={{ padding: "6px 8px", textAlign: "left" }}>Дата</th>
            <th style={{ padding: "6px 8px", textAlign: "left" }}>Событие</th>
            <th style={{ padding: "6px 8px", textAlign: "left" }}>Прогноз</th>
            <th style={{ padding: "6px 8px", textAlign: "left" }}>Исполнено</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => {
            const icon = kindIconFor(e.kind);
            const isPast = e.isoDate ? new Date(e.isoDate) < now : false;
            const hasActual = e.actual != null;
            return (
              <tr key={i} style={{
                borderBottom: "1px solid var(--border)",
                opacity: isPast && !hasActual ? 0.55 : 1,
                background: isPast ? "rgba(255,255,255,0.02)" : "transparent",
              }}>
                <td style={{ padding: "7px 8px", color: isPast ? "var(--text-muted)" : "var(--text-secondary)", whiteSpace: "nowrap" }}>{e.date}</td>
                <td style={{ padding: "7px 8px" }}>
                  <span title={e.kind} style={{ marginRight: 4 }}>{icon}</span>
                  {e.ticker && <span style={{ color: "var(--accent-light)", fontWeight: 700, marginRight: 4 }}>{e.ticker}</span>}
                  <span>{e.event.replace(/^(Отчёт|Дивиденд) \S+ /, "")}</span>
                </td>
                <td style={{ padding: "7px 8px", color: "var(--text-muted)", fontSize: 11 }}>{e.estimate ?? "—"}</td>
                <td style={{ padding: "7px 8px", fontSize: 11, fontWeight: hasActual ? 700 : 400 }}>
                  {hasActual ? <span style={{ color: "#22c55e" }}>{e.actual}</span>
                    : isPast ? <span style={{ color: "var(--text-muted)" }}>ожидается</span>
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
