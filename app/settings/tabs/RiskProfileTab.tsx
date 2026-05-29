"use client";

import { useState, useEffect, useMemo } from "react";
import { useApp } from "@/lib/useApp";
import { RISK_PRESETS, RISK_CONFIGS } from "../constants";
import { inputStyle, selectStyle } from "../styles";
import { useFlash } from "../useFlash";

interface RiskState {
  level: string;
  maxDrawdown: number;
  maxPositionSize: number;
  minCash: number;
  stopLoss: number;
  rebalancePeriod: string;
  targetAmount: string;
}

export function RiskProfileTab() {
  const app = useApp();
  const { saved, flash } = useFlash();

  const [risk, setRisk] = useState<RiskState>({
    level: app.settings.riskLevel,
    maxDrawdown: app.settings.maxDrawdown,
    maxPositionSize: app.settings.maxPositionSize,
    minCash: app.settings.minCash,
    stopLoss: app.settings.stopLoss,
    rebalancePeriod: app.settings.rebalancePeriod,
    targetAmount: String(app.settings.targetAmount),
  });

  useEffect(() => {
    setRisk({
      level: app.settings.riskLevel,
      maxDrawdown: app.settings.maxDrawdown,
      maxPositionSize: app.settings.maxPositionSize,
      minCash: app.settings.minCash,
      stopLoss: app.settings.stopLoss,
      rebalancePeriod: app.settings.rebalancePeriod,
      targetAmount: String(app.settings.targetAmount),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveRisk() {
    app.updateSettings({
      riskLevel: risk.level,
      maxDrawdown: risk.maxDrawdown,
      maxPositionSize: risk.maxPositionSize,
      minCash: risk.minCash,
      stopLoss: risk.stopLoss,
      rebalancePeriod: risk.rebalancePeriod,
      targetAmount: Number(risk.targetAmount),
    });
    flash();
  }

  const liveTotal = app.portfolioTotal;
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

  const riskCfg = RISK_CONFIGS[risk.level] ?? RISK_CONFIGS["Средний"];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div className="card" style={{ padding: 20 }}>
        <div className="card-title">Параметры риска</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8 }}>Уровень риска</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {["Консервативный", "Умеренный", "Средний", "Агрессивный"].map(lvl => {
                const cfg = RISK_CONFIGS[lvl];
                const active = risk.level === lvl;
                return (
                  <button key={lvl} onClick={() => setRisk(r => ({ ...r, level: lvl, ...RISK_PRESETS[lvl] }))} style={{
                    padding: "10px 8px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700,
                    border: active ? `2px solid ${cfg.color}` : "1px solid var(--border)",
                    background: active ? `${cfg.color}18` : "var(--bg-secondary)",
                    color: active ? cfg.color : "var(--text-secondary)",
                    transition: "all 0.15s",
                  }}>
                    {lvl}
                  </button>
                );
              })}
            </div>
          </div>

          {[
            { label: "Максимальная просадка (%)", key: "maxDrawdown" as const, min: 5, max: 50 },
            { label: "Макс. размер позиции (%)", key: "maxPositionSize" as const, min: 5, max: 50 },
            { label: "Минимальный кэш (%)", key: "minCash" as const, min: 0, max: 30 },
            { label: "Стоп-лосс (%)", key: "stopLoss" as const, min: 5, max: 30 },
          ].map(f => (
            <div key={f.key}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>{f.label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input type="range" min={f.min} max={f.max} value={risk[f.key]}
                  onChange={e => setRisk(r => ({ ...r, [f.key]: Number(e.target.value) }))}
                  style={{ flex: 1, accentColor: "var(--accent)" }} />
                <span style={{ fontWeight: 700, fontSize: 14, width: 40, textAlign: "right" }}>{risk[f.key]}%</span>
              </div>
            </div>
          ))}

          <div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>Период ребалансировки</div>
            <select value={risk.rebalancePeriod} onChange={e => setRisk(r => ({ ...r, rebalancePeriod: e.target.value }))} style={selectStyle}>
              {["Ежемесячно", "Квартально", "Полугодово", "Ежегодно"].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>Целевой размер портфеля (USD)</div>
            <input type="number" value={risk.targetAmount} onChange={e => setRisk(r => ({ ...r, targetAmount: e.target.value }))} style={inputStyle} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={saveRisk} style={{ padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "white" }}>
              Сохранить риск-профиль
            </button>
            {saved && <span style={{ fontSize: 12, color: "#22c55e" }}>{saved}</span>}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="card-title">Текущий риск-профиль</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: `${riskCfg.color}12`, border: `1px solid ${riskCfg.color}40` }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: riskCfg.color, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: riskCfg.color }}>{risk.level}</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{riskCfg.desc}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {([
            { label: "Макс. просадка (лимит)", value: `${risk.maxDrawdown}%`, note: actualDrawdown > 0 ? `факт: ${actualDrawdown.toFixed(1)}%` : undefined, warn: actualDrawdown > risk.maxDrawdown },
            { label: "Макс. позиция (лимит)", value: `${risk.maxPositionSize}%`, note: topPos ? `факт: ${topPosPct.toFixed(1)}% (${topPos.ticker})` : undefined, warn: topPosPct > risk.maxPositionSize },
            { label: "Мин. кэш (лимит)", value: `${risk.minCash}%`, note: `факт: ${cashPct.toFixed(1)}%`, warn: cashPct < risk.minCash },
            { label: "Стоп-лосс", value: `${risk.stopLoss}%` },
            { label: "Ребалансировка", value: risk.rebalancePeriod },
            { label: "Целевой капитал", value: `$${Number(risk.targetAmount).toLocaleString("en-US")}`, note: liveTotal > 0 ? `факт: $${Math.round(liveTotal).toLocaleString("en-US")}` : undefined },
          ] as { label: string; value: string; note?: string; warn?: boolean }[]).map(item => (
            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item.label}</span>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{item.value}</div>
                {item.note && <div style={{ fontSize: 10, color: item.warn ? "#ef4444" : "var(--text-muted)", marginTop: 1 }}>{item.note}</div>}
              </div>
            </div>
          ))}
        </div>

        {liveTotal > 0 && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Показатели портфеля</div>
            {([
              { label: "Инструментов", value: instruments.length },
              { label: "Доходность", value: `${livePnlPct >= 0 ? "+" : ""}${livePnlPct.toFixed(2)}%`, color: livePnlPct >= 0 ? "#22c55e" : "#ef4444" },
              { label: "P&L", value: `${livePnl >= 0 ? "+" : ""}$${Math.round(livePnl).toLocaleString("en-US")}`, color: livePnl >= 0 ? "#22c55e" : "#ef4444" },
            ] as { label: string; value: string | number; color?: string }[]).map(m => (
              <div key={m.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "var(--text-secondary)" }}>{m.label}</span>
                <span style={{ fontWeight: 700, color: m.color ?? "var(--text-primary)" }}>{m.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
