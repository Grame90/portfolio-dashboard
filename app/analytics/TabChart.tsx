"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useApp } from "@/lib/useApp";

// ─── TradingView loader ───────────────────────────────────────────────────────

let tvLoadPromise: Promise<void> | null = null;

function loadTV(): Promise<void> {
  if (typeof window !== "undefined" && (window as any).TradingView) return Promise.resolve();
  if (tvLoadPromise) return tvLoadPromise;
  tvLoadPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
  return tvLoadPromise;
}

function clearChildren(el: HTMLElement) {
  el.replaceChildren();
}

// ─── Types ────────────────────────────────────────────────────────────────────

type GridLayout = { cols: number; rows: number };
type CellConfig = { ticker: string; locked: boolean };
type ChartProfile = { id: string; name: string; layout: GridLayout; cells: CellConfig[] };

// ─── Constants ────────────────────────────────────────────────────────────────

const LAYOUTS: GridLayout[] = [
  { cols: 1, rows: 1 }, { cols: 2, rows: 1 }, { cols: 1, rows: 2 },
  { cols: 2, rows: 2 }, { cols: 3, rows: 2 }, { cols: 2, rows: 3 },
  { cols: 3, rows: 3 }, { cols: 4, rows: 3 }, { cols: 3, rows: 4 },
  { cols: 4, rows: 4 }, { cols: 4, rows: 5 }, { cols: 5, rows: 4 },
];

const FALLBACK_TICKERS = [
  "NASDAQ:QQQ", "BINANCE:BTCUSDT", "NASDAQ:SPY", "NASDAQ:NVDA",
  "NASDAQ:AAPL", "BINANCE:ETHUSDT", "NASDAQ:TSLA", "NASDAQ:META",
  "NASDAQ:MSFT", "NASDAQ:GOOGL", "FX:XAUUSD", "NASDAQ:AMZN",
  "NASDAQ:AMD",  "NASDAQ:NFLX",    "BINANCE:SOLUSDT", "BINANCE:XRPUSDT",
  "NASDAQ:BABA", "BINANCE:DOGEUSDT", "NASDAQ:V",  "NASDAQ:JPM",
];

const LS_PROFILES = "chart-grid-profiles";
const LS_STATE    = "chart-grid-state";

function loadProfiles(): ChartProfile[] {
  try { return JSON.parse(localStorage.getItem(LS_PROFILES) ?? "[]"); } catch { return []; }
}
function saveProfiles(p: ChartProfile[]) { localStorage.setItem(LS_PROFILES, JSON.stringify(p)); }

function makeCells(n: number, defaults: string[]): CellConfig[] {
  return Array.from({ length: n }, (_, i) => ({
    ticker: defaults[i % Math.max(defaults.length, 1)] ?? "NASDAQ:SPY",
    locked: false,
  }));
}

// ─── ChartCell ────────────────────────────────────────────────────────────────

interface CellProps {
  cellId:          string;
  ticker:          string;
  locked:          boolean;
  cellWidth:       number;
  cellHeight:      number;
  onTickerChange:  (t: string) => void;
  onLockToggle:    () => void;
  suggestions:     string[];
}

