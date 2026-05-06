"use client";

import { useState, useEffect, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import { useApp } from "@/lib/useApp";
import type { StoredPosition } from "@/lib/types";

const LS_TRIGGERS = "triggers-data";
const LS_ALERTS   = "trigger-alerts-data";

const TRIGGER_COLORS = ["#7c3aed","#9d6ef5","#3b82f6","#06b6d4","#f59e0b","#94a3b8","#ef4444","#ec4899","#22c55e","#84cc16"];

function generateTriggersFromPositions(positions: StoredPosition[]) {
  const nonCash = positions.filter(p => p.type !== "Кэш");
  const list: any[] = [];
  nonCash.forEach((p, i) => {
    const color = TRIGGER_COLORS[i % TRIGGER_COLORS.length];
    const stopLoss = (p.avgPrice * 0.90).toFixed(2);
    list.push({
      id: p.id * 10 + 1, ticker: p.ticker, name: p.name,
      type: "Цена ниже", condition: `Цена < ${stopLoss}`,
      currentValue: p.avgPrice.toFixed(2), targetValue: stopLoss,
      priority: "Высокий", status: "Активен", lastTriggered: null, color,
    });
    list.push({
      id: p.id * 10 + 2, ticker: p.ticker, name: p.name,
      type: "Просадка %", condition: "Просадка > 15%",
      currentValue: "0.00%", targetValue: "15.00",
      priority: "Средний", status: "Активен", lastTriggered: null, color,
    });
  });
  list.push({
    id: 9999, ticker: "ПОРТФЕЛЬ", name: "Весь портфель",
    type: "Просадка портфеля", condition: "Просадка > 20%",
    currentValue: "0.00%", targetValue: "20.00",
    priority: "Критический", status: "Активен", lastTriggered: null, color: "#22c55e",
  });
  return list;
}

function loadTriggers() {
  try { const r = localStorage.getItem(LS_TRIGGERS); return r ? JSON.parse(r) : null; } catch { return null; }
}
function loadAlerts() {
  try { const r = localStorage.getItem(LS_ALERTS); return r ? JSON.parse(r) : []; } catch { return []; }
}

const filterTabs = ["ВСЕ", "АКТИВНЫЕ", "НЕАКТИВНЫЕ", "КРИТИЧЕСКИЕ"];
const typeOptions = ["Цена ниже", "Цена выше", "Просадка %", "Рост %", "Объём", "Просадка портфеля"];
const priorityOptions = ["Высокий", "Средний", "Низкий", "Критический"];

export default function TriggersPage() {
  const app = useApp();
  const [activeTab, setActiveTab] = useState("ВСЕ");
  const [showForm, setShowForm] = useState(false);
  const [triggerList, setTriggerList] = useState<any[]>([]);
  const [alertList, setAlertList] = useState<any[]>([]);
  const [formData, setFormData] = useState({ ticker: "", type: "Цена ниже", targetValue: "", priority: "Средний" });
  const [mounted, setMounted] = useState(false);
  const initRef = useRef(false);
  const posCount = app.positions.length;

  // Load or generate triggers once — only on first mount with positions
  useEffect(() => {
    if (initRef.current) return;
    const saved = loadTriggers();
    if (saved && saved.length > 0) {
      setTriggerList(saved);
      setAlertList(loadAlerts());
      initRef.current = true;
      setMounted(true);
      return;
    }
    if (posCount === 0) return; // wait for positions to load
    const positions = app.positions;
    const generated = generateTriggersFromPositions(positions);
    setTriggerList(generated);
    setAlertList(loadAlerts());
    initRef.current = true;
    setMounted(true);
  // posCount is a stable primitive — safe dependency
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posCount]);

  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem(LS_TRIGGERS, JSON.stringify(triggerList)); } catch {}
  }, [triggerList, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem(LS_ALERTS, JSON.stringify(alertList)); } catch {}
  }, [alertList, mounted]);

  const evaluatedTriggers = triggerList.map(t => {
    if (t.status === "Неактивен") return { ...t, liveValue: t.currentValue, fired: false, progress: 0 };

    const livePrice = app.liveQuotes[t.ticker]?.current ?? 0;
    const prevClose = app.liveQuotes[t.ticker]?.previousClose ?? 0;
    const quotesReady = app.quoteStatus === "ok" || app.quoteStatus === "error";

    if (t.type === "Цена ниже") {
      const target = parseFloat(t.targetValue);
      const fired = livePrice > 0 && livePrice < target;
      const pct = livePrice > 0 && target > 0 ? ((target - livePrice) / (target * 0.2)) * 100 : 0;
      const progress = Math.min(100, Math.max(0, pct));
      return { ...t, liveValue: livePrice > 0 ? livePrice.toFixed(2) : (quotesReady ? "–" : "…"), fired, progress };
    }
    if (t.type === "Цена выше") {
      const target = parseFloat(t.targetValue);
      const fired = livePrice > 0 && livePrice > target;
      const progress = livePrice > 0 && target > 0 ? Math.min(100, (livePrice / target) * 100) : 0;
      return { ...t, liveValue: livePrice > 0 ? livePrice.toFixed(2) : (quotesReady ? "–" : "…"), fired, progress };
    }
    if (t.type === "Просадка %") {
      const pos = app.positions.find(p => p.ticker === t.ticker);
      const drawdown = pos && livePrice > 0 ? ((livePrice - pos.avgPrice) / pos.avgPrice) * 100 : 0;
      const target = parseFloat(t.targetValue);
      const hasData = pos && livePrice > 0;
      const progress = hasData ? Math.min(100, (Math.abs(Math.min(0, drawdown)) / target) * 100) : 0;
      return { ...t, liveValue: hasData ? `${drawdown.toFixed(2)}%` : (quotesReady ? "–" : "…"), fired: drawdown < -target && hasData, progress };
    }
    if (t.type === "Рост %") {
      const growth = prevClose > 0 ? ((livePrice - prevClose) / prevClose) * 100 : 0;
      const target = parseFloat(t.targetValue);
      const hasData = livePrice > 0 && prevClose > 0;
      const progress = hasData ? Math.min(100, (Math.max(0, growth) / target) * 100) : 0;
      return { ...t, liveValue: hasData ? `${growth.toFixed(2)}%` : (quotesReady ? "–" : "…"), fired: growth > target && hasData, progress };
    }
    if (t.type === "Просадка портфеля") {
      const portfolioDrawdown = app.totalCost > 0
        ? ((app.portfolioTotal - app.totalCost) / app.totalCost) * 100
        : 0;
      const target = parseFloat(t.targetValue);
      const fired = portfolioDrawdown < -target;
      const progress = Math.min(100, (Math.abs(Math.min(0, portfolioDrawdown)) / target) * 100);
      return { ...t, liveValue: `${portfolioDrawdown.toFixed(2)}%`, fired, progress };
    }
    return { ...t, liveValue: livePrice > 0 ? livePrice.toFixed(2) : t.currentValue, fired: false, progress: 0 };
  });

  const filtered = evaluatedTriggers.filter((t) => {
    if (activeTab === "АКТИВНЫЕ") return t.status === "Активен";
    if (activeTab === "НЕАКТИВНЫЕ") return t.status === "Неактивен";
    if (activeTab === "КРИТИЧЕСКИЕ") return t.priority === "Критический";
    return true;
  });

  const activeCount = triggerList.filter((t) => t.status === "Активен").length;
  const unreadCount = alertList.filter((a) => !a.read).length;

  function toggleTrigger(id: number) {
    setTriggerList((prev) =>
      prev.map((t) => t.id === id ? { ...t, status: t.status === "Активен" ? "Неактивен" : "Активен" } : t)
    );
  }

  function deleteTrigger(id: number) {
    setTriggerList((prev) => prev.filter((t) => t.id !== id));
  }

  function markAlertRead(id: number) {
    setAlertList((prev) => prev.map((a) => a.id === id ? { ...a, read: true } : a));
  }

  function addTrigger() {
    if (!formData.ticker || !formData.targetValue) return;
    const ticker = formData.ticker.toUpperCase();
    const portfolioPos = app.positions.find(p => p.ticker === ticker);
    const newTrigger = {
      id: Date.now(),
      ticker,
      name: portfolioPos?.name ?? ticker,
      type: formData.type,
      condition: `${formData.type} ${formData.targetValue}`,
      currentValue: portfolioPos ? portfolioPos.avgPrice.toFixed(2) : "—",
      targetValue: formData.targetValue,
      priority: formData.priority,
      status: "Активен",
      lastTriggered: null,
      color: portfolioPos?.color ?? "var(--accent)",
    };
    setTriggerList((prev) => [newTrigger, ...prev]);
    setFormData({ ticker: "", type: "Цена ниже", targetValue: "", priority: "Средний" });
    setShowForm(false);
  }

  function activateAll() {
    setTriggerList(prev => prev.map(t => ({ ...t, status: "Активен" })));
  }

  function resetToDefaults() {
    if (!confirm("Сбросить все триггеры к начальным на основе портфеля?")) return;
    try { localStorage.removeItem(LS_TRIGGERS); } catch {}
    const generated = generateTriggersFromPositions(app.positions);
    setTriggerList(generated);
    setAlertList([]);
  }

  const priorityColor: Record<string, string> = {
    "Критический": "#ef4444",
    "Высокий": "#f59e0b",
    "Средний": "#7c3aed",
    "Низкий": "#94a3b8",
  };

  const severityColor: Record<string, string> = {
    "Высокая": "#ef4444",
    "Средняя": "#f59e0b",
    "Низкая": "#94a3b8",
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader title="ТРИГГЕРЫ" subtitle="Автоматические условия и ценовые алерты" showSnapshot />

      <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { label: "Всего триггеров", value: triggerList.length, sub: "настроено" },
            { label: "Активных", value: activeCount, sub: "работают", color: "#22c55e" },
            { label: "Неактивных", value: triggerList.length - activeCount, sub: "остановлены", color: "#94a3b8" },
            { label: "Непрочитанных", value: unreadCount, sub: "новых алертов", color: unreadCount > 0 ? "#ef4444" : "#94a3b8" },
          ].map((m) => (
            <div key={m.label} className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: m.color ?? "var(--text-primary)" }}>{m.value}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Tabs + Add button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8 }}>
            {filterTabs.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                style={{
                  padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                  background: activeTab === t ? "var(--accent)" : "var(--bg-card)",
                  color: activeTab === t ? "white" : "var(--text-secondary)",
                  transition: "all 0.15s",
                }}
              >
                {t}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={activateAll}
              style={{
                padding: "8px 14px", borderRadius: 8, border: "1px solid #22c55e", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: "rgba(34,197,94,0.1)", color: "#22c55e",
              }}
            >
              ▶ Активировать все
            </button>
            <button
              onClick={resetToDefaults}
              style={{
                padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: "transparent", color: "var(--text-secondary)",
              }}
            >
              Сбросить
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              style={{
                padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: showForm ? "rgba(239,68,68,0.15)" : "var(--accent)",
                color: showForm ? "#ef4444" : "white",
              }}
            >
              {showForm ? "✕ Отмена" : "+ Новый триггер"}
            </button>
          </div>
        </div>

        {/* Add trigger form */}
        {showForm && (
          <div className="card" style={{ padding: 16 }}>
            <div className="card-title">Создать новый триггер</div>
            {/* Portfolio ticker chips */}
            {app.positions.filter(p => p.type !== "Кэш").length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>Инструменты портфеля:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {app.positions.filter(p => p.type !== "Кэш").map(p => (
                    <button
                      key={p.id}
                      onClick={() => setFormData(f => ({ ...f, ticker: p.ticker }))}
                      style={{
                        padding: "3px 10px", borderRadius: 20, border: "1px solid var(--border)",
                        background: formData.ticker === p.ticker ? "var(--accent)" : "var(--bg-secondary)",
                        color: formData.ticker === p.ticker ? "#fff" : "var(--text-secondary)",
                        fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                      }}
                    >{p.ticker}</button>
                  ))}
                  <button
                    onClick={() => setFormData(f => ({ ...f, ticker: "ПОРТФЕЛЬ" }))}
                    style={{
                      padding: "3px 10px", borderRadius: 20, border: "1px solid var(--border)",
                      background: formData.ticker === "ПОРТФЕЛЬ" ? "#22c55e" : "var(--bg-secondary)",
                      color: formData.ticker === "ПОРТФЕЛЬ" ? "#fff" : "var(--text-secondary)",
                      fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                    }}
                  >ПОРТФЕЛЬ</button>
                </div>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>Тикер</div>
                <input
                  value={formData.ticker}
                  onChange={(e) => setFormData({ ...formData, ticker: e.target.value })}
                  placeholder="VOO, QQQ..."
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
                    background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>Тип условия</div>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
                    background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13,
                  }}
                >
                  {typeOptions.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>Целевое значение</div>
                <input
                  value={formData.targetValue}
                  onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
                  placeholder="580, 10%, ..."
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
                    background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>Приоритет</div>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
                    background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13,
                  }}
                >
                  {priorityOptions.map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <button
                onClick={addTrigger}
                style={{
                  padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  background: "var(--accent)", color: "white", whiteSpace: "nowrap",
                }}
              >
                Добавить
              </button>
            </div>
          </div>
        )}

        {/* Empty portfolio hint */}
        {app.positions.length === 0 && (
          <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 13, marginBottom: 6 }}>Портфель пуст</div>
            <div style={{ fontSize: 11 }}>Добавьте инструменты в раздел «Позиции» — триггеры сформируются автоматически</div>
          </div>
        )}

        {/* Main content grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }}>
          {/* Triggers table */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div className="card-title" style={{ margin: 0 }}>Список триггеров</div>
              <span style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
                background: app.quoteStatus === "ok" ? "rgba(34,197,94,0.12)" : app.quoteStatus === "loading" ? "rgba(245,158,11,0.12)" : "rgba(148,163,184,0.12)",
                color: app.quoteStatus === "ok" ? "#22c55e" : app.quoteStatus === "loading" ? "#f59e0b" : "#94a3b8",
              }}>
                {app.quoteStatus === "ok" ? "Котировки ✓" : app.quoteStatus === "loading" ? "Загрузка котировок…" : "Ожидание котировок"}
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                    {["Тикер", "Тип", "Условие", "Текущее", "Цель", "Приоритет", "Статус", "Действия"].map((h) => (
                      <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "white", flexShrink: 0 }}>
                            {t.ticker.slice(0, 2)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700 }}>{t.ticker}</div>
                            <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{t.name.length > 20 ? t.name.slice(0, 20) + "…" : t.name}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "8px 10px", color: "var(--text-secondary)", fontSize: 11 }}>{t.type}</td>
                      <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 11, color: "var(--accent-light)" }}>{t.condition}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ color: (t as any).fired ? "#ef4444" : "var(--text-primary)" }}>{(t as any).liveValue ?? t.currentValue}</span>
                        {(t as any).fired && <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 10, fontSize: 9, fontWeight: 700, background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>Сработал</span>}
                      </td>
                      <td style={{ padding: "8px 10px", fontWeight: 600 }}>{t.targetValue}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: priorityColor[t.priority] }}>{t.priority}</span>
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                          background: t.status === "Активен" ? "rgba(34,197,94,0.15)" : "rgba(148,163,184,0.15)",
                          color: t.status === "Активен" ? "#22c55e" : "#94a3b8",
                        }}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => toggleTrigger(t.id)}
                            style={{
                              padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", fontSize: 10,
                              background: "transparent", color: t.status === "Активен" ? "#f59e0b" : "#22c55e",
                            }}
                          >
                            {t.status === "Активен" ? "Стоп" : "Старт"}
                          </button>
                          <button
                            onClick={() => deleteTrigger(t.id)}
                            style={{
                              padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", fontSize: 10,
                              background: "transparent", color: "#ef4444",
                            }}
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}>Нет триггеров в этой категории</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alerts panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div className="card-title" style={{ margin: 0 }}>Последние алерты</div>
                {unreadCount > 0 && (
                  <span style={{ padding: "2px 8px", borderRadius: 20, background: "rgba(239,68,68,0.15)", color: "#ef4444", fontSize: 10, fontWeight: 700 }}>
                    {unreadCount} новых
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {alertList.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => markAlertRead(a.id)}
                    style={{
                      padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                      background: a.read ? "var(--bg-secondary)" : "rgba(124,58,237,0.1)",
                      border: `1px solid ${a.read ? "var(--border)" : "var(--accent)"}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 11, color: "var(--accent-light)" }}>{a.ticker}</div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: severityColor[a.severity] }}>{a.severity}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-primary)", margin: "4px 0" }}>{a.message}</div>
                    <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{a.time}</div>
                    {!a.read && (
                      <div style={{ fontSize: 10, color: "var(--accent-light)", marginTop: 4 }}>Нажмите, чтобы отметить прочитанным</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div className="card-title">Типы триггеров</div>
              {["Цена ниже", "Цена выше", "Просадка %", "Рост %", "Объём"].map((type) => {
                const count = triggerList.filter((t) => t.type === type).length;
                return (
                  <div key={type} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: 12 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{type}</span>
                    <span style={{ fontWeight: 700 }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
