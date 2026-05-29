"use client";

import { useState, useEffect, useMemo } from "react";
import { useApp } from "@/lib/useApp";
import { useMobile } from "@/lib/useMobile";
import { inputStyle, selectStyle } from "../styles";
import { useFlash } from "../useFlash";

interface PortfolioState {
  name: string;
  currency: string;
  targetIncome: string;
  horizon: string;
  monthlyContrib: string;
}

export function PortfolioTab() {
  const app = useApp();
  const isMobile = useMobile();
  const { saved, flash } = useFlash();

  const [portfolio, setPortfolio] = useState<PortfolioState>({
    name: app.settings.portfolioName,
    currency: app.settings.currency,
    targetIncome: String(app.settings.targetIncome),
    horizon: String(app.settings.investmentHorizon),
    monthlyContrib: String(app.settings.monthlyContribution),
  });

  useEffect(() => {
    setPortfolio({
      name: app.settings.portfolioName,
      currency: app.settings.currency,
      targetIncome: String(app.settings.targetIncome),
      horizon: String(app.settings.investmentHorizon),
      monthlyContrib: String(app.settings.monthlyContribution),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function savePortfolio() {
    app.updateSettings({
      portfolioName: portfolio.name,
      currency: portfolio.currency,
      targetIncome: Number(portfolio.targetIncome),
      investmentHorizon: Number(portfolio.horizon),
      monthlyContribution: Number(portfolio.monthlyContrib),
    });
    flash();
  }

  const liveTotal = app.portfolioTotal;
  const liveCost = app.totalCost;
  const livePnl = app.totalPnl;
  const livePnlPct = app.totalPnlPct;
  const positions = app.positions;
  const liveQuotes = app.liveQuotes;

  const instruments = positions.filter(p => p.type !== "Кэш");
  const cashPos = positions.filter(p => p.type === "Кэш");
  const cashValue = cashPos.reduce((s, p) => s + p.qty * p.avgPrice, 0);
  const cashPct = liveTotal > 0 ? (cashValue / liveTotal) * 100 : 0;

  const topPos = useMemo(() => {
    if (!instruments.length) return null;
    return instruments.reduce((best, p) => {
      const val = p.qty * (liveQuotes[p.ticker]?.current ?? p.avgPrice);
      const bVal = best.qty * (liveQuotes[best.ticker]?.current ?? best.avgPrice);
      return val > bVal ? p : best;
    });
  }, [instruments, liveQuotes]);

  const topPosPct = topPos && liveTotal > 0
    ? (topPos.qty * (liveQuotes[topPos.ticker]?.current ?? topPos.avgPrice) / liveTotal) * 100
    : 0;

  const actualDrawdown = useMemo(() => {
    try {
      const raw = localStorage.getItem("portfolio-chart-history");
      if (!raw) return 0;
      const hist: { date: string; value: number }[] = JSON.parse(raw);
      if (hist.length < 2) return 0;
      let peak = hist[0].value;
      let maxDD = 0;
      for (const pt of hist) {
        if (pt.value > peak) peak = pt.value;
        const dd = peak > 0 ? ((peak - pt.value) / peak) * 100 : 0;
        if (dd > maxDD) maxDD = dd;
      }
      return maxDD;
    } catch { return 0; }
  }, []);

  const portfolioDynamics = useMemo(() => {
    let history: { date: string; value: number; cost?: number }[] = [];
    try {
      history = JSON.parse(localStorage.getItem("portfolio-chart-history") || "[]");
    } catch {}

    const validHistory = history
      .filter((p) => Number.isFinite(p.value) && p.value > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    const first = validHistory[0];
    const last = validHistory.at(-1);
    const baseline = first?.value || liveCost || liveTotal;
    const current = liveTotal || last?.value || 0;
    const changeUsd = current - baseline;
    const changePct = baseline > 0 ? (changeUsd / baseline) * 100 : 0;
    const high = validHistory.length ? Math.max(...validHistory.map((p) => p.value), current) : current;
    const low = validHistory.length ? Math.min(...validHistory.map((p) => p.value), current) : current;
    const target = Number(app.settings.targetAmount) || 0;
    const targetProgress = target > 0 ? Math.min(100, (current / target) * 100) : 0;
    const cashUsd = cashPos.reduce((s, p) => s + p.qty * p.avgPrice, 0);
    const investedShare = current > 0 ? Math.max(0, Math.min(100, ((current - cashUsd) / current) * 100)) : 0;
    const sparklineSource = validHistory.length >= 2
      ? validHistory.slice(-24).map((p) => p.value)
      : [baseline, current].filter((v) => v > 0);
    const minSpark = sparklineSource.length ? Math.min(...sparklineSource) : 0;
    const maxSpark = sparklineSource.length ? Math.max(...sparklineSource) : 0;
    const rangeSpark = maxSpark - minSpark || 1;
    const points = sparklineSource.map((value, index) => {
      const x = sparklineSource.length === 1 ? 100 : (index / (sparklineSource.length - 1)) * 100;
      const y = 100 - ((value - minSpark) / rangeSpark) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");

    return {
      current, baseline, changeUsd, changePct, high, low, target, targetProgress,
      investedShare, cashUsd, historyCount: validHistory.length,
      firstDate: first?.date, lastDate: last?.date, points,
    };
  }, [cashPos, liveCost, liveTotal, app.settings.targetAmount]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div className="card" style={{ padding: 20 }}>
        <div className="card-title">Параметры портфеля</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>Название портфеля</div>
            <input type="text" value={portfolio.name} onChange={e => setPortfolio(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>Базовая валюта</div>
            <select value={portfolio.currency} onChange={e => setPortfolio(p => ({ ...p, currency: e.target.value }))} style={selectStyle}>
              {["USD", "EUR", "RUB", "TRY", "AZN", "GEL"].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>Целевой доход (USD/год)</div>
            <input type="number" value={portfolio.targetIncome} onChange={e => setPortfolio(p => ({ ...p, targetIncome: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>Инвестиционный горизонт (лет)</div>
            <input type="number" value={portfolio.horizon} onChange={e => setPortfolio(p => ({ ...p, horizon: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>Ежемесячное пополнение (USD)</div>
            <input type="number" value={portfolio.monthlyContrib} onChange={e => setPortfolio(p => ({ ...p, monthlyContrib: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <button onClick={savePortfolio} style={{ padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "white" }}>
              Сохранить
            </button>
            {saved && <span style={{ fontSize: 12, color: "#22c55e" }}>{saved}</span>}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div>
            <div className="card-title" style={{ marginBottom: 4 }}>Динамика портфеля</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {portfolioDynamics.historyCount > 1
                ? `${portfolioDynamics.firstDate} → ${portfolioDynamics.lastDate}`
                : "История появится после фиксаций портфеля"}
            </div>
          </div>
          <div style={{
            padding: "4px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700,
            background: portfolioDynamics.changeUsd >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            color: portfolioDynamics.changeUsd >= 0 ? "#22c55e" : "#ef4444",
            whiteSpace: "nowrap",
          }}>
            {portfolioDynamics.changeUsd >= 0 ? "+" : ""}{portfolioDynamics.changePct.toFixed(2)}%
          </div>
        </div>
        {liveTotal <= 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 16, textAlign: "center" }}>
            Добавьте инструменты на странице Позиции
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ height: 96, borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border)", padding: 12 }}>
              {portfolioDynamics.points ? (
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
                  <polyline
                    points={portfolioDynamics.points}
                    fill="none"
                    stroke={portfolioDynamics.changeUsd >= 0 ? "#22c55e" : "#ef4444"}
                    strokeWidth="3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
                  Недостаточно точек истории
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              {[
                { label: "Капитал", value: `$${Math.round(liveTotal).toLocaleString("en-US")}` },
                { label: "Изменение", value: `${portfolioDynamics.changeUsd >= 0 ? "+" : ""}$${Math.round(portfolioDynamics.changeUsd).toLocaleString("en-US")}`, color: portfolioDynamics.changeUsd >= 0 ? "#22c55e" : "#ef4444" },
                { label: "P&L", value: `${livePnl >= 0 ? "+" : ""}$${Math.round(livePnl).toLocaleString("en-US")}`, color: livePnl >= 0 ? "#22c55e" : "#ef4444" },
                { label: "Доходность", value: `${livePnlPct >= 0 ? "+" : ""}${livePnlPct.toFixed(2)}%`, color: livePnlPct >= 0 ? "#22c55e" : "#ef4444" },
                { label: "Максимум", value: `$${Math.round(portfolioDynamics.high).toLocaleString("en-US")}` },
                { label: "Минимум", value: `$${Math.round(portfolioDynamics.low).toLocaleString("en-US")}` },
              ].map((item) => (
                <div key={item.label} style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: item.color ?? "var(--text-primary)" }}>{item.value}</div>
                </div>
              ))}
            </div>

            {[
              { label: "Цель", value: `${portfolioDynamics.targetProgress.toFixed(1)}%`, pct: portfolioDynamics.targetProgress, color: "var(--accent)" },
              { label: "В рынке", value: `${portfolioDynamics.investedShare.toFixed(1)}%`, pct: portfolioDynamics.investedShare, color: "#3b82f6" },
              { label: "Кэш", value: `${cashPct.toFixed(1)}%`, pct: cashPct, color: "#22c55e" },
            ].map((row) => (
              <div key={row.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
                  <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{row.value}</span>
                </div>
                <div style={{ height: 7, borderRadius: 999, background: "var(--bg-secondary)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, row.pct))}%`, height: "100%", background: row.color, borderRadius: 999 }} />
                </div>
              </div>
            ))}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 2 }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Инструментов</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{instruments.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Крупнейшая позиция</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{topPos ? `${topPos.ticker} (${topPosPct.toFixed(1)}%)` : "—"}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Просадка</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: actualDrawdown > 10 ? "#ef4444" : "var(--text-primary)" }}>{actualDrawdown.toFixed(1)}%</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Валюта / горизонт</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{portfolio.currency} · {portfolio.horizon} лет</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
