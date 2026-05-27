"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { mutate } from "swr";
import { useApp } from "@/lib/useApp";

type AlertLevel = "green" | "yellow" | "red";

type DipSignal = "buy" | "weak" | "none";
interface DipInstrument {
  ticker: string;
  price: number;
  dailyChangePct: number;
  dipThreshold: number;
  dipReached: boolean;
  rsi14: number | null;
  ma200: number | null;
  aboveMa200: boolean | null;
  allocPct: number;
  signal: DipSignal;
  reason: string;
}
interface MarketDip {
  vix: number | null;
  vixZone: "risk-on" | "neutral" | "risk-off" | "unknown";
  overall: DipSignal;
  instruments: DipInstrument[];
  updatedAt: number;
}

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

interface Indicator {
  id: string;
  label: string;
  value: string;
  level: AlertLevel;
  note: string;
}

export function DailyAlertBadge() {
  const app = useApp();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Force-refresh all underlying data feeding the indicators: SWR caches for
  // /api/quotes and /api/crypto + positions from localStorage. Click of the
  // refresh icon in the popover.
  async function handleRefresh(e: React.MouseEvent) {
    e.stopPropagation();
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([
        mutate((key) =>
          typeof key === "string" &&
          (key.startsWith("/api/quotes") || key.startsWith("/api/crypto")),
        ),
        Promise.resolve(app.refreshPositions?.()),
        loadDip(),
      ]);
    } finally {
      // brief delay so the spinner is visible even on fast networks
      setTimeout(() => setRefreshing(false), 350);
    }
  }
  // Delay close so the cursor can cross the small gap between badge and popover
  // without the popover snapping shut mid-traversal.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }
  function cancelClose() {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  useEffect(() => { setMounted(true); }, []);

  // Market Dip Indicator — fetched from /api/market-dip while the popover is
  // open (and on manual refresh). Holds QQQ/SOXX/SMH dip signals + VIX.
  const [dip, setDip] = useState<MarketDip | null>(null);
  const [dipLoading, setDipLoading] = useState(false);
  async function loadDip() {
    setDipLoading(true);
    try {
      const res = await fetch("/api/market-dip");
      if (res.ok) setDip(await res.json());
    } catch {
      /* keep last */
    } finally {
      setDipLoading(false);
    }
  }
  useEffect(() => {
    if (open && !dip && !dipLoading) loadDip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Live ticker for countdown to next planned check. Only runs while popover is
  // open to avoid useless re-renders.
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    setNowTs(Date.now());
    const id = setInterval(() => setNowTs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [open]);

  // Next planned monitoring = next 03:00 Istanbul = next 00:00 UTC (Turkey is
  // fixed UTC+3, no DST). This matches the daily auto-snapshot schedule.
  const countdownText = useMemo(() => {
    const next = new Date(nowTs);
    next.setUTCHours(0, 0, 0, 0);
    if (next.getTime() <= nowTs) next.setUTCDate(next.getUTCDate() + 1);
    const ms = next.getTime() - nowTs;
    if (ms <= 0) return "скоро";
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    if (h >= 1) return `${h} ч ${m} мин`;
    return `${m} мин`;
  }, [nowTs]);

  const { level, indicators, alertCount, recommendations, summary } = useMemo(() => {
    const total = app.portfolioTotal;
    const positions = app.positions;
    const liveQuotes = app.liveQuotes;

    if (!total || !positions.length) {
      return {
        level: "green" as AlertLevel,
        indicators: [] as Indicator[],
        alertCount: 0,
        recommendations: [] as { text: string }[],
        summary: "Нет данных",
      };
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

    // Build the complete indicator list — every metric, always, with current state.
    const ind: Indicator[] = [];

    // 1. Daily change
    {
      let lv: AlertLevel = "green";
      let note = "норма (>−2%)";
      if (dailyPct <= -4) { lv = "red"; note = "крит. падение (≤−4%)"; }
      else if (dailyPct <= -2) { lv = "yellow"; note = "снижение (≤−2%)"; }
      else if (dailyPct >= 3) { lv = "green"; note = "сильный рост"; }
      ind.push({
        id: "daily",
        label: "Дневное изменение",
        value: `${dailyPct >= 0 ? "+" : ""}${dailyPct.toFixed(2)}%`,
        level: lv,
        note,
      });
    }

    // 2. Total P&L
    {
      let lv: AlertLevel = "green";
      let note = "норма (>−10%)";
      if (totalPnlPct <= -20) { lv = "red"; note = "крит. просадка (≤−20%)"; }
      else if (totalPnlPct <= -10) { lv = "yellow"; note = "просадка (≤−10%)"; }
      ind.push({
        id: "totalPnl",
        label: "Общий P&L",
        value: `${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(1)}%`,
        level: lv,
        note,
      });
    }

    // 3. Concentration of top-3 positions
    {
      let lv: AlertLevel = "green";
      let note = "норма (<65%)";
      if (top3pct >= 80) { lv = "red"; note = "крит. (≥80%)"; }
      else if (top3pct >= 65) { lv = "yellow"; note = "выше нормы (≥65%)"; }
      ind.push({
        id: "concentration",
        label: "Концентрация топ-3",
        value: `${top3pct.toFixed(1)}%`,
        level: lv,
        note,
      });
    }

    // 4. Cash buffer
    {
      let lv: AlertLevel = "green";
      let note = "норма (≥5%)";
      if (cashPct < 2) { lv = "red"; note = "опасно мало (<2%)"; }
      else if (cashPct < 5) { lv = "yellow"; note = "ниже нормы (<5%)"; }
      ind.push({
        id: "cash",
        label: "Кэш-буфер",
        value: `${cashPct.toFixed(1)}%`,
        level: lv,
        note,
      });
    }

    // 5. Crypto exposure
    {
      let lv: AlertLevel = "green";
      let note = "норма (<30%)";
      if (cryptoPct >= 50) { lv = "red"; note = "крит. (≥50%)"; }
      else if (cryptoPct >= 30) { lv = "yellow"; note = "повышенная (≥30%)"; }
      ind.push({
        id: "crypto",
        label: "Доля крипто",
        value: `${cryptoPct.toFixed(1)}%`,
        level: lv,
        note,
      });
    }

    // 6. Red positions today
    {
      const ratio = positions.length > 0 ? redCount / positions.length : 0;
      let lv: AlertLevel = "green";
      let note = "норма";
      if (ratio >= 0.7 && redCount > 3) { lv = "yellow"; note = "≥70% в минусе"; }
      ind.push({
        id: "redPositions",
        label: "Позиции в минусе",
        value: `${redCount} / ${positions.length}`,
        level: lv,
        note,
      });
    }

    const overallLevel: AlertLevel = ind.reduce<AlertLevel>((max, i) =>
      LEVEL_ORDER[i.level] > LEVEL_ORDER[max] ? i.level : max, "green");

    const alertCount = ind.filter(i => i.level !== "green").length;

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

    return { level: overallLevel, indicators: ind, alertCount, recommendations: recs, summary };
  }, [app.portfolioTotal, app.positions, app.liveQuotes, app.dailyChangePct, app.totalPnlPct]);

  if (!mounted) return null;

  const colors: Record<AlertLevel, { dot: string; badgeBg: string; badgeText: string; border: string; label: string }> = {
    green:  { dot: "#22c55e", badgeBg: "rgba(34,197,94,0.15)",  badgeText: "#22c55e", border: "#22c55e44", label: "Стабильно" },
    yellow: { dot: "#f59e0b", badgeBg: "rgba(245,158,11,0.15)", badgeText: "#f59e0b", border: "#f59e0b55", label: "Внимание" },
    red:    { dot: "#ef4444", badgeBg: "rgba(239,68,68,0.15)",  badgeText: "#ef4444", border: "#ef444455", label: "Кризис" },
  };
  const c = colors[level];
  const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

  const indicatorDot: Record<AlertLevel, string> = {
    green: "#22c55e",
    yellow: "#f59e0b",
    red: "#ef4444",
  };

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
      {/* Badge pill — click toggles on touch devices that have no hover */}
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
        {alertCount > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 700, background: c.dot, color: "white",
            borderRadius: "50%", width: 15, height: 15,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {alertCount}
          </span>
        )}
      </button>

      {/* Popover — opens on hover, stays open while cursor is over badge or popover */}
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, marginTop: 8, zIndex: 200,
          background: "var(--bg-card)", border: `1px solid ${c.border}`,
          borderRadius: 12, padding: 14, minWidth: 320, maxWidth: 420,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          animation: "fadeIn 0.15s ease",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: c.dot, letterSpacing: "0.07em" }}>
              КРИЗИС-АЛЕРТ
            </span>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Обновить данные сейчас"
              style={{
                marginLeft: "auto",
                width: 22, height: 22, borderRadius: 6,
                border: "1px solid var(--border)", background: "transparent",
                color: "var(--text-muted)", cursor: refreshing ? "wait" : "pointer",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, padding: 0,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  transition: "transform 0.1s linear",
                  animation: refreshing ? "spin 0.8s linear infinite" : undefined,
                }}
              >
                ↻
              </span>
            </button>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              background: c.dot, color: "white",
            }}>
              {c.label.toUpperCase()}
            </span>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: c.dot, marginBottom: 10 }}>{summary}</div>

          {/* All indicators with current state */}
          {indicators.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Нет данных по портфелю</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {indicators.map(ind => (
                <div key={ind.id} style={{
                  display: "grid", gridTemplateColumns: "10px 1fr auto",
                  gap: 8, alignItems: "center", fontSize: 12,
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: indicatorDot[ind.level], flexShrink: 0,
                  }} />
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{ind.label}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{ind.note}</span>
                  </div>
                  <span style={{
                    fontVariantNumeric: "tabular-nums", fontWeight: 700,
                    color: indicatorDot[ind.level], whiteSpace: "nowrap",
                  }}>
                    {ind.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ height: 1, background: c.border, marginBottom: 10 }} />

          {/* Market Dip Indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Сигнал на вход (dip)
            </span>
            {dip && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 20, marginLeft: "auto",
                background: dipBg(dip.overall), color: dipColor(dip.overall),
              }}>
                {dipLabel(dip.overall)}
              </span>
            )}
          </div>

          {dipLoading && !dip ? (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>Загрузка сигналов…</div>
          ) : dip ? (
            <div style={{ marginBottom: 10 }}>
              {/* VIX row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
                <span style={{ color: "var(--text-secondary)" }}>VIX (страх рынка)</span>
                <span style={{ fontWeight: 700, color: vixColor(dip.vixZone) }}>
                  {dip.vix !== null ? dip.vix.toFixed(1) : "—"}
                  <span style={{ fontSize: 9, marginLeft: 5, color: "var(--text-muted)" }}>{vixZoneLabel(dip.vixZone)}</span>
                </span>
              </div>
              {/* Per-instrument rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {dip.instruments.map((ins) => (
                  <div key={ins.ticker} style={{
                    border: `1px solid ${dipColor(ins.signal)}30`,
                    background: `${dipBg(ins.signal)}`,
                    borderRadius: 7, padding: "6px 8px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>
                        {ins.ticker}
                        <span style={{
                          fontSize: 11, fontWeight: 700, marginLeft: 6,
                          color: ins.dailyChangePct < 0 ? "#ef4444" : "#22c55e",
                        }}>
                          {ins.dailyChangePct > 0 ? "+" : ""}{ins.dailyChangePct.toFixed(2)}%
                        </span>
                        <span style={{ fontSize: 9, color: "var(--text-muted)", marginLeft: 5 }}>
                          порог {ins.dipThreshold}%
                        </span>
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 20,
                        background: dipBg(ins.signal), color: dipColor(ins.signal),
                      }}>
                        {dipLabel(ins.signal)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 10, fontSize: 9, color: "var(--text-muted)", marginTop: 3 }}>
                      <span>RSI {ins.rsi14 !== null ? ins.rsi14.toFixed(0) : "—"}</span>
                      <span>{ins.aboveMa200 === null ? "MA200 —" : ins.aboveMa200 ? "выше MA200" : "ниже MA200"}</span>
                      {ins.signal === "buy" && <span style={{ color: "#22c55e" }}>вход {ins.allocPct}% капитала</span>}
                    </div>
                    {ins.signal !== "none" && (
                      <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 2 }}>{ins.reason}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>Нет данных по сигналам</div>
          )}

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

          {/* Countdown to next planned monitoring */}
          <div style={{
            marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${c.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: 11,
          }}>
            <span style={{ color: "var(--text-muted)" }}>Плановый мониторинг будет через</span>
            <span style={{
              color: c.dot, fontWeight: 700, fontVariantNumeric: "tabular-nums",
            }}>
              {countdownText}
            </span>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Market Dip signal helpers ───────────────────────────────────────────

function dipLabel(s: DipSignal): string {
  return s === "buy" ? "✅ ПОКУПКА" : s === "weak" ? "⚠️ СЛАБО" : "🚫 ЖДЁМ";
}
function dipColor(s: DipSignal): string {
  return s === "buy" ? "#22c55e" : s === "weak" ? "#f59e0b" : "#94a3b8";
}
function dipBg(s: DipSignal): string {
  return s === "buy"
    ? "rgba(34,197,94,0.12)"
    : s === "weak"
    ? "rgba(245,158,11,0.12)"
    : "rgba(148,163,184,0.10)";
}
function vixZoneLabel(z: MarketDip["vixZone"]): string {
  return z === "risk-on" ? "risk-on" : z === "neutral" ? "neutral" : z === "risk-off" ? "risk-off" : "—";
}
function vixColor(z: MarketDip["vixZone"]): string {
  return z === "risk-on" ? "#22c55e" : z === "neutral" ? "#f59e0b" : z === "risk-off" ? "#ef4444" : "#94a3b8";
}
