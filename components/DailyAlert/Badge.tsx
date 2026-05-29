"use client";

import { useState, useEffect, useMemo, useRef, type MouseEvent } from "react";
import { mutate } from "swr";
import { useApp } from "@/lib/useApp";
import { usePortfolioRisk } from "./usePortfolioRisk";
import { dipBg, dipColor, dipLabel, vixColor, vixZoneLabel } from "./utils";
import type { AlertLevel, MarketDip } from "./types";

const COLORS: Record<AlertLevel, { dot: string; badgeBg: string; badgeText: string; border: string; label: string }> = {
  green:  { dot: "#22c55e", badgeBg: "rgba(34,197,94,0.15)",  badgeText: "#22c55e", border: "#22c55e44", label: "Стабильно" },
  yellow: { dot: "#f59e0b", badgeBg: "rgba(245,158,11,0.15)", badgeText: "#f59e0b", border: "#f59e0b55", label: "Внимание"  },
  red:    { dot: "#ef4444", badgeBg: "rgba(239,68,68,0.15)",  badgeText: "#ef4444", border: "#ef444455", label: "Кризис"    },
};

const INDICATOR_DOT: Record<AlertLevel, string> = {
  green:  "#22c55e",
  yellow: "#f59e0b",
  red:    "#ef4444",
};

export function Badge() {
  const app = useApp();
  const risk = usePortfolioRisk();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  async function handleRefresh(e: MouseEvent) {
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
      setTimeout(() => setRefreshing(false), 350);
    }
  }

  // Delay close so the cursor can cross the small gap between badge and popover.
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

  useEffect(() => {
    if (open && !dip && !dipLoading) loadDip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    if (!open) return;
    setNowTs(Date.now());
    const id = setInterval(() => setNowTs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [open]);

  // Next planned monitoring = next 03:00 Istanbul = next 00:00 UTC (Turkey is fixed UTC+3).
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

  if (!mounted) return null;

  const c = COLORS[risk.level];
  const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => { cancelClose(); setOpen(true); }}
      onMouseLeave={scheduleClose}
    >
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
          boxShadow: risk.level !== "green" ? `0 0 6px ${c.dot}` : undefined,
        }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: c.badgeText, whiteSpace: "nowrap" }}>
          {c.label}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {today}
        </span>
        {risk.alertCount > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 700, background: c.dot, color: "white",
            borderRadius: "50%", width: 15, height: 15,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {risk.alertCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, marginTop: 8, zIndex: 200,
          background: "var(--bg-card)", border: `1px solid ${c.border}`,
          borderRadius: 12, padding: 14, minWidth: 320, maxWidth: 420,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          animation: "fadeIn 0.15s ease",
        }}>
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
              <span style={{
                display: "inline-block",
                transition: "transform 0.1s linear",
                animation: refreshing ? "spin 0.8s linear infinite" : undefined,
              }}>↻</span>
            </button>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
              background: c.dot, color: "white",
            }}>
              {c.label.toUpperCase()}
            </span>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: c.dot, marginBottom: 10 }}>{risk.summary}</div>

          {risk.indicators.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Нет данных по портфелю</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {risk.indicators.map(ind => (
                <div key={ind.id} style={{
                  display: "grid", gridTemplateColumns: "10px 1fr auto",
                  gap: 8, alignItems: "center", fontSize: 12,
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: INDICATOR_DOT[ind.level], flexShrink: 0,
                  }} />
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{ind.label}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{ind.note}</span>
                  </div>
                  <span style={{
                    fontVariantNumeric: "tabular-nums", fontWeight: 700,
                    color: INDICATOR_DOT[ind.level], whiteSpace: "nowrap",
                  }}>
                    {ind.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ height: 1, background: c.border, marginBottom: 10 }} />

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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
                <span style={{ color: "var(--text-secondary)" }}>VIX (страх рынка)</span>
                <span style={{ fontWeight: 700, color: vixColor(dip.vixZone) }}>
                  {dip.vix !== null ? dip.vix.toFixed(1) : "—"}
                  <span style={{ fontSize: 9, marginLeft: 5, color: "var(--text-muted)" }}>{vixZoneLabel(dip.vixZone)}</span>
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {dip.instruments.map((ins) => (
                  <div key={ins.ticker} style={{
                    border: `1px solid ${dipColor(ins.signal)}30`,
                    background: dipBg(ins.signal),
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

          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            Рекомендации
          </div>
          {risk.recommendations.map((r, i) => (
            <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 6, marginBottom: 4 }}>
              <span style={{ color: c.dot, flexShrink: 0 }}>→</span>
              <span>{r.text}</span>
            </div>
          ))}

          <div style={{
            marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${c.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11,
          }}>
            <span style={{ color: "var(--text-muted)" }}>Плановый мониторинг будет через</span>
            <span style={{ color: c.dot, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {countdownText}
            </span>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
