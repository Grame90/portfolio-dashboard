"use client";

import type { StoredPosition } from "@/lib/types";

interface PeriodValue {
  value: number;
  pct: number;
}

interface PeriodPerf {
  week: PeriodValue | null;
  month: PeriodValue | null;
  year: PeriodValue | null;
}

interface MetricsRowProps {
  livePortfolioTotal: number;
  liveDailyChange: number;
  liveDailyChangePct: number;
  periodPerf: PeriodPerf;
  positions: StoredPosition[];
}

export function MetricsRow({
  livePortfolioTotal,
  liveDailyChange,
  liveDailyChangePct,
  periodPerf,
  positions,
}: MetricsRowProps) {
  const cashPos = positions.filter(p => p.type === "Кэш");
  const totalCashUsd = cashPos.reduce((s, p) => s + p.qty * p.avgPrice, 0);
  const cashPct = livePortfolioTotal > 0 ? (totalCashUsd / livePortfolioTotal) * 100 : 0;

  const periodCards = [
    { label: "Неделя", d: periodPerf.week },
    { label: "Месяц",  d: periodPerf.month },
    { label: "Год",    d: periodPerf.year },
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
      </div>

      {periodCards.map(({ label, d }) => (
        <div key={label} className="card">
          <div className="card-title">{label}</div>
          {d == null ? (
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-muted)" }}>—</div>
          ) : (
            <>
              <div className={d.value >= 0 ? "positive" : "negative"} style={{ fontSize: 22, fontWeight: 700 }}>
                {d.value >= 0 ? "+" : ""}{Math.abs(d.value).toLocaleString("en-US")}
              </div>
              <div className={d.value >= 0 ? "positive" : "negative"} style={{ fontSize: 14 }}>
                {d.pct >= 0 ? "+" : ""}{Math.abs(d.pct).toFixed(2)}%
              </div>
            </>
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
