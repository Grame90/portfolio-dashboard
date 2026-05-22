"use client";

import { useCallback, useEffect, useState } from "react";
import { useMobile } from "@/lib/useMobile";

export const TICKER_HEIGHT = 34;

interface Item {
  symbol: string;
  price: number;
  change: number | null;
  type: "crypto" | "fx";
}

const CRYPTO = ["BTC", "ETH", "SOL", "BNB", "XRP", "AVAX", "ADA", "DOGE", "TON", "PEPE"];

function fmt(price: number, type: "crypto" | "fx") {
  if (type === "fx") return price.toFixed(2);
  if (price >= 10_000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 1000)   return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (price >= 1)      return price.toFixed(4);
  if (price >= 0.001)  return price.toFixed(5);
  return price.toFixed(8);
}

function Entry({ item }: { item: Item }) {
  const up = (item.change ?? 0) >= 0;
  const clr = up ? "#22c55e" : "#ef4444";
  const prefix = item.type === "crypto" ? "$" : "";

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      padding: "0 22px",
      borderRight: "1px solid rgba(255,255,255,0.07)",
      whiteSpace: "nowrap",
    }}>
      {/* coloured dot */}
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: item.change === null ? "#8888aa" : clr,
        flexShrink: 0,
      }} />
      {/* symbol */}
      <span style={{ fontSize: 10, fontWeight: 800, color: "#8888aa", letterSpacing: "0.1em" }}>
        {item.symbol}
      </span>
      {/* price */}
      <span style={{ fontSize: 12, fontWeight: 700, color: "#ffffff" }}>
        {prefix}{fmt(item.price, item.type)}
      </span>
      {/* change */}
      {item.change !== null && (
        <span style={{
          fontSize: 10, fontWeight: 700, color: clr,
          display: "inline-flex", alignItems: "center", gap: 1,
        }}>
          {up ? "▲" : "▼"} {Math.abs(item.change).toFixed(2)}%
        </span>
      )}
    </span>
  );
}

export default function MarketTicker() {
  const isMobile = useMobile();
  const [items,   setItems]   = useState<Item[]>([]);
  const [clock,   setClock]   = useState("");
  const [mounted, setMounted] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cRes, rRes] = await Promise.all([
        fetch(`/api/crypto?tickers=${CRYPTO.join(",")}`),
        fetch("/api/rates"),
      ]);

      const crypto: Record<string, { current: number; previousClose: number }> =
        cRes.ok ? await cRes.json() : {};
      const rates: { EUR?: number; RUB?: number; TRY?: number } =
        rRes.ok ? await rRes.json() : {};

      const cryptoItems: Item[] = CRYPTO
        .filter(t => crypto[t]?.current)
        .map(t => {
          const { current, previousClose } = crypto[t];
          const change = previousClose
            ? ((current - previousClose) / previousClose) * 100
            : null;
          return { symbol: t, price: current, change, type: "crypto" };
        });

      const fxItems: Item[] = [
        rates.EUR && { symbol: "EUR/USD", price: rates.EUR, change: null, type: "fx" as const },
        rates.RUB && { symbol: "USD/RUB", price: rates.RUB, change: null, type: "fx" as const },
        rates.TRY && { symbol: "USD/TRY", price: rates.TRY, change: null, type: "fx" as const },
      ].filter(Boolean) as Item[];

      setItems([...cryptoItems, ...fxItems]);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    setMounted(true);
    load();
    const d = setInterval(load, 60_000);
    const c = setInterval(() => {
      setClock(new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => { clearInterval(d); clearInterval(c); };
  }, [load]);

  const left = isMobile ? 0 : 72;

  return (
    <>
      <style>{`
        @keyframes ticker-run {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track {
          display: inline-flex;
          align-items: center;
          animation: ticker-run ${Math.max(30, items.length * 4.5)}s linear infinite;
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div style={{
        position: "fixed",
        top: 0, left, right: 0,
        height: TICKER_HEIGHT,
        zIndex: 60,
        background: "#0c0c22",
        borderBottom: "1px solid rgba(124,58,237,0.25)",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        boxShadow: "0 2px 20px rgba(0,0,0,0.4)",
      }}>
        {/* LIVE badge */}
        <div style={{
          flexShrink: 0,
          display: "flex", alignItems: "center", gap: 6,
          padding: "0 14px",
          height: "100%",
          background: "rgba(124,58,237,0.18)",
          borderRight: "1px solid rgba(124,58,237,0.3)",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#ef4444",
            boxShadow: "0 0 6px #ef4444",
            animation: "ticker-run 1s steps(1) infinite",
          }} />
          <span style={{ fontSize: 10, fontWeight: 900, color: "#ffffff", letterSpacing: "0.12em" }}>LIVE</span>
        </div>

        {/* scrolling track */}
        <div style={{ flex: 1, overflow: "hidden", height: "100%", display: "flex", alignItems: "center" }}>
          {mounted && items.length > 0 ? (
            <div className="ticker-track">
              {items.map((item, i) => <Entry key={i} item={item} />)}
              {items.map((item, i) => <Entry key={`d${i}`} item={item} />)}
            </div>
          ) : (
            <span style={{ fontSize: 11, color: "#555577", padding: "0 16px" }}>Загрузка котировок…</span>
          )}
        </div>

        {/* clock */}
        {!isMobile && clock && (
          <div style={{
            flexShrink: 0,
            padding: "0 14px",
            height: "100%",
            display: "flex", alignItems: "center",
            borderLeft: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(0,0,0,0.2)",
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#8888aa", fontVariantNumeric: "tabular-nums" }}>
              {clock}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
