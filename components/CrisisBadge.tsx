"use client";

import { useEffect, useRef, useState } from "react";
import { useMarketIndicators } from "@/lib/useMarketIndicators";

// CRISIS ALERT pill for the page header — sits next to the DailyAlert "Стабильно"
// status. Aggregates Buffett-style danger signals (overvaluation, VIX spike,
// inverted yield curve, extreme Fear&Greed). Data comes from the shared
// useMarketIndicators() hook (one request shared with the indicators strip).

export default function CrisisBadge() {
  const { crisis } = useMarketIndicators();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the popover on a click outside the badge/popover (registered once).
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (!crisis) return null;

  const alarm = crisis.level === "high" || crisis.level === "crisis";
  const c = crisis.color;
  const clickable = crisis.signals.length > 0;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <style>{`@keyframes crisis-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>

      <button
        onMouseDown={(e) => { e.stopPropagation(); if (clickable) setOpen((p) => !p); }}
        title={clickable ? "Показать сработавшие сигналы" : undefined}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "6px 12px", borderRadius: 999,
          background: `color-mix(in srgb, ${c} 14%, transparent)`,
          border: `1px solid color-mix(in srgb, ${c} 45%, transparent)`,
          cursor: clickable ? "pointer" : "default",
          whiteSpace: "nowrap",
          boxShadow: alarm ? `0 0 0 1px ${c}, 0 0 14px -4px ${c}` : "none",
        }}
      >
        <span style={{ fontSize: 12, lineHeight: 1, animation: alarm ? "crisis-blink 1.2s ease-in-out infinite" : undefined }}>
          {crisis.level === "calm" ? "🛡️" : "⚠️"}
        </span>
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.05, alignItems: "flex-start" }}>
          <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.1em", color: "var(--text-muted)" }}>КРИЗИС-АЛЕРТ</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: c }}>{crisis.label}</span>
        </span>
      </button>

      {open && clickable ? (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0,
            width: 340, maxWidth: "calc(100vw - 24px)",
            maxHeight: "60vh", overflowY: "auto",
            background: "var(--bg-card)", border: `1px solid ${c}`,
            borderRadius: 10, padding: 12, zIndex: 200,
            boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: c }}>{crisis.label} · риск {crisis.score}</span>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{crisis.signals.length} сигнал(ов)</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {crisis.signals.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 7, fontSize: 11.5, color: "var(--text-secondary)" }}>
                <span style={{ color: c, flexShrink: 0 }}>•</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
