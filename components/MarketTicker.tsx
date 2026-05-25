"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMobile } from "@/lib/useMobile";

export const TICKER_HEIGHT = 34;

// ─── catalog ──────────────────────────────────────────────────────────────────

type Cat = "crypto" | "stock" | "ru-stock" | "index" | "fx" | "commodity" | "etf" | "bond";

interface Def {
  symbol: string;    // display + key
  api: string;       // API ticker (Finnhub / Yahoo / CoinGecko id)
  cat: Cat;
  name: string;
}

const ALL: Def[] = [
  // Crypto
  { symbol: "BTC",     api: "BTC",       cat: "crypto",    name: "Bitcoin" },
  { symbol: "ETH",     api: "ETH",       cat: "crypto",    name: "Ethereum" },
  { symbol: "SOL",     api: "SOL",       cat: "crypto",    name: "Solana" },
  { symbol: "XRP",     api: "XRP",       cat: "crypto",    name: "Ripple" },
  { symbol: "ADA",     api: "ADA",       cat: "crypto",    name: "Cardano" },
  { symbol: "BNB",     api: "BNB",       cat: "crypto",    name: "BNB" },
  { symbol: "AVAX",    api: "AVAX",      cat: "crypto",    name: "Avalanche" },
  { symbol: "DOGE",    api: "DOGE",      cat: "crypto",    name: "Dogecoin" },
  { symbol: "TON",     api: "TON",       cat: "crypto",    name: "Toncoin" },
  { symbol: "PEPE",    api: "PEPE",      cat: "crypto",    name: "Pepe" },
  // US Stocks
  { symbol: "AAPL",    api: "AAPL",      cat: "stock",     name: "Apple" },
  { symbol: "MSFT",    api: "MSFT",      cat: "stock",     name: "Microsoft" },
  { symbol: "GOOGL",   api: "GOOGL",     cat: "stock",     name: "Alphabet" },
  { symbol: "AMZN",    api: "AMZN",      cat: "stock",     name: "Amazon" },
  { symbol: "TSLA",    api: "TSLA",      cat: "stock",     name: "Tesla" },
  { symbol: "META",    api: "META",      cat: "stock",     name: "Meta" },
  { symbol: "NVDA",    api: "NVDA",      cat: "stock",     name: "NVIDIA" },
  { symbol: "JPM",     api: "JPM",       cat: "stock",     name: "JPMorgan" },
  { symbol: "XOM",     api: "XOM",       cat: "stock",     name: "Exxon Mobil" },
  { symbol: "BRK.B",   api: "BRK-B",    cat: "stock",     name: "Berkshire B" },
  // Russian Stocks (MOEX)
  { symbol: "SBER",    api: "SBER.ME",   cat: "ru-stock",  name: "Сбербанк" },
  { symbol: "GAZP",    api: "GAZP.ME",   cat: "ru-stock",  name: "Газпром" },
  { symbol: "ROSN",    api: "ROSN.ME",   cat: "ru-stock",  name: "Роснефть" },
  { symbol: "LKOH",    api: "LKOH.ME",   cat: "ru-stock",  name: "ЛУКОЙЛ" },
  { symbol: "YNDX",    api: "YDEX.ME",   cat: "ru-stock",  name: "Яндекс" },
  { symbol: "MGNT",    api: "MGNT.ME",   cat: "ru-stock",  name: "Магнит" },
  { symbol: "NVTK",    api: "NVTK.ME",   cat: "ru-stock",  name: "НОВАТЭК" },
  { symbol: "VTBR",    api: "VTBR.ME",   cat: "ru-stock",  name: "ВТБ" },
  { symbol: "MTSS",    api: "MTSS.ME",   cat: "ru-stock",  name: "МТС" },
  { symbol: "ALRS",    api: "ALRS.ME",   cat: "ru-stock",  name: "АЛРОСА" },
  // Indices
  { symbol: "S&P500",  api: "^GSPC",     cat: "index",     name: "S&P 500" },
  { symbol: "DJIA",    api: "^DJI",      cat: "index",     name: "Dow Jones" },
  { symbol: "NASDAQ",  api: "^IXIC",     cat: "index",     name: "NASDAQ Composite" },
  { symbol: "RUT2000", api: "^RUT",      cat: "index",     name: "Russell 2000" },
  { symbol: "FTSE100", api: "^FTSE",     cat: "index",     name: "FTSE 100" },
  { symbol: "NIKKEI",  api: "^N225",     cat: "index",     name: "Nikkei 225" },
  { symbol: "IMOEX",   api: "IMOEX.ME",  cat: "index",     name: "Индекс МосБиржи" },
  { symbol: "RTSI",    api: "^RTSI",     cat: "index",     name: "Индекс РТС" },
  // FX
  { symbol: "EUR/USD", api: "EURUSD=X",  cat: "fx",        name: "Евро / Доллар" },
  { symbol: "USD/JPY", api: "JPY=X",     cat: "fx",        name: "Доллар / Иена" },
  { symbol: "GBP/USD", api: "GBPUSD=X",  cat: "fx",        name: "Фунт / Доллар" },
  { symbol: "AUD/USD", api: "AUDUSD=X",  cat: "fx",        name: "AUD / USD" },
  { symbol: "USD/RUB", api: "RUB=X",     cat: "fx",        name: "Доллар / Рубль" },
  { symbol: "EUR/RUB", api: "EURRUB=X",  cat: "fx",        name: "Евро / Рубль" },
  // Commodities / Futures
  { symbol: "WTI",     api: "CL=F",      cat: "commodity", name: "Нефть WTI" },
  { symbol: "Brent",   api: "BZ=F",      cat: "commodity", name: "Нефть Brent" },
  { symbol: "Gold",    api: "GC=F",      cat: "commodity", name: "Золото (oz)" },
  { symbol: "Silver",  api: "SI=F",      cat: "commodity", name: "Серебро (oz)" },
  { symbol: "Copper",  api: "HG=F",      cat: "commodity", name: "Медь" },
  { symbol: "Nat.Gas", api: "NG=F",      cat: "commodity", name: "Природный газ" },
  // ETFs
  { symbol: "SPY",     api: "SPY",       cat: "etf",       name: "SPDR S&P 500" },
  { symbol: "QQQ",     api: "QQQ",       cat: "etf",       name: "Invesco QQQ" },
  { symbol: "VOO",     api: "VOO",       cat: "etf",       name: "Vanguard S&P 500" },
  { symbol: "GLD",     api: "GLD",       cat: "etf",       name: "SPDR Gold" },
  { symbol: "IWM",     api: "IWM",       cat: "etf",       name: "iShares Russell 2000" },
  // Bonds / Yields
  { symbol: "US10Y",   api: "^TNX",      cat: "bond",      name: "Доходность 10 лет США" },
  { symbol: "US30Y",   api: "^TYX",      cat: "bond",      name: "Доходность 30 лет США" },
];

