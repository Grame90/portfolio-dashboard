"use client";

// Diary "Аналитика" tab. Placeholder for now — will host charts and
// weekly/monthly aggregates after the core daily flow is stable.

import { computeEntryMetrics } from "@/lib/diary/compute";
import type {
  CapitalEvent,
  DiaryBroker,
  DiaryEntry,
  StrategyConfig,
} from "@/lib/diary/types";

export type AnalyticsViewProps = {
  entries: DiaryEntry[];
  brokers: DiaryBroker[];
  cfg: StrategyConfig;
  events: CapitalEvent[];
};

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ru-RU", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export default function AnalyticsView({ entries, brokers, cfg, events }: AnalyticsViewProps) {
  if (entries.length === 0) {
    return (
      <div
        style={{
          padding: "48px 24px",
          textAlign: "center",
          background: "var(--bg-card)",
          border: "1px dashed var(--border)",
          borderRadius: 12,
          color: "var(--text-muted)",
          fontSize: 13,
        }}
      >
        Аналитика появится после того, как в журнале накопятся записи.
      </div>
    );
  }

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const firstM = computeEntryMetrics({ entry: first, brokers, cfg, events });
  const lastM = computeEntryMetrics({ entry: last, brokers, cfg, events });
  const totalDelta = lastM.totalUsd - firstM.totalUsd;
  const totalDeltaPct = firstM.totalUsd > 0 ? (totalDelta / firstM.totalUsd) * 100 : 0;
  const transfersSum = entries.reduce((s, e) => s + (e.transfersUsd ?? 0), 0);
  // Доходность = Total ÷ Инвестировано (положение на последнюю дату) × 100.
  const returnPct =
    lastM.positionInvested > 0 ? (lastM.totalUsd / lastM.positionInvested) * 100 : 0;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Kpi label="Total сейчас" primary={fmtUsd(lastM.totalUsd)} secondary={`на ${lastM.date}`} />
        <Kpi
          label="Изменение Total"
          primary={`${totalDelta >= 0 ? "+" : ""}${fmtUsd(Math.abs(totalDelta))}`}
          secondary={fmtPct(totalDeltaPct)}
          accent={totalDelta >= 0 ? "#22c55e" : "#ef4444"}
        />
        <Kpi
          label="Доходность от базы"
          primary={`${returnPct.toFixed(1)}%`}
          secondary={`Инвестировано ${fmtUsd(lastM.positionInvested)}`}
          accent={returnPct >= 100 ? "#22c55e" : "#ef4444"}
        />
        <Kpi
          label="Сумма переводов"
          primary={`${transfersSum >= 0 ? "+" : "−"}${fmtUsd(Math.abs(transfersSum))}`}
          secondary={`за ${entries.length} дн.`}
          accent={transfersSum >= 0 ? "#22c55e" : "#ef4444"}
        />
      </section>

      <section
        style={{
          padding: "20px 24px",
          textAlign: "center",
          background: "var(--bg-card)",
          border: "1px dashed var(--border)",
          borderRadius: 12,
          color: "var(--text-muted)",
          fontSize: 13,
        }}
      >
        Графики и недельные/месячные сводки — в следующей итерации.
      </section>
    </div>
  );
}

function Kpi({
  label,
  primary,
  secondary,
  accent,
}: {
  label: string;
  primary: string;
  secondary?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent ?? "var(--text-primary)" }}>{primary}</div>
      {secondary && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{secondary}</div>
      )}
    </div>
  );
}
