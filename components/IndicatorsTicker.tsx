"use client";

import { useEffect, useState } from "react";
import { TICKER_HEIGHT } from "./MarketTicker";
import { useMarketIndicators } from "@/lib/useMarketIndicators";

// Second top strip: market-valuation / "Buffett-style" indicators.
// Sits directly below the live MarketTicker. Data comes from the shared
// useMarketIndicators() hook (one request shared with the header CrisisBadge).
// The aggregated CRISIS ALERT lives in the page header (see CrisisBadge).

export default function IndicatorsTicker() {
  const { indicators } = useMarketIndicators();
  const [mounted, setMounted] = useState(false);

  // Avoid SSR/CSR mismatch: fallbackData (localStorage) is client-only.
  useEffect(() => { setMounted(true); }, []);

  return (
    <div
      style={{
        position: "fixed", top: TICKER_HEIGHT, left: 0, right: 0,
        height: TICKER_HEIGHT, zIndex: 59,
        background: "#0b0b20",
        borderBottom: "1px solid rgba(124,58,237,0.2)",
        display: "flex", alignItems: "center", overflow: "hidden",
        boxShadow: "0 2px 24px rgba(0,0,0,0.5)",
      }}
    >
      {/* badge */}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
        padding: "0 12px", height: "100%",
        background: "rgba(245,158,11,0.14)",
        borderRight: "1px solid rgba(245,158,11,0.25)",
      }}>
        <span style={{ fontSize: 11 }}>📊</span>
        <span style={{ fontSize: 9, fontWeight: 900, color: "#ddd", letterSpacing: "0.12em" }}>ОЦЕНКА</span>
      </div>

      {/* indicators row */}
      <div
        className="scroll-x"
        style={{ flex: 1, height: "100%", display: "flex", alignItems: "center", overflowX: "auto", overflowY: "hidden" }}
      >
        {mounted && indicators.length > 0 ? (
          indicators.map((it, i) => (
            <div
              key={it.key}
              title={it.approx ? "Приблизительное значение (нет бесплатного API)" : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "0 14px", height: "100%", whiteSpace: "nowrap",
                borderRight: i < indicators.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}
            >
              <span style={{ fontSize: 9.5, fontWeight: 600, color: "#7a7da0", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {it.label}{it.approx ? " ≈" : ""}
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: it.color, fontVariantNumeric: "tabular-nums" }}>
                {it.value}
              </span>
              {it.sub && <span style={{ fontSize: 9, color: "#555577" }}>{it.sub}</span>}
            </div>
          ))
        ) : (
          <span style={{ fontSize: 11, color: "#444466", padding: "0 16px" }}>Загрузка индикаторов…</span>
        )}
      </div>
    </div>
  );
}