const CAT_LABEL: Record<Cat, string> = {
  crypto: "Крипто",
  stock: "Акции США",
  "ru-stock": "Акции РФ",
  index: "Индексы",
  fx: "Валюты",
  commodity: "Сырьё",
  etf: "ETF",
  bond: "Облигации",
};

const CAT_COLOR: Record<Cat, string> = {
  crypto:     "#f59e0b",
  stock:      "#3b82f6",
  "ru-stock": "#ef4444",
  index:      "#8b5cf6",
  fx:         "#10b981",
  commodity:  "#f97316",
  etf:        "#6366f1",
  bond:       "#14b8a6",
};

const CAT_ORDER: Cat[] = ["crypto", "stock", "ru-stock", "index", "fx", "commodity", "etf", "bond"];

// ─── localStorage ─────────────────────────────────────────────────────────────

const LS_KEY = "mt-enabled-v2";

const DEFAULT_ENABLED = new Set([
  "BTC","ETH","SOL","XRP",
  "AAPL","MSFT","NVDA","TSLA",
  "S&P500","NASDAQ",
  "Gold","Brent",
  "EUR/USD","USD/RUB",
]);

function loadEnabled(): Set<string> {
  try {
    const r = localStorage.getItem(LS_KEY);
    if (!r) return new Set(DEFAULT_ENABLED);
    return new Set(JSON.parse(r) as string[]);
  } catch { return new Set(DEFAULT_ENABLED); }
}

