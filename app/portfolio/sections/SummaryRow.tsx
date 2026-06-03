"use client";

import type { LivePosition } from "../types";

interface PeriodMetric {
  usd: number;
  pct: string;
  noData: boolean;
}

export interface Recommendation {
  label: string;
  color: string;
  desc: string;
}

interface SummaryRowProps {
  positions: LivePosition[];
  portfolioTotal: number;
  prevTotal: number;
  dailyChangePct: number;
  totalPnlPct: number;
  periodPnl: Record<string, PeriodMetric>;
  liveRiskLabel: string;
  weightedBeta: number;
  portfolioMaxDrawdown: number;
  var95_1d: string;
  var95_10d: string;
  sharpeRatio: string;
  diversificationLabel: string;
  recommendation: Recommendation;
}

export function SummaryRow({
  positions,
  portfolioTotal,
  prevTotal,
  dailyChangePct,
  totalPnlPct,
  periodPnl,
  liveRiskLabel,
  weightedBeta,
  portfolioMaxDrawdown,
  var95_1d,
  var95_10d,
  sharpeRatio,
  diversificationLabel,
  recommendation,
}: SummaryRowProps) {
  const dailyChange = portfolioTotal - prevTotal;

  // Daily-status dot tooltip
  const stale = positions.filter((p) => {
    const ms = (p as { marketState?: string }).marketState;
    return ms && ms !== "REGULAR";
  });
  const futureHints = positions
    .filter((p) => {
      const fs = (p as { futureSymbol?: string }).futureSymbol;
      const fp = (p as { futurePct?: number }).futurePct;
      return fs && typeof fp === "number";
    })
    .map((p) => {
      const fs = (p as { futureSymbol?: string }).futureSymbol!;
      const fp = (p as { futurePct?: number }).futurePct!;
      return `${p.ticker} → ${fs}: ${fp >= 0 ? "+" : ""}${fp.toFixed(2)}%`;
    });
  const hasStale = stale.length > 0;
  const dotColor = hasStale ? "#f59e0b" : "#22c55e";
  const tooltipParts: string[] = [];
  if (hasStale) {
    tooltipParts.push(`Биржи закрыты для ${stale.length}/${positions.length} позиций — их цена «застыла» на закрытии`);
  } else {
    tooltipParts.push("Все рынки активны, цены актуальные");
  }
  if (futureHints.length > 0) {
    tooltipParts.push("");
    tooltipParts.push("Фьючерсы сейчас (after-hours):");
    tooltipParts.push(...futureHints);
  }
  const dailyTooltip = tooltipParts.join("\n");

  const dynamicsItems = [
    { label: "За день",      value: dailyChange,             pct: dailyChangePct,                          noData: false },
    { label: "За неделю",    value: periodPnl["7Д"].usd,    pct: parseFloat(periodPnl["7Д"].pct),         noData: periodPnl["7Д"].noData },
    { label: "За месяц",     value: periodPnl["1М"].usd,    pct: parseFloat(periodPnl["1М"].pct),         noData: periodPnl["1М"].noData },
    { label: "За год (YTD)", value: periodPnl["YTD"].usd,   pct: parseFloat(periodPnl["YTD"].pct),        noData: periodPnl["YTD"].noData },
  ];

  const riskItems = [
    { label: "Уровень риска",     value: positions.length > 0 ? liveRiskLabel : "–", color: "#f59e0b", hint: undefined },
    { label: "Бета (рынок)",      value: positions.length > 0 ? weightedBeta.toFixed(2) : "–", hint: "Чувствительность к рынку. 1.0 = движется как S&P 500, >1 — волатильнее" },
    { label: "Макс. просадка",    value: portfolioMaxDrawdown > 0 ? `${portfolioMaxDrawdown.toFixed(1)}%` : "–", color: "#ef4444", hint: "Максимальное снижение портфеля от пика за всё время" },
    { label: "VaR 95% / 1 день",  value: positions.length > 0 ? `${var95_1d}%` : "–", color: "#ef4444", hint: "Value at Risk: с вероятностью 95% потери за 1 день не превысят эту величину" },
    { label: "VaR 95% / 10 дней", value: positions.length > 0 ? `${var95_10d}%` : "–", color: "#ef4444", hint: "Value at Risk за 10 торговых дней при доверительном интервале 95%" },
    { label: "Sharpe Ratio",      value: sharpeRatio, color: sharpeRatio !== "–" && parseFloat(sharpeRatio) > 0 ? "#22c55e" : "#ef4444", hint: "Доходность сверх безрисковой ставки на единицу риска. >1 — хороший показатель" },
    { label: "Диверсификация",    value: diversificationLabel, color: "#22c55e", hint: undefined },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: 12 }}>
      <div className="card">
        <div className="card-title">Общая стоимость портфеля</div>
        <div className="metric-value">{portfolioTotal.toLocaleString("ru-RU")}</div>
        <div className="metric-label">USD</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <span
            title={dailyTooltip}
            style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }}
          />
          <div className={dailyChange >= 0 ? "positive" : "negative"} style={{ fontSize: 14, fontWeight: 600 }}>
            {dailyChange >= 0 ? "+" : ""}{Math.round(Math.abs(dailyChange)).toLocaleString("en-US")} ({dailyChange >= 0 ? "+" : ""}{dailyChangePct.toFixed(2)}%)
          </div>
        </div>
        <div className="metric-label">Изменение за день</div>
      </div>

      <div className="card">
        <div className="card-title">Динамика портфеля</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {dynamicsItems.map((m) => (
            <div key={m.label} style={{ padding: "6px 8px", background: "var(--bg-secondary)", borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{m.label}</div>
              {m.noData ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-muted)" }}>–</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>нет данных</div>
                </>
              ) : (
                <>
                  <div className={m.value >= 0 ? "positive" : "negative"} style={{ fontSize: 14, fontWeight: 700 }}>
                    {m.value >= 0 ? "+" : ""}{Math.round(Math.abs(m.value)).toLocaleString("en-US")}
                  </div>
                  <div className={m.pct >= 0 ? "positive" : "negative"} style={{ fontSize: 12 }}>
                    {m.pct >= 0 ? "+" : ""}{Math.abs(m.pct).toFixed(2)}%
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">Показатели риска</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {riskItems.map((item) => (
            <div key={item.label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                <span style={{ fontWeight: 600, color: item.color ?? "var(--text-primary)" }}>{item.value}</span>
              </div>
              {item.hint && (
                <div style={{ fontSize: 9, color: "var(--text-muted)", lineHeight: 1.3, marginTop: 1 }}>{item.hint}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <div className="card-title">Рекомендация</div>
        <div
          style={{
            width: 82, height: 82, borderRadius: "50%",
            border: `3px solid ${recommendation.color}`,
            boxShadow: `0 0 18px ${recommendation.color}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: recommendation.label.length > 7 ? 10 : 13,
            fontWeight: 700, color: recommendation.color,
            textAlign: "center", padding: 8,
            transition: "all 0.5s ease",
          }}
        >
          {recommendation.label}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.4 }}>
          {recommendation.desc}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 2 }}>
          <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: dailyChangePct >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: dailyChangePct >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
            День: {dailyChangePct >= 0 ? "+" : ""}{dailyChangePct.toFixed(2)}%
          </span>
          <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: totalPnlPct >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: totalPnlPct >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
            P&L: {totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
