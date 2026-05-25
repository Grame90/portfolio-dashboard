"use client";

import { useState, useEffect, useMemo } from "react";
import { useApp } from "@/lib/useApp";

type AlertLevel = "green" | "yellow" | "red";

interface AlertItem {
  icon: string;
  text: string;
  level: AlertLevel;
}

interface Recommendation {
  text: string;
}

const DISMISS_KEY = "daily-alert-dismissed";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === todayKey();
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, todayKey());
  } catch {}
}

const LEVEL_ORDER: Record<AlertLevel, number> = { green: 0, yellow: 1, red: 2 };

export default function DailyAlert() {
  const app = useApp();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setVisible(!isDismissed());
  }, []);

  const { level, alerts, recommendations, summary } = useMemo(() => {
    const total = app.portfolioTotal;
    const positions = app.positions;
    const liveQuotes = app.liveQuotes;

    if (!total || !positions.length) {
      return { level: "green" as AlertLevel, alerts: [], recommendations: [], summary: "Портфель пуст" };
    }

    const dailyPct = app.dailyChangePct;
    const totalPnlPct = app.totalPnlPct;

    // Concentration: top-3 positions
    const posVals = positions
      .map(p => ({ ticker: p.ticker, val: p.qty * (liveQuotes[p.ticker]?.current ?? p.avgPrice) }))
      .sort((a, b) => b.val - a.val);
    const top3pct = total > 0
      ? posVals.slice(0, 3).reduce((s, p) => s + p.val, 0) / total * 100
      : 0;

    // Cash share
    const cashVal = positions
      .filter(p => p.type === "Кэш")
      .reduce((s, p) => s + p.qty * (liveQuotes[p.ticker]?.current ?? p.avgPrice), 0);
    const cashPct = total > 0 ? cashVal / total * 100 : 100;

    // Crypto share
    const cryptoPct = total > 0
      ? positions.filter(p => p.type === "Крипто")
          .reduce((s, p) => s + p.qty * (liveQuotes[p.ticker]?.current ?? p.avgPrice), 0) / total * 100
      : 0;

    // Positions in red today
    const redCount = positions.filter(p => {
      const q = liveQuotes[p.ticker];
      if (!q) return false;
      return q.current < (q.previousClose ?? q.current);
    }).length;

    const collected: AlertItem[] = [];

    // Daily change
    if (dailyPct <= -4)
      collected.push({ icon: "🔴", text: `Резкое дневное падение: ${dailyPct.toFixed(2)}% (критический порог −4%)`, level: "red" });
    else if (dailyPct <= -2)
      collected.push({ icon: "🟡", text: `Значительное дневное снижение: ${dailyPct.toFixed(2)}% (порог −2%)`, level: "yellow" });
    else if (dailyPct >= 3)
      collected.push({ icon: "🟢", text: `Сильный рост за день: +${dailyPct.toFixed(2)}%`, level: "green" });

    // Total P&L
    if (totalPnlPct <= -20)
      collected.push({ icon: "🔴", text: `Общая просадка ${totalPnlPct.toFixed(1)}% — критический уровень`, level: "red" });
    else if (totalPnlPct <= -10)
      collected.push({ icon: "🟡", text: `Общая просадка ${totalPnlPct.toFixed(1)}% — требует внимания`, level: "yellow" });

    // Concentration
    if (top3pct >= 80)
      collected.push({ icon: "🔴", text: `Концентрация топ-3: ${top3pct.toFixed(1)}% — критически высокая`, level: "red" });
    else if (top3pct >= 65)
      collected.push({ icon: "🟡", text: `Концентрация топ-3: ${top3pct.toFixed(1)}% — выше нормы (65%)`, level: "yellow" });

    // Cash
    if (cashPct < 2)
      collected.push({ icon: "🔴", text: `Кэш: ${cashPct.toFixed(1)}% — опасно низкий, нет буфера`, level: "red" });
    else if (cashPct < 5)
      collected.push({ icon: "🟡", text: `Кэш: ${cashPct.toFixed(1)}% — ниже рекомендуемых 5%`, level: "yellow" });

    // Crypto exposure
    if (cryptoPct >= 50)
      collected.push({ icon: "🔴", text: `Доля крипто: ${cryptoPct.toFixed(1)}% — высокий риск волатильности`, level: "red" });
    else if (cryptoPct >= 30)
      collected.push({ icon: "🟡", text: `Доля крипто: ${cryptoPct.toFixed(1)}% — умеренно высокий риск`, level: "yellow" });

    // Red positions
    if (redCount >= positions.length * 0.7 && redCount > 3)
      collected.push({ icon: "🟡", text: `${redCount} из ${positions.length} позиций в минусе сегодня`, level: "yellow" });

    // Determine overall level
    const overallLevel: AlertLevel = collected.reduce<AlertLevel>((max, a) => {
      return LEVEL_ORDER[a.level] > LEVEL_ORDER[max] ? a.level : max;
    }, "green");

    // Recommendations
    const recs: Recommendation[] = [];
    if (overallLevel === "red") {
      recs.push({ text: "Не открывать новых позиций — рынок в стрессе" });
      recs.push({ text: "Проверить Stop-Loss по убыточным позициям" });
      if (cashPct < 5) recs.push({ text: "Рассмотреть продажу части активов для пополнения кэша" });
    } else if (overallLevel === "yellow") {
      recs.push({ text: "Соблюдать осторожность при докупке" });
      if (cashPct < 5) recs.push({ text: "Наращивать кэш-позицию до 5%+" });
      if (top3pct >= 65) recs.push({ text: "Рассмотреть диверсификацию крупнейших позиций" });
    } else {
      recs.push({ text: "Портфель в норме — плановый мониторинг" });
      if (dailyPct >= 2) recs.push({ text: "Фиксируй часть прибыли если позиция перекуплена" });
    }

    const summary =
      overallLevel === "red" ? "Повышенный риск — требуются действия" :
      overallLevel === "yellow" ? "Умеренный риск — держи руку на пульсе" :
      "Портфель стабилен";

    return { level: overallLevel, alerts: collected, recommendations: recs, summary };
  }, [app.portfolioTotal, app.positions, app.liveQuotes, app.dailyChangePct, app.totalPnlPct]);

  if (!mounted || !visible) return null;

  const colors: Record<AlertLevel, { bg: string; border: string; dot: string; badge: string; label: string }> = {
    green:  { bg: "rgba(34,197,94,0.07)",   border: "#22c55e44", dot: "#22c55e", badge: "#15803d", label: "СТАБИЛЬНО" },
    yellow: { bg: "rgba(245,158,11,0.08)",  border: "#f59e0b55", dot: "#f59e0b", badge: "#b45309", label: "ВНИМАНИЕ" },
    red:    { bg: "rgba(239,68,68,0.08)",   border: "#ef444455", dot: "#ef4444", badge: "#b91c1c", label: "КРИЗИС" },
  };
  const c = colors[level];

  const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const timeStr = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 12,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      position: "relative",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%", background: c.dot,
            boxShadow: `0 0 8px ${c.dot}`, flexShrink: 0,
            animation: level !== "green" ? "pulse 1.8s infinite" : undefined,
          }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: c.dot }}>
            КРИЗИС-АЛЕРТ
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
            background: c.dot, color: "white",
          }}>
            {c.label}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {today}, {timeStr}
          </span>
        </div>

        <button
          onClick={() => { dismiss(); setVisible(false); }}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", fontSize: 18, lineHeight: 1, padding: "0 4px",
          }}
          title="Скрыть до завтра"
        >
          ×
        </button>
      </div>

      {/* Summary */}
      <div style={{ fontSize: 13, fontWeight: 600, color: c.dot }}>{summary}</div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {alerts.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
              <span style={{ flexShrink: 0 }}>{a.icon}</span>
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}

      {alerts.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          ✅ Все триггеры в норме — нарушений не обнаружено
        </div>
      )}

      {/* Divider */}
      <div style={{ height: 1, background: c.border }} />

      {/* Recommendations */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Рекомендации
        </div>
        {recommendations.map((r, i) => (
          <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 6 }}>
            <span style={{ color: c.dot, flexShrink: 0 }}>→</span>
            <span>{r.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Compact badge for PageHeader ─────────────────────────────────────────────
// Shows a small colored pill inline with the page title.
// Clicking it opens a popover with the full alert details.

export function DailyAlertBadge() {
  const app = useApp();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const { level, alerts, recommendations, summary } = useMemo(() => {
    const total = app.portfolioTotal;
    const positions = app.positions;
    const liveQuotes = app.liveQuotes;

    if (!total || !positions.length) {
      return { level: "green" as AlertLevel, alerts: [] as AlertItem[], recommendations: [] as { text: string }[], summary: "Нет данных" };
    }

    const dailyPct = app.dailyChangePct;
    const totalPnlPct = app.totalPnlPct;

    const posVals = positions
      .map(p => ({ ticker: p.ticker, val: p.qty * (liveQuotes[p.ticker]?.current ?? p.avgPrice) }))
      .sort((a, b) => b.val - a.val);
    const top3pct = total > 0 ? posVals.slice(0, 3).reduce((s, p) => s + p.val, 0) / total * 100 : 0;

    const cashVal = positions
      .filter(p => p.type === "Кэш")
      .reduce((s, p) => s + p.qty * (liveQuotes[p.ticker]?.current ?? p.avgPrice), 0);
    const cashPct = total > 0 ? cashVal / total * 100 : 100;

    const cryptoPct = total > 0
      ? positions.filter(p => p.type === "Крипто")
          .reduce((s, p) => s + p.qty * (liveQuotes[p.ticker]?.current ?? p.avgPrice), 0) / total * 100
      : 0;

    const redCount = positions.filter(p => {
      const q = liveQuotes[p.ticker];
      return q ? q.current < (q.previousClose ?? q.current) : false;
    }).length;

    const collected: AlertItem[] = [];
    if (dailyPct <= -4)   collected.push({ icon: "🔴", text: `Резкое дневное падение: ${dailyPct.toFixed(2)}%`, level: "red" });
    else if (dailyPct <= -2) collected.push({ icon: "🟡", text: `Дневное снижение: ${dailyPct.toFixed(2)}%`, level: "yellow" });
    else if (dailyPct >= 3)  collected.push({ icon: "🟢", text: `Сильный рост: +${dailyPct.toFixed(2)}%`, level: "green" });
    if (totalPnlPct <= -20) collected.push({ icon: "🔴", text: `Просадка ${totalPnlPct.toFixed(1)}% — критическая`, level: "red" });
    else if (totalPnlPct <= -10) collected.push({ icon: "🟡", text: `Просадка ${totalPnlPct.toFixed(1)}%`, level: "yellow" });
    if (top3pct >= 80) collected.push({ icon: "🔴", text: `Концентрация топ-3: ${top3pct.toFixed(1)}%`, level: "red" });
    else if (top3pct >= 65) collected.push({ icon: "🟡", text: `Концентрация: ${top3pct.toFixed(1)}%`, level: "yellow" });
    if (cashPct < 2) collected.push({ icon: "🔴", text: `Кэш: ${cashPct.toFixed(1)}% — опасно мало`, level: "red" });
    else if (cashPct < 5) collected.push({ icon: "🟡", text: `Кэш: ${cashPct.toFixed(1)}% (рек. 5%+)`, level: "yellow" });
    if (cryptoPct >= 50) collected.push({ icon: "🔴", text: `Крипто: ${cryptoPct.toFixed(1)}%`, level: "red" });
    else if (cryptoPct >= 30) collected.push({ icon: "🟡", text: `Крипто: ${cryptoPct.toFixed(1)}%`, level: "yellow" });
    if (redCount >= positions.length * 0.7 && redCount > 3)
      collected.push({ icon: "🟡", text: `${redCount}/${positions.length} позиций в минусе`, level: "yellow" });

    const overallLevel: AlertLevel = collected.reduce<AlertLevel>((max, a) =>
      LEVEL_ORDER[a.level] > LEVEL_ORDER[max] ? a.level : max, "green");

    const recs: { text: string }[] = [];
    if (overallLevel === "red") {
      recs.push({ text: "Не открывать новых позиций" });
      recs.push({ text: "Проверить Stop-Loss" });
      if (cashPct < 5) recs.push({ text: "Пополнить кэш-буфер" });
    } else if (overallLevel === "yellow") {
      recs.push({ text: "Соблюдать осторожность при докупке" });
      if (cashPct < 5) recs.push({ text: "Наращивать кэш до 5%+" });
    } else {
      recs.push({ text: "Плановый мониторинг" });
    }

    const summary =
      overallLevel === "red" ? "Повышенный риск" :
      overallLevel === "yellow" ? "Умеренный риск" : "Стабильно";

    return { level: overallLevel, alerts: collected, recommendations: recs, summary };
  }, [app.portfolioTotal, app.positions, app.liveQuotes, app.dailyChangePct, app.totalPnlPct]);

  if (!mounted) return null;

  const colors: Record<AlertLevel, { dot: string; badgeBg: string; badgeText: string; border: string; label: string }> = {
    green:  { dot: "#22c55e", badgeBg: "rgba(34,197,94,0.15)",  badgeText: "#22c55e", border: "#22c55e44", label: "Стабильно" },
    yellow: { dot: "#f59e0b", badgeBg: "rgba(245,158,11,0.15)", badgeText: "#f59e0b", border: "#f59e0b55", label: "Внимание" },
    red:    { dot: "#ef4444", badgeBg: "rgba(239,68,68,0.15)",  badgeText: "#ef4444", border: "#ef444455", label: "Кризис" },
  };
  const c = colors[level];
  const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Badge pill */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 20,
          background: c.badgeBg, border: `1px solid ${c.border}`,
          cursor: "pointer", userSelect: "none",
        }}
      >
        <span style={{
          width: 7, height: 7, borderRadius: "50%", background: c.dot, flexShrink: 0,
          boxShadow: level !== "green" ? `0 0 6px ${c.dot}` : undefined,
        }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: c.badgeText, whiteSpace: "nowrap" }}>
          {c.label}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {today}
        </span>
        {alerts.length > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 700, background: c.dot, color: "white",
            borderRadius: "50%", width: 15, height: 15,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {alerts.length}
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 199 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 200,
            background: "var(--bg-card)", border: `1px solid ${c.border}`,
            borderRadius: 12, padding: 16, minWidth: 320, maxWidth: 400,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            animation: "fadeIn 0.15s ease",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: c.dot, letterSpacing: "0.07em" }}>
                КРИЗИС-АЛЕРТ
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                background: c.dot, color: "white", marginLeft: "auto",
              }}>
                {c.label.toUpperCase()}
              </span>
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: c.dot, marginBottom: 10 }}>{summary}</div>

            {/* Alerts */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
              {alerts.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>✅ Все триггеры в норме</div>
              ) : alerts.map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--text-secondary)" }}>
                  <span style={{ flexShrink: 0 }}>{a.icon}</span>
                  <span>{a.text}</span>
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: c.border, marginBottom: 10 }} />

            {/* Recommendations */}
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
              Рекомендации
            </div>
            {recommendations.map((r, i) => (
              <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 6, marginBottom: 4 }}>
                <span style={{ color: c.dot, flexShrink: 0 }}>→</span>
                <span>{r.text}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