function saveEnabled(s: Set<string>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify([...s])); } catch {}
}

const LS_CACHE = "mt-price-cache";

function loadPriceCache(defs: Def[]): Item[] {
  try {
    const raw = localStorage.getItem(LS_CACHE);
    if (!raw) return [];
    const cached: { symbol: string; price: number; change: number | null }[] = JSON.parse(raw);
    const defMap = new Map(defs.map(d => [d.symbol, d]));
    return cached
      .filter(c => defMap.has(c.symbol))
      .map(c => ({ def: defMap.get(c.symbol)!, price: c.price, change: c.change }));
  } catch { return []; }
}

// ─── item ─────────────────────────────────────────────────────────────────────

interface Item { def: Def; price: number; change: number | null; }

// ─── formatting ───────────────────────────────────────────────────────────────

function fmtPrice(price: number, cat: Cat) {
  if (cat === "bond")      return (price / 10).toFixed(3) + "%";
  if (cat === "fx")        return price >= 10 ? price.toFixed(3) : price.toFixed(5);
  if (cat === "index")     return price >= 1000 ? price.toLocaleString("en-US", { maximumFractionDigits: 0 }) : price.toFixed(2);
  if (cat === "commodity") return price.toFixed(2);
  if (price >= 10_000)     return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 100)        return price.toFixed(2);
  if (price >= 1)          return price.toFixed(4);
  if (price >= 0.001)      return price.toFixed(5);
  return price.toFixed(8);
}

function hasPrefix(cat: Cat) {
  return cat !== "fx" && cat !== "index" && cat !== "bond";
}

// ─── Entry ────────────────────────────────────────────────────────────────────

function Entry({ item }: { item: Item }) {
  const up  = (item.change ?? 0) >= 0;
  const clr = item.change === null ? "#8888aa" : up ? "#22c55e" : "#ef4444";
  const catClr = CAT_COLOR[item.def.cat];

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "0 18px",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: catClr, flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 800, color: "#9090b0", letterSpacing: "0.09em" }}>
        {item.def.symbol}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
        {hasPrefix(item.def.cat) ? "$" : ""}{fmtPrice(item.price, item.def.cat)}
      </span>
      {item.change !== null && (
        <span style={{ fontSize: 10, fontWeight: 700, color: clr }}>
          {up ? "▲" : "▼"} {Math.abs(item.change).toFixed(2)}%
        </span>
      )}
    </span>
  );
}

// ─── SettingsPanel ────────────────────────────────────────────────────────────