function ChartCell({ cellId, ticker, locked, cellWidth, cellHeight, onTickerChange, onLockToggle, suggestions }: CellProps) {
  const divRef      = useRef<HTMLDivElement>(null);
  const generation  = useRef(0);
  const [editing,  setEditing]  = useState(false);
  const [inputVal, setInputVal] = useState(ticker);
  const [showSugg, setShowSugg] = useState(false);

  useEffect(() => { setInputVal(ticker); }, [ticker]);

  useEffect(() => {
    if (!cellWidth || !cellHeight) return;
    const el = divRef.current;
    if (!el) return;
    const gen = ++generation.current;
    clearChildren(el);

    loadTV().then(() => {
      if (gen !== generation.current || !divRef.current) return;
      clearChildren(divRef.current);
      try {
        new (window as any).TradingView.widget({
          width:  cellWidth,
          height: cellHeight,
          symbol: ticker,
          interval: "D",
          timezone: "Europe/Istanbul",
          theme: "dark",
          style: "1",
          locale: "ru",
          enable_publishing: false,
          container_id: cellId,
        });
      } catch { /* TradingView may throw on duplicate mount */ }
    });

    return () => { generation.current++; };
  }, [ticker, cellId, cellWidth, cellHeight]);

  const commit = useCallback(() => {
    const t = inputVal.trim().toUpperCase();
    if (t) onTickerChange(t);
    setEditing(false);
    setShowSugg(false);
  }, [inputVal, onTickerChange]);

  const filtered = useMemo(() => {
    const q = inputVal.toLowerCase();
    return suggestions.filter(s => s.toLowerCase().includes(q)).slice(0, 8);
  }, [inputVal, suggestions]);

  const shortName = ticker.includes(":") ? ticker.split(":")[1] : ticker;

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden", background: "#050508" }}>
      <div ref={divRef} id={cellId} style={{ width: "100%", height: "100%" }} />

      {/* Toolbar overlay */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
        display: "flex", alignItems: "center", gap: 4, padding: "5px 8px",
        background: "rgba(5,5,16,0.78)", backdropFilter: "blur(6px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        {editing ? (
          <div style={{ position: "relative", flex: 1 }}>
            <input
              autoFocus
              value={inputVal}
              onChange={e => { setInputVal(e.target.value.toUpperCase()); setShowSugg(true); }}
              onBlur={() => setTimeout(commit, 200)}
              onKeyDown={e => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") { setEditing(false); setInputVal(ticker); setShowSugg(false); }
              }}
              placeholder="Напр: AAPL, BINANCE:BTCUSDT"
              style={{
                width: "100%", background: "rgba(124,58,237,0.15)", border: "1px solid var(--accent)",
                color: "white", fontSize: 11, padding: "3px 8px", borderRadius: 4,
                outline: "none", boxSizing: "border-box",
              }}
            />
            {showSugg && filtered.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 30,
                background: "#12122a", border: "1px solid var(--border)", borderRadius: 6,
                marginTop: 2, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              }}>
                {filtered.map(s => (
                  <div
                    key={s}
                    onMouseDown={() => { onTickerChange(s); setEditing(false); setShowSugg(false); }}
                    style={{
                      padding: "5px 10px", fontSize: 11, cursor: "pointer",
                      color: "var(--text-secondary)",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(124,58,237,0.2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >{s}</div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => { if (!locked) { setEditing(true); setShowSugg(true); } }}
            title={locked ? "Инструмент зафиксирован" : "Нажмите для смены инструмента"}
            style={{
              flex: 1, textAlign: "left", background: "none", border: "none",
              cursor: locked ? "default" : "pointer", color: "white",
              fontSize: 11, fontWeight: 700, padding: "2px 2px",
            }}
          >
            {shortName}
          </button>
        )}

        <button
          onClick={onLockToggle}
          title={locked ? "Разблокировать" : "Зафиксировать"}
          style={{
            background: "none", border: "none", cursor: "pointer", padding: "2px 4px",
            color: locked ? "#a78bfa" : "rgba(255,255,255,0.3)", fontSize: 13, lineHeight: 1,
          }}
        >
          {locked ? "🔒" : "🔓"}
        </button>
      </div>
    </div>
  );
}

// ─── Save dialog ──────────────────────────────────────────────────────────────

function SaveDialog({
  defaultName, onSave, onCancel,
}: { defaultName: string; onSave: (n: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(defaultName);
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.65)",
    }}>
      <div className="card" style={{ padding: 24, minWidth: 320 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Сохранить профиль</div>
        <input
          autoFocus value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && name.trim()) onSave(name.trim());
            if (e.key === "Escape") onCancel();
          }}
          placeholder="Название профиля"
          style={{
            width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border)",
            color: "var(--text-primary)", fontSize: 13, padding: "8px 12px",
            borderRadius: 6, outline: "none", boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{ padding: "6px 16px", background: "none", border: "1px solid var(--border)", color: "var(--text-secondary)", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
            Отмена
          </button>
          <button
            onClick={() => name.trim() && onSave(name.trim())}
            disabled={!name.trim()}
            style={{
              padding: "6px 16px", background: "var(--accent)", border: "none",
              color: "white", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700,
              opacity: name.trim() ? 1 : 0.5,
            }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TabChart() {
  const app = useApp();

  const [layout,          setLayout]          = useState<GridLayout>({ cols: 2, rows: 2 });
  const [cells,           setCells]           = useState<CellConfig[]>([]);
  const [profiles,        setProfiles]        = useState<ChartProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [showSaveDialog,  setShowSaveDialog]  = useState(false);
  const [showLayoutPick,  setShowLayoutPick]  = useState(false);
  const [ready,           setReady]           = useState(false);
  const [cellDims,        setCellDims]        = useState({ w: 0, h: 0 });
  const gridRef = useRef<HTMLDivElement>(null);

  const portfolioTickers = useMemo(() => {
    const from = app.positions
      .filter(p => p.type !== "Кэш" && p.ticker)
      .map(p => {
        const t = p.ticker.toUpperCase();
        return p.type === "Крипто" ? `BINANCE:${t}USDT` : `NASDAQ:${t}`;
      });
    return [...new Set([...from, ...FALLBACK_TICKERS])];
  }, [app.positions]);

  // Load once
  useEffect(() => {
    setProfiles(loadProfiles());
    try {
      const saved = JSON.parse(localStorage.getItem(LS_STATE) ?? "null");
      if (saved?.layout) setLayout(saved.layout);
      const count = (saved?.layout?.cols ?? 2) * (saved?.layout?.rows ?? 2);
      setCells(saved?.cells?.length ? saved.cells : makeCells(count, portfolioTickers));
    } catch {
      setCells(makeCells(4, portfolioTickers));
    }
    setReady(true);
  }, []);

  // Measure grid container → compute per-cell pixel dimensions
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const calc = () => {
      const { width, height } = el.getBoundingClientRect();
      const gap = 2;
      setCellDims({
        w: Math.floor((width  - gap * (layout.cols - 1) - 4) / layout.cols),
        h: Math.floor((height - gap * (layout.rows - 1) - 4) / layout.rows),
      });
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout]);

  // Sync cell count to layout
  const cellCount = layout.cols * layout.rows;
  useEffect(() => {
    if (!ready) return;
    setCells(prev => {
      if (prev.length === cellCount) return prev;
      if (prev.length > cellCount) return prev.slice(0, cellCount);
      return [...prev, ...makeCells(cellCount - prev.length, portfolioTickers.slice(prev.length))];
    });
  }, [cellCount, ready]);

  // Persist
  useEffect(() => {
    if (ready && cells.length) localStorage.setItem(LS_STATE, JSON.stringify({ layout, cells }));
  }, [layout, cells, ready]);

  const updateCell = useCallback((idx: number, patch: Partial<CellConfig>) => {
    setCells(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  }, []);

  const handleSave = (name: string) => {
    const p: ChartProfile = { id: Date.now().toString(), name, layout: { ...layout }, cells: [...cells] };
    const updated = [...profiles, p];
    setProfiles(updated);
    saveProfiles(updated);
    setActiveProfileId(p.id);
    setShowSaveDialog(false);
  };

  const handleLoad = (p: ChartProfile) => { setLayout(p.layout); setCells(p.cells); setActiveProfileId(p.id); };
  const handleDelete = (id: string) => {
    const updated = profiles.filter(p => p.id !== id);
    setProfiles(updated);
    saveProfiles(updated);
    if (activeProfileId === id) setActiveProfileId(null);
  };

  const layoutKey = `${layout.cols}x${layout.rows}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 160px)", overflow: "hidden" }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "8px 16px",
        background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)",
        flexShrink: 0, flexWrap: "wrap", rowGap: 6,
      }}>

        {/* Layout button */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowLayoutPick(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 12px",
              background: showLayoutPick ? "var(--accent)" : "var(--bg-card)",
              border: "1px solid", borderColor: showLayoutPick ? "var(--accent)" : "var(--border)",
              color: showLayoutPick ? "white" : "var(--text-primary)",
              borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700,
            }}
          >
            ⊞ {layout.cols}×{layout.rows} <span style={{ fontSize: 9, opacity: 0.5 }}>▾</span>
          </button>

          {showLayoutPick && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setShowLayoutPick(false)} />
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 100,
                background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10,
                padding: 12, display: "flex", flexWrap: "wrap", gap: 6, width: 295,
                boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
              }}>
                <div style={{ width: "100%", fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.06em", marginBottom: 4 }}>
                  ВЫБРАТЬ СЕТКУ
                </div>
                {LAYOUTS.map(l => {
                  const isActive = l.cols === layout.cols && l.rows === layout.rows;
                  const total    = l.cols * l.rows;
                  return (
                    <button
                      key={`${l.cols}x${l.rows}`}
                      onClick={() => { setLayout(l); setShowLayoutPick(false); }}
                      title={`${l.cols} × ${l.rows} — ${total} окон`}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                        padding: "8px 10px", minWidth: 62,
                        background: isActive ? "var(--accent)" : "var(--bg-secondary)",
                        border: "1px solid", borderColor: isActive ? "var(--accent)" : "var(--border)",
                        borderRadius: 6, cursor: "pointer",
                        color: isActive ? "white" : "var(--text-secondary)",
                      }}
                    >
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${Math.min(l.cols, 5)}, 6px)`,
                        gridTemplateRows: `repeat(${Math.min(l.rows, 5)}, 4px)`,
                        gap: 1,
                      }}>
                        {Array.from({ length: Math.min(total, 25) }).map((_, i) => (
                          <div key={i} style={{
                            background: isActive ? "rgba(255,255,255,0.55)" : "rgba(170,170,204,0.35)",
                            borderRadius: 1,
                          }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700 }}>{l.cols}×{l.rows}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div style={{ width: 1, height: 22, background: "var(--border)" }} />

        {/* Profiles */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>Профили:</span>

          {profiles.length === 0 && (
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>нет сохранённых</span>
          )}

          {profiles.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center" }}>
              <button
                onClick={() => handleLoad(p)}
                style={{
                  padding: "4px 9px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                  background: activeProfileId === p.id ? "var(--accent)" : "var(--bg-card)",
                  border: "1px solid", borderColor: activeProfileId === p.id ? "var(--accent)" : "var(--border)",
                  color: activeProfileId === p.id ? "white" : "var(--text-secondary)",
                  borderRadius: "5px 0 0 5px", cursor: "pointer",
                }}
              >{p.name}</button>
              <button
                onClick={() => handleDelete(p.id)}
                title="Удалить профиль"
                style={{
                  padding: "4px 6px", fontSize: 10, lineHeight: 1,
                  background: activeProfileId === p.id ? "#6d28d9" : "var(--bg-card)",
                  border: "1px solid", borderLeft: "none",
                  borderColor: activeProfileId === p.id ? "var(--accent)" : "var(--border)",
                  color: activeProfileId === p.id ? "rgba(255,255,255,0.6)" : "var(--text-muted)",
                  borderRadius: "0 5px 5px 0", cursor: "pointer",
                }}
              >✕</button>
            </div>
          ))}

          <button
            onClick={() => setShowSaveDialog(true)}
            style={{
              padding: "4px 10px", fontSize: 11, fontWeight: 700,
              background: "none", border: "1px solid var(--border)",
              color: "var(--text-secondary)", borderRadius: 5, cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >+ Сохранить</button>
        </div>
      </div>

      {/* ── Grid ── */}
      <div
        ref={gridRef}
        style={{
          flex: 1, overflow: "hidden",
          display: "grid",
          gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
          gridTemplateRows: `repeat(${layout.rows}, 1fr)`,
          gap: 2, padding: 2,
          background: "#0a0a14",
        }}
      >
        {cells.slice(0, cellCount).map((cell, idx) => (
          <ChartCell
            key={`${layoutKey}_${idx}`}
            cellId={`tv_${layoutKey}_${idx}`}
            ticker={cell.ticker}
            locked={cell.locked}
            cellWidth={cellDims.w}
            cellHeight={cellDims.h}
            onTickerChange={t => updateCell(idx, { ticker: t })}
            onLockToggle={() => updateCell(idx, { locked: !cell.locked })}
            suggestions={portfolioTickers}
          />
        ))}
      </div>

      {showSaveDialog && (
        <SaveDialog
          defaultName={`Профиль ${profiles.length + 1}`}
          onSave={handleSave}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  );
}
