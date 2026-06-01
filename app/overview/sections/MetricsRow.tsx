"use client";

import type { StoredPosition } from "@/lib/types";
import type { BrokerStat } from "./BrokerCards";

interface PeriodValue {
  value: number;
  pct: number;
}

interface PeriodPerf {
  week: PeriodValue | null;
  month: PeriodValue | null;
  year: PeriodValue | null;
  ytd: PeriodValue | null;
}

export type PeriodKey = "week" | "month" | "year" | "ytd" | "allTime";

export type BrokerPeriodPerf = Record<string, Partial<Record<PeriodKey, PeriodValue | null>>>;

interface MetricsRowProps {
  livePortfolioTotal: number;
  liveDailyChange: number;
  liveDailyChangePct: number;
  periodPerf: PeriodPerf;
  positions: StoredPosition[];
  brokerStats: BrokerStat[];
  brokerPeriodPerf: BrokerPeriodPerf;
  totalPnl: number;
  totalPnlPct: number;
}

interface BrokerRowProps {
  name: string;
  value: number;
  pct: number;
}

function fmtCompactSigned(n: number): string {
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "−";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 1000)}K`;
  return `${sign}${Math.round(abs).toLocaleString("en-US")}`;
}

function BrokerRow({ name, value, pct }: BrokerRowProps) {
  const color = value >= 0 ? "#22c55e" : "#ef4444";
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      gap: 6, minWidth: 0, overflow: "hidden",
    }}>
      <span
        title={name}
        style={{
          color: "var(--text-secondary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: "1 1 auto",
          minWidth: 0,
        }}
      >
        {name}
      </span>
      <span style={{
        fontWeight: 600, color, fontVariantNumeric: "tabular-nums",
        flexShrink: 0, whiteSpace: "nowrap",
      }}>
        {fmtCompactSigned(value)}
        <span style={{ fontSize: 9, marginLeft: 3, opacity: 0.85 }}>
          ({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)
        </span>
      </span>
    </div>
  );
}

export function MetricsRow({
  livePortfolioTotal,
  liveDailyChange,
  liveDailyChangePct,
  periodPerf,
  positions,
  brokerStats,
  brokerPeriodPerf,
  totalPnl,
  totalPnlPct,
}: MetricsRowProps) {
  const cashPos = positions.filter(p => p.type === "Кэш");
  const totalCashUsd = cashPos.reduce((s, p) => s + p.qty * p.avgPrice, 0);
  const cashPct = livePortfolioTotal > 0 ? (totalCashUsd / livePortfolioTotal) * 100 : 0;

  const periodCards: { label: string; key: PeriodKey; d: PeriodValue | null }[] = [
    { label: "Неделя",        key: "week",    d: periodPerf.week },
    { label: "Месяц",         key: "month",   d: periodPerf.month },
    { label: "С начала года", key: "ytd",     d: periodPerf.ytd },
    { label: "Всё время",     key: "allTime", d: { value: Math.round(totalPnl), pct: totalPnlPct } },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 10 }}>
      <div className="card" style={{ borderLeft: "3px solid var(--accent)", background: "linear-gradient(135deg, var(--bg-card-hover), var(--bg-card))" }}>
        <div className="card-title">Общая стоимость портфеля</div>
        <div style={{ fontSize: 32, fontWeight: 700 }}>{Math.round(livePortfolioTotal).toLocaleString("ru-RU")}</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>USD</div>
        <div className={liveDailyChange >= 0 ? "positive" : "negative"} style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
          {liveDailyChange >= 0 ? "+" : ""}{Math.round(Math.abs(liveDailyChange)).toLocaleString("en-US")} ({Math.abs(liveDailyChangePct).toFixed(2)}%)
        </div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>Изменение за день</div>
      </div>

      <div className="card">
        <div className="card-title">День</div>
        <div className={liveDailyChange >= 0 ? "positive" : "negative"} style={{ fontSize: 22, fontWeight: 700 }}>
          {liveDailyChange >= 0 ? "+" : ""}{Math.round(Math.abs(liveDailyChange)).toLocaleString("en-US")}
        </div>
        <div className={liveDailyChange >= 0 ? "positive" : "negative"} style={{ fontSize: 14 }}>
          {liveDailyChange >= 0 ? "+" : ""}{liveDailyChangePct.toFixed(2)}%
        </div>
        {brokerStats.length > 0 && (
          <div style={{
            display: "flex", flexDirection: "column", gap: 4, fontSize: 11,
            borderTop: "1px solid var(--border)", paddingTop: 6, marginTop: 8,
          }}>
            {brokerStats.map(b => (
              <BrokerRow key={b.name} name={b.name} value={b.dailyChange} pct={b.dailyChangePct} />
            ))}
          </div>
        )}
      </div>

      {periodCards.map(({ label, key, d }) => (
        <div key={label} className="card">
          <div className="card-title">{label}</div>
          {d == null ? (
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-muted)" }}>—</div>
          ) : (
            <>
              <div className={d.value >= 0 ? "positive" : "negative"} style={{ fontSize: 22, fontWeight: 700 }}>
                {d.value >= 0 ? "+" : ""}{Math.round(Math.abs(d.value)).toLocaleString("en-US")}
              </div>
              <div className={d.value >= 0 ? "positive" : "negative"} style={{ fontSize: 14 }}>
                {d.pct >= 0 ? "+" : ""}{Math.abs(d.pct).toFixed(2)}%
              </div>
            </>
          )}
          {brokerStats.length > 0 && (
            <div style={{
              display: "flex", flexDirection: "column", gap: 4, fontSize: 11,
              borderTop: "1px solid var(--border)", paddingTop: 6, marginTop: 8,
            }}>
              {brokerStats.map(b => {
                const bp = key === "allTime"
                  ? { value: b.pnl, pct: b.pnlPct }
                  : brokerPeriodPerf[b.name]?.[key];
                if (!bp) {
                  return (
                    <div key={b.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{
                        color: "var(--text-secondary)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55%",
                      }} title={b.name}>{b.name}</span>
                      <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>—</span>
                    </div>
                  );
                }
                return <BrokerRow key={b.name} name={b.name} value={bp.value} pct={bp.pct} />;
              })}
            </div>
          )}
        </div>
      ))}

      <div className="card">
        <div className="card-title">Наличные деньги</div>
        {cashPos.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Нет кэш-позиций</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
            {cashPos.map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)" }}>{p.ticker}</span>
                <span style={{ fontWeight: 600 }}>
                  {p.qty.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  <span style={{ color: "var(--text-muted)", marginLeft: 4, fontSize: 10 }}>
                    ≈ ${Math.round(p.qty * p.avgPrice).toLocaleString("en-US")}
                  </span>
                </span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 4 }}>
              <span style={{ color: "var(--text-secondary)" }}>Итого (USD)</span>
              <span style={{ fontWeight: 700 }}>{Math.round(totalCashUsd).toLocaleString("en-US")}</span>
            </div>
            <div style={{ color: "var(--accent-light)", fontWeight: 600 }}>{cashPct.toFixed(1)}% от портфеля</div>
          </div>
        )}
      </div>
    </div>
  );
}
