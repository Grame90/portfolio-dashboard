"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import { connections } from "@/lib/mockData";
import { useApp } from "@/lib/useApp";
import { useMobile } from "@/lib/useMobile";

const settingsTabs = ["ПОДКЛЮЧЕНИЯ", "УВЕДОМЛЕНИЯ", "РИСК-ПРОФИЛЬ", "ПОРТФЕЛЬ", "ДАННЫЕ", "АККАУНТ"];

const RISK_PRESETS: Record<string, { maxDrawdown: number; maxPositionSize: number; minCash: number; stopLoss: number; rebalancePeriod: string }> = {
  "Консервативный": { maxDrawdown: 10, maxPositionSize: 15, minCash: 20, stopLoss: 8,  rebalancePeriod: "Ежеквартально" },
  "Умеренный":      { maxDrawdown: 15, maxPositionSize: 20, minCash: 10, stopLoss: 12, rebalancePeriod: "Квартально" },
  "Средний":        { maxDrawdown: 20, maxPositionSize: 25, minCash: 5,  stopLoss: 15, rebalancePeriod: "Полугодово" },
  "Агрессивный":    { maxDrawdown: 35, maxPositionSize: 40, minCash: 2,  stopLoss: 25, rebalancePeriod: "Ежегодно" },
};

const DEFAULT_NOTIFICATIONS = [
  { id: "price_alert",   label: "Ценовые оповещения",        description: "Уведомления при достижении целевой цены инструмента",  enabled: true },
  { id: "pnl_alert",     label: "Изменение P&L",             description: "Уведомления при изменении P&L более чем на 5%",        enabled: true },
  { id: "rebalance",     label: "Напоминание о ребалансировке", description: "Периодические напоминания о ребалансировке портфеля", enabled: false },
  { id: "earnings",      label: "Отчёты компаний",            description: "Уведомления о предстоящих квартальных отчётах",        enabled: true },
  { id: "dividends",     label: "Дивидендные выплаты",        description: "Напоминания о датах дивидендных выплат",               enabled: false },
  { id: "macro",         label: "Макроэкономические события", description: "ФРС, CPI, NFP и другие ключевые события",              enabled: true },
  { id: "drawdown",      label: "Просадка портфеля",          description: "Уведомление при просадке портфеля ниже установленного порога", enabled: true },
  { id: "daily_summary", label: "Дневной итог",               description: "Ежедневная сводка по портфелю в конце торгового дня",  enabled: false },
];

const LS_NOTIFICATIONS = "dashboard-notifications";