function SettingsPanel({
  draft, onToggle, onReset, onClose, left,
}: {
  draft: Set<string>;
  onToggle: (symbol: string) => void;
  onReset: () => void;
  onClose: () => void;
  left: number;
}) {
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: "fixed",
        top: TICKER_HEIGHT,
        left,
        right: 0,
        zIndex: 9990,
        background: "#0e0e28",
        borderBottom: "1px solid rgba(124,58,237,0.3)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
        maxHeight: "70vh",
        overflowY: "auto",
        padding: "16px 20px 20px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", letterSpacing: "0.08em" }}>
          НАСТРОЙКА ТИКЕРОВ
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onReset}
            style={{ fontSize: 10, color: "#8888aa", background: "none", border: "1px solid #333366", borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}
          >↺ По умолчанию</button>
          <button
            onClick={onClose}
            style={{ fontSize: 10, color: "#fff", background: "#7c3aed", border: "none", borderRadius: 6, padding: "3px 12px", cursor: "pointer", fontWeight: 700 }}
          >Готово</button>
        </div>
      </div>

      {/* Grid by category */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {CAT_ORDER.map(cat => {
          const defs = ALL.filter(d => d.cat === cat);
          return (
            <div key={cat}>
              <div style={{
                fontSize: 9, fontWeight: 900, color: CAT_COLOR[cat],
                letterSpacing: "0.12em", marginBottom: 6, textTransform: "uppercase",
              }}>
                {CAT_LABEL[cat]}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {defs.map(d => {
                  const on = draft.has(d.symbol);
                  return (
                    <button
                      key={d.symbol}
                      onClick={() => onToggle(d.symbol)}
                      title={d.name}
                      style={{
                        padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                        cursor: "pointer", border: "1px solid",
                        borderColor: on ? CAT_COLOR[cat] : "#222244",
                        background: on ? `${CAT_COLOR[cat]}22` : "transparent",
                        color: on ? CAT_COLOR[cat] : "#555577",
                        transition: "all 0.15s",
                      }}
                    >
                      {d.symbol}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, fontSize: 10, color: "#555577" }}>
        Выбрано: {draft.size} тикера
      </div>
    </div>
  );
}

// ─── MarketTicker ─────────────────────────────────────────────────────────────

export default function MarketTicker() {
  const isMobile = useMobile();
  const left = isMobile ? 0 : 72;

  const [mounted,       setMounted]       = useState(false);
  const [items,         setItems]         = useState<Item[]>([]);
  const [clock,         setClock]         = useState("");
  const [settingsOpen,  setSettingsOpen]  = useState(false);
  const [enabled,       setEnabled]       = useState<Set<string>>(DEFAULT_ENABLED);
  const [draft,         setDraft]         = useState<Set<string>>(DEFAULT_ENABLED);

  // Load from localStorage after mount (enabled set + cached prices as initial state)
  useEffect(() => {
    setMounted(true);
    const e = loadEnabled();
    setEnabled(e);
    setDraft(new Set(e));
    const cached = loadPriceCache(ALL.filter(d => e.has(d.symbol)));
    if (cached.length) setItems(cached);
  }, []);

  // Derive active defs in catalog order (maintains stable scroll order)
  const activeDefs = ALL.filter(d => enabled.has(d.symbol));

  const load = useCallback(async (defs: Def[]) => {
    if (!defs.length) { setItems([]); return; }

    const cryptoDefs = defs.filter(d => d.cat === "crypto");
    const marketDefs = defs.filter(d => d.cat !== "crypto");

    type QuoteMap = Record<string, { current?: number; previousClose?: number }>;
    const [cryptoData, marketData] = await Promise.all([
      cryptoDefs.length
        ? fetch(`/api/crypto?tickers=${cryptoDefs.map(d => d.api).join(",")}`).then(r => r.ok ? r.json() : {}).catch(() => ({}))
        : Promise.resolve({}),
      marketDefs.length
        ? fetch(`/api/quotes?tickers=${marketDefs.map(d => d.api).join(",")}`).then(r => r.ok ? r.json() : {}).catch(() => ({}))
        : Promise.resolve({}),
    ]) as [QuoteMap, QuoteMap];

    const newItems: Item[] = [];

    for (const def of defs) {
      const raw: { current?: number; previousClose?: number } | undefined =
        def.cat === "crypto" ? cryptoData[def.api] : marketData[def.api];

      if (!raw?.current) continue;

      const current = Number(raw.current);
      const prev    = Number(raw.previousClose ?? 0);
      const change  = prev > 0 ? ((current - prev) / prev) * 100 : null;

      newItems.push({ def, price: current, change });
    }

    // Merge fresh prices with previous (stale cache for symbols that returned nothing)
    setItems(prev => {
      const prevMap = new Map(prev.map(i => [i.def.symbol, i]));
      const merged = defs.map(def => {
        const fresh = newItems.find(i => i.def.symbol === def.symbol);
        return fresh ?? prevMap.get(def.symbol) ?? null;
      }).filter(Boolean) as Item[];
      // Persist merged prices so they survive a reload when server is down
      try {
        localStorage.setItem(LS_CACHE, JSON.stringify(
          merged.map(i => ({ symbol: i.def.symbol, price: i.price, change: i.change }))
        ));
      } catch {}
      return merged;
    });
  }, []);

  // Fetch on mount and when active defs change
  const defsKey = activeDefs.map(d => d.symbol).join(",");
  const defsRef = useRef(defsKey);
  useEffect(() => {
    defsRef.current = defsKey;
    load(activeDefs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defsKey, load]);

  // Auto-refresh every 60s
  useEffect(() => {
    const id = setInterval(() => load(ALL.filter(d => enabled.has(d.symbol))), 60_000);
    return () => clearInterval(id);
  }, [enabled, load]);

  // Clock
  useEffect(() => {
    const id = setInterval(() => {
      setClock(new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Close settings on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    const close = () => setSettingsOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [settingsOpen]);

  // Apply draft changes
  function applyDraft(next: Set<string>) {
    setEnabled(next);
    saveEnabled(next);
  }

  const duration = Math.max(30, items.length * 4.2);

  return (
    <>
      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track {
          display: inline-flex;
          align-items: center;
          animation: ticker-scroll ${duration}s linear infinite;
        }
        .ticker-track:hover { animation-play-state: paused; }
      `}</style>

      {/* ── bar ── */}
      <div
        onMouseDown={e => e.stopPropagation()}
        style={{
          position: "fixed", top: 0, left, right: 0,
          height: TICKER_HEIGHT, zIndex: 60,
          background: "#0b0b20",
          borderBottom: "1px solid rgba(124,58,237,0.2)",
          display: "flex", alignItems: "center",
          overflow: "hidden",
          boxShadow: "0 2px 24px rgba(0,0,0,0.5)",
        }}
      >
        {/* LIVE badge */}
        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
          padding: "0 12px", height: "100%",
          background: "rgba(124,58,237,0.15)",
          borderRight: "1px solid rgba(124,58,237,0.25)",
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: "50%",
            background: "#ef4444", boxShadow: "0 0 6px #ef4444",
            animation: "ticker-scroll 1s steps(1) infinite",
          }} />
          <span style={{ fontSize: 9, fontWeight: 900, color: "#ddd", letterSpacing: "0.15em" }}>LIVE</span>
        </div>

        {/* scrolling content */}
        <div style={{ flex: 1, overflow: "hidden", height: "100%", display: "flex", alignItems: "center" }}>
          {mounted && items.length > 0 ? (
            <div className="ticker-track">
              {items.map((item, i) => <Entry key={i} item={item} />)}
              {items.map((item, i) => <Entry key={`d${i}`} item={item} />)}
            </div>
          ) : (
            <span style={{ fontSize: 11, color: "#444466", padding: "0 16px" }}>
              Загрузка…
            </span>
          )}
        </div>

        {/* settings button */}
        <button
          onMouseDown={e => { e.stopPropagation(); setSettingsOpen(p => { if (!p) setDraft(new Set(enabled)); return !p; }); }}
          title="Настроить тикеры"
          style={{
            flexShrink: 0, height: "100%",
            padding: "0 12px", border: "none",
            borderLeft: "1px solid rgba(255,255,255,0.06)",
            background: settingsOpen ? "rgba(124,58,237,0.2)" : "transparent",
            color: settingsOpen ? "#a78bfa" : "#555577",
            cursor: "pointer", fontSize: 14,
            display: "flex", alignItems: "center",
            transition: "all 0.15s",
          }}
        >⚙</button>

        {/* clock */}
        {!isMobile && clock && (
          <div style={{
            flexShrink: 0, padding: "0 12px", height: "100%",
            display: "flex", alignItems: "center",
            borderLeft: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(0,0,0,0.15)",
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#555577", fontVariantNumeric: "tabular-nums" }}>
              {clock}
            </span>
          </div>
        )}
      </div>

      {/* ── settings panel ── */}
      {settingsOpen && mounted && (
        <SettingsPanel
          draft={draft}
          left={left}
          onToggle={sym => {
            setDraft(prev => {
              const next = new Set(prev);
              next.has(sym) ? next.delete(sym) : next.add(sym);
              return next;
            });
          }}
          onReset={() => setDraft(new Set(DEFAULT_ENABLED))}
          onClose={() => {
            applyDraft(draft);
            setSettingsOpen(false);
          }}
        />
      )}
    </>
  );
}