export default function SettingsPage() {
  const isMobile = useMobile();
  const app = useApp();
  const [activeTab, setActiveTab] = useState("ПОДКЛЮЧЕНИЯ");
  const importRef = useRef<HTMLInputElement>(null);
  const [connectionList, setConnectionList] = useState(connections);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({ ibkr: "", bybit: "" });
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<string | null>(null);

  // Notifications — persisted separately
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_NOTIFICATIONS);
      if (raw) {
        const saved: { id: string; enabled: boolean }[] = JSON.parse(raw);
        setNotifications(prev => prev.map(n => {
          const found = saved.find(s => s.id === n.id);
          return found ? { ...n, enabled: found.enabled } : n;
        }));
      }
    } catch {}
  }, []);

  function toggleNotification(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, enabled: !n.enabled } : n));
  }

  function saveNotifications() {
    try {
      localStorage.setItem(LS_NOTIFICATIONS, JSON.stringify(notifications.map(n => ({ id: n.id, enabled: n.enabled }))));
    } catch {}
    flash();
  }

  // Risk profile — single state from app.settings
  const [risk, setRisk] = useState({
    level: app.settings.riskLevel,
    maxDrawdown: app.settings.maxDrawdown,
    maxPositionSize: app.settings.maxPositionSize,
    minCash: app.settings.minCash,
    stopLoss: app.settings.stopLoss,
    rebalancePeriod: app.settings.rebalancePeriod,
    targetAmount: String(app.settings.targetAmount),
  });

  // Sync when app.settings loads from localStorage (runs once after hydration)
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

  // Portfolio settings
  const [portfolio, setPortfolio] = useState({
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

  function flash() {
    setSaved("Сохранено ✓");
    setTimeout(() => setSaved(null), 2500);
  }

  const LS_KEYS = [
    { key: "positions-data",         label: "Позиции" },
    { key: "dashboard-settings",     label: "Настройки" },
    { key: "portfolio-chart-history",label: "История портфеля" },
    { key: "dividends-received",     label: "Дивиденды" },
    { key: "snapshots-data",         label: "Снимки" },
    { key: "target-structure",       label: "Целевая структура" },
  ];

  function handleExport() {
    try {
      const payload: Record<string, unknown> = { exportedAt: new Date().toISOString() };
      LS_KEYS.forEach(({ key }) => {
        try { payload[key] = JSON.parse(localStorage.getItem(key) || "null"); } catch {}
      });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portfolio_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSaved("Бэкап скачан ✓");
      setTimeout(() => setSaved(null), 2500);
    } catch { setSaved("Ошибка экспорта ✗"); }
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const payload = JSON.parse(ev.target?.result as string);
        LS_KEYS.forEach(({ key }) => {
          if (payload[key] != null) localStorage.setItem(key, JSON.stringify(payload[key]));
        });
        app.refreshPositions();
        setSaved("Данные импортированы ✓");
        setTimeout(() => setSaved(null), 3000);
      } catch { setSaved("Ошибка импорта ✗"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleClearAll() {
    if (!window.confirm("Удалить все данные портфеля? Это действие необратимо.")) return;
    LS_KEYS.forEach(({ key }) => localStorage.removeItem(key));
    app.refreshPositions();
    setSaved("Данные удалены");
    setTimeout(() => setSaved(null), 2500);
  }

  const statusColor = (s: string) => s === "Активен" ? "#22c55e" : "#ef4444";
  const statusBg    = (s: string) => s === "Активен" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";

  // Real portfolio metrics for display
  const liveTotal   = app.portfolioTotal;
  const liveCost    = app.totalCost;
  const livePnl     = app.totalPnl;
  const livePnlPct  = app.totalPnlPct;
  const positions   = app.positions;
  const liveQuotes  = app.liveQuotes;

  const instruments = positions.filter(p => p.type !== "Кэш");
  const cashPos     = positions.filter(p => p.type === "Кэш");
  const cashValue   = cashPos.reduce((s, p) => s + p.qty * p.avgPrice, 0);
  const cashPct     = liveTotal > 0 ? (cashValue / liveTotal) * 100 : 0;

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

  // Actual max drawdown from chart history
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

  // Risk level config
  const RISK_CONFIGS: Record<string, { color: string; desc: string }> = {
    "Консервативный": { color: "#22c55e", desc: "Сохранение капитала, минимальный риск" },
    "Умеренный":      { color: "#3b82f6", desc: "Баланс роста и защиты" },
    "Средний":        { color: "#f59e0b", desc: "Умеренный рост с допустимым риском" },
    "Агрессивный":    { color: "#ef4444", desc: "Максимальный рост, высокий риск" },
  };
  const riskCfg = RISK_CONFIGS[risk.level] ?? RISK_CONFIGS["Средний"];

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: 8,
    border: "1px solid var(--border)", background: "var(--bg-secondary)",
    color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box",
  };
  const selectStyle: React.CSSProperties = { ...inputStyle };

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader title="НАСТРОЙКИ" subtitle="Управление подключениями, уведомлениями и параметрами" />

      <div style={{ padding: isMobile ? "12px" : "16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 8 }}>
          {settingsTabs.map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, transition: "all 0.15s",
              background: activeTab === t ? "var(--accent)" : "var(--bg-card)",
              color: activeTab === t ? "white" : "var(--text-secondary)",
            }}>{t}</button>
          ))}
        </div>

        {/* CONNECTIONS */}
        {activeTab === "ПОДКЛЮЧЕНИЯ" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12 }}>
              {connectionList.map((c) => (
                <div key={c.id} className="card" style={{ padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: c.color + "22", border: `2px solid ${c.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11, color: c.color }}>
                        {c.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{c.type}</div>
                      </div>
                    </div>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: statusBg(c.status), color: statusColor(c.status) }}>
                      {c.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 12 }}>{c.description}</div>
                  {c.id !== "yahoo" && (
                    <>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>API ключ</div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                        <input
                          type={showKey[c.id] ? "text" : "password"}
                          placeholder="Введите API ключ..."
                          value={apiKeys[c.id] ?? ""}
                          onChange={(e) => setApiKeys((prev) => ({ ...prev, [c.id]: e.target.value }))}
                          style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12 }}
                        />
                        <button onClick={() => setShowKey((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--text-secondary)", fontSize: 12 }}>
                          {showKey[c.id] ? "Скрыть" : "Показать"}
                        </button>
                      </div>
                    </>
                  )}
                  <button
                    onClick={() => {
                      const key = c.id === "yahoo" ? "yahoofinance" : apiKeys[c.id];
                      if (!key || key.length < 10) { alert("Введите корректный API ключ (минимум 10 символов)"); return; }
                      setConnectionList(prev => prev.map(x => x.id === c.id ? { ...x, status: x.status === "Активен" ? "Отключён" : "Активен" } : x));
                    }}
                    style={{ width: "100%", padding: 9, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: c.status === "Активен" ? "rgba(239,68,68,0.12)" : "var(--accent)", color: c.status === "Активен" ? "#ef4444" : "white" }}>
                    {c.status === "Активен" ? "Отключить" : "Подключить"}
                  </button>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: 16 }}>
              <div className="card-title">Как получить API ключи</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "var(--accent-light)" }}>Interactive Brokers</div>
                  <ol style={{ color: "var(--text-secondary)", fontSize: 12, paddingLeft: 16, lineHeight: 2 }}>
                    <li>Войдите в Client Portal IBKR</li><li>Перейдите в API → Web API</li>
                    <li>Создайте новый API ключ</li><li>Скопируйте и вставьте выше</li>
                  </ol>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#f59e0b" }}>Bybit</div>
                  <ol style={{ color: "var(--text-secondary)", fontSize: 12, paddingLeft: 16, lineHeight: 2 }}>
                    <li>Войдите в аккаунт Bybit</li><li>Профиль → API Management</li>
                    <li>Create New Key (Read-only)</li><li>Скопируйте и вставьте выше</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS */}
        {activeTab === "УВЕДОМЛЕНИЯ" && (
          <div className="card" style={{ padding: 20, maxWidth: 680 }}>
            <div className="card-title">Настройки уведомлений</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {notifications.map((n, i) => (
                <div key={n.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "14px 0", borderBottom: i < notifications.length - 1 ? "1px solid var(--border)" : "none",
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{n.label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{n.description}</div>
                  </div>
                  <div onClick={() => toggleNotification(n.id)} style={{
                    width: 44, height: 24, borderRadius: 12, cursor: "pointer", flexShrink: 0,
                    background: n.enabled ? "var(--accent)" : "var(--bg-secondary)",
                    border: "1px solid var(--border)", position: "relative", transition: "background 0.2s",
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", background: "white",
                      position: "absolute", top: 2, left: n.enabled ? 22 : 2,
                      transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
              <button onClick={saveNotifications} style={{ padding: "10px 28px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "white" }}>
                Сохранить
              </button>
              {saved && <span style={{ fontSize: 12, color: "#22c55e" }}>{saved}</span>}
            </div>
          </div>
        )}

        {/* RISK PROFILE */}
        {activeTab === "РИСК-ПРОФИЛЬ" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Form */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title">Параметры риска</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Risk level selector */}
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

            {/* Current risk profile */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title">Текущий риск-профиль</div>
              {/* Level badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "12px 16px", borderRadius: 10, background: `${riskCfg.color}12`, border: `1px solid ${riskCfg.color}40` }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: riskCfg.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: riskCfg.color }}>{risk.level}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{riskCfg.desc}</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {[
                  { label: "Макс. просадка (лимит)", value: `${risk.maxDrawdown}%`, note: actualDrawdown > 0 ? `факт: ${actualDrawdown.toFixed(1)}%` : undefined, warn: actualDrawdown > risk.maxDrawdown },
                  { label: "Макс. позиция (лимит)", value: `${risk.maxPositionSize}%`, note: topPos ? `факт: ${topPosPct.toFixed(1)}% (${topPos.ticker})` : undefined, warn: topPosPct > risk.maxPositionSize },
                  { label: "Мин. кэш (лимит)", value: `${risk.minCash}%`, note: `факт: ${cashPct.toFixed(1)}%`, warn: cashPct < risk.minCash },
                  { label: "Стоп-лосс", value: `${risk.stopLoss}%` },
                  { label: "Ребалансировка", value: risk.rebalancePeriod },
                  { label: "Целевой капитал", value: `$${Number(risk.targetAmount).toLocaleString("en-US")}`, note: liveTotal > 0 ? `факт: $${Math.round(liveTotal).toLocaleString("en-US")}` : undefined },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item.label}</span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{item.value}</div>
                      {item.note && <div style={{ fontSize: 10, color: (item as any).warn ? "#ef4444" : "var(--text-muted)", marginTop: 1 }}>{item.note}</div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Risk indicators from real portfolio */}
              {liveTotal > 0 && (
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Показатели портфеля</div>
                  {[
                    { label: "Инструментов", value: instruments.length },
                    { label: "Доходность", value: `${livePnlPct >= 0 ? "+" : ""}${livePnlPct.toFixed(2)}%`, color: livePnlPct >= 0 ? "#22c55e" : "#ef4444" },
                    { label: "P&L", value: `${livePnl >= 0 ? "+" : ""}$${Math.round(livePnl).toLocaleString("en-US")}`, color: livePnl >= 0 ? "#22c55e" : "#ef4444" },
                  ].map(m => (
                    <div key={m.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "var(--text-secondary)" }}>{m.label}</span>
                      <span style={{ fontWeight: 700, color: (m as any).color ?? "var(--text-primary)" }}>{m.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PORTFOLIO SETTINGS */}
        {activeTab === "ПОРТФЕЛЬ" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Form */}
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

            {/* Live portfolio stats */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title">Текущие показатели портфеля</div>
              {liveTotal <= 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 16, textAlign: "center" }}>
                  Добавьте инструменты на странице Позиции
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {[
                    { label: "Название", value: portfolio.name },
                    { label: "Капитал", value: `$${Math.round(liveTotal).toLocaleString("en-US")}` },
                    { label: "Вложено", value: `$${Math.round(liveCost).toLocaleString("en-US")}` },
                    { label: "P&L", value: `${livePnl >= 0 ? "+" : ""}$${Math.round(livePnl).toLocaleString("en-US")}`, color: livePnl >= 0 ? "#22c55e" : "#ef4444" },
                    { label: "Доходность", value: `${livePnlPct >= 0 ? "+" : ""}${livePnlPct.toFixed(2)}%`, color: livePnlPct >= 0 ? "#22c55e" : "#ef4444" },
                    { label: "Инструментов", value: `${instruments.length}` },
                    { label: "Кэш в портфеле", value: `${cashPct.toFixed(1)}%` },
                    { label: "Крупнейшая позиция", value: topPos ? `${topPos.ticker} (${topPosPct.toFixed(1)}%)` : "—" },
                    { label: "Целевой капитал", value: `$${Number(risk.targetAmount).toLocaleString("en-US")}` },
                    { label: "Выполнение цели", value: `${Math.min(100, Math.round(liveTotal / Number(risk.targetAmount) * 100))}%` },
                    { label: "Горизонт", value: `${portfolio.horizon} лет` },
                    { label: "Валюта", value: portfolio.currency },
                  ].map((item, i, arr) => (
                    <div key={item.label} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "9px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                    }}>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: (item as any).color ?? "var(--text-primary)" }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* DATA */}
        {activeTab === "ДАННЫЕ" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Export / Import */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title">Резервное копирование</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Экспорт данных</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
                    Скачайте полный бэкап портфеля: позиции, история, дивиденды, настройки.
                  </div>
                  <button onClick={handleExport} style={{ padding: "9px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "white" }}>
                    Скачать бэкап (.json)
                  </button>
                </div>
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Импорт данных</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
                    Восстановите портфель из ранее сохранённого бэкап-файла.
                  </div>
                  <button onClick={() => importRef.current?.click()} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "transparent", color: "var(--text-primary)" }}>
                    Загрузить файл (.json)
                  </button>
                  <input ref={importRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
                </div>
                {saved && <div style={{ fontSize: 12, color: saved.includes("✗") ? "#ef4444" : "#22c55e" }}>{saved}</div>}
              </div>
            </div>

            {/* Storage info + clear */}
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title">Хранилище данных</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 20 }}>
                {LS_KEYS.map(({ key, label }) => {
                  const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
                  const size = raw ? (new Blob([raw]).size / 1024).toFixed(1) : null;
                  const count = (() => {
                    try { const d = JSON.parse(raw || "null"); return Array.isArray(d) ? d.length : (d ? 1 : 0); } catch { return 0; }
                  })();
                  return (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: size ? "var(--text-primary)" : "var(--text-muted)" }}>
                        {size ? `${count > 0 ? `${count} зап. · ` : ""}${size} КБ` : "пусто"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#ef4444", marginBottom: 4 }}>Удалить все данные</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
                  Полностью очищает все сохранённые данные портфеля. Необратимо.
                </div>
                <button onClick={handleClearAll} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #ef4444", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "transparent", color: "#ef4444" }}>
                  Очистить данные
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ACCOUNT */}
        {activeTab === "АККАУНТ" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title">Профиль</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { label: "Имя", value: "Ramil Guliyev" },
                  { label: "Email", value: "gramevlog12345@gmail.com" },
                  { label: "Телефон", value: "+90 (555) 000-0000" },
                  { label: "Часовой пояс", value: "Europe/Istanbul (UTC+3)" },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>{f.label}</div>
                    <input defaultValue={f.value} style={inputStyle} />
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={flash} style={{ padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "white" }}>
                    Сохранить профиль
                  </button>
                  {saved && <span style={{ fontSize: 12, color: "#22c55e" }}>{saved}</span>}
                </div>
              </div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div className="card-title">Безопасность</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {["Текущий пароль", "Новый пароль", "Подтверждение пароля"].map(lbl => (
                  <div key={lbl}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>{lbl}</div>
                    <input type="password" placeholder="••••••••" style={inputStyle} />
                  </div>
                ))}
                <button onClick={flash} style={{ padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "white" }}>
                  Изменить пароль
                </button>
                <div style={{ padding: 12, borderRadius: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#22c55e", marginBottom: 4 }}>Двухфакторная аутентификация</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Защитите аккаунт с помощью 2FA</div>
                  <button style={{ marginTop: 8, padding: "6px 14px", borderRadius: 6, border: "1px solid #22c55e", cursor: "pointer", fontSize: 11, fontWeight: 600, background: "transparent", color: "#22c55e" }}>
                    Включить 2FA
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
