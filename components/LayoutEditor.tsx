"use client";

import {
  createContext, useContext, useState, useEffect, useRef, useCallback,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

// ─── types ────────────────────────────────────────────────────────────────────

interface CardState {
  dx: number;
  dy: number;
  w?: number;
  h?: number;
  pinned: boolean;
}

type LayoutData = Record<string, CardState>;

interface CtxValue {
  editing: boolean;
  textScale: number;
}

// ─── storage ──────────────────────────────────────────────────────────────────

const LS_LAYOUT = "lm-layout-v2";
const LS_TEXT   = "lm-text-scale";
const TEXT_STEPS = [0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.4];

function loadLayout(): LayoutData {
  try { return JSON.parse(localStorage.getItem(LS_LAYOUT) || "{}"); } catch { return {}; }
}
function saveLayout(d: LayoutData) {
  try { localStorage.setItem(LS_LAYOUT, JSON.stringify(d)); } catch {}
}
function loadTextScale(): number {
  const n = parseFloat(localStorage.getItem(LS_TEXT) || "1");
  return isNaN(n) ? 1 : n;
}

// ─── card overlay — no setState, all position updates are imperative ──────────

interface OverlayProps {
  el: HTMLElement;
  cardKey: string;
  state: CardState | undefined;
  onUpdate: (key: string, patch: Partial<CardState>) => void;
}

function CardHandle({ el, cardKey, state, onUpdate }: OverlayProps) {
  // Overlay position is managed imperatively (no state) to avoid render loops
  const overlayRef = useRef<HTMLDivElement>(null);

  // Apply saved layout state to the card DOM element
  useEffect(() => {
    const dx = state?.dx ?? 0;
    const dy = state?.dy ?? 0;
    el.style.transform  = (dx || dy) ? `translate(${dx}px, ${dy}px)` : "";
    el.style.zIndex     = (dx || dy) ? "50" : "";
    el.style.width      = state?.w ? `${state.w}px` : "";
    el.style.minHeight  = state?.h ? `${state.h}px` : "";
  }, [el, state]);

  // Keep overlay in sync with card position (imperative, no re-renders)
  const syncOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const r = el.getBoundingClientRect();
    overlay.style.left   = `${r.left}px`;
    overlay.style.top    = `${r.top}px`;
    overlay.style.width  = `${r.width}px`;
    overlay.style.height = `${r.height}px`;
  }, [el]);

  useEffect(() => {
    syncOverlay();
    // Re-sync on scroll/resize only (no ResizeObserver to avoid render loops)
    const onScroll = () => syncOverlay();
    const onResize = () => syncOverlay();
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [syncOverlay]);

  // Also sync after state changes (card size may have changed)
  useEffect(() => {
    // Small delay to let the browser finish applying the new size
    const t = setTimeout(syncOverlay, 16);
    return () => clearTimeout(t);
  }, [state, syncOverlay]);

  // ── drag ──
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const initDx = state?.dx ?? 0;
    const initDy = state?.dy ?? 0;
    const mx0 = e.clientX, my0 = e.clientY;

    const move = (ev: MouseEvent) => {
      const dx = initDx + ev.clientX - mx0;
      const dy = initDy + ev.clientY - my0;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.zIndex    = "50";
      syncOverlay();
    };
    const up = (ev: MouseEvent) => {
      const dx = initDx + ev.clientX - mx0;
      const dy = initDy + ev.clientY - my0;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      onUpdate(cardKey, { dx, dy });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // ── resize ──
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const w0 = el.offsetWidth, h0 = el.offsetHeight;
    const mx0 = e.clientX, my0 = e.clientY;

    const move = (ev: MouseEvent) => {
      el.style.width     = `${Math.max(160, w0 + ev.clientX - mx0)}px`;
      el.style.minHeight = `${Math.max(80,  h0 + ev.clientY - my0)}px`;
      syncOverlay();
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      onUpdate(cardKey, { w: el.offsetWidth, h: el.offsetHeight });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const reset = (e: React.MouseEvent) => {
    e.stopPropagation();
    el.style.transform = ""; el.style.zIndex = "";
    el.style.width     = ""; el.style.minHeight = "";
    onUpdate(cardKey, { dx: 0, dy: 0, w: undefined, h: undefined, pinned: false });
  };

  const isPinned = state?.pinned ?? false;
  const hasMoved = !!(state?.dx || state?.dy || state?.w || state?.h);
  const accent   = isPinned ? "#22c55e" : "#7c3aed";
  const accentBg = isPinned ? "rgba(34,197,94,0.12)" : "rgba(124,58,237,0.12)";
  const accentBd = isPinned ? "rgba(34,197,94,0.45)" : "rgba(124,58,237,0.45)";

  // Initial rect for inline style (will be corrected by syncOverlay in useEffect)
  const r = el.getBoundingClientRect();

  return createPortal(
    <div
      ref={overlayRef}
      style={{
        position: "fixed",
        left: r.left, top: r.top, width: r.width, height: r.height,
        zIndex: 9001, pointerEvents: "none", boxSizing: "border-box",
      }}
    >
      {/* outline */}
      <div style={{ position: "absolute", inset: 0, border: `1.5px dashed ${accentBd}`, borderRadius: 12, pointerEvents: "none" }} />

      {/* drag strip */}
      <div
        onMouseDown={startDrag}
        style={{
          position: "absolute", top: 0, left: 0, right: 50, height: 26,
          cursor: "move", pointerEvents: "all",
          display: "flex", alignItems: "center", paddingLeft: 8, gap: 6,
          background: accentBg, borderRadius: "11px 0 0 0", userSelect: "none",
        }}
      >
        <svg width="10" height="12" viewBox="0 0 10 12" fill={accent}>
          <circle cx="2.5" cy="2" r="1.2"/><circle cx="7.5" cy="2" r="1.2"/>
          <circle cx="2.5" cy="6" r="1.2"/><circle cx="7.5" cy="6" r="1.2"/>
          <circle cx="2.5" cy="10" r="1.2"/><circle cx="7.5" cy="10" r="1.2"/>
        </svg>
        <span style={{ fontSize: 10, color: accent, fontWeight: 600 }}>двигать</span>
      </div>

      {/* top-right buttons */}
      <div style={{ position: "absolute", top: 0, right: 0, display: "flex", pointerEvents: "all" }}>
        {hasMoved && (
          <button
            onClick={reset} onMouseDown={e => e.stopPropagation()}
            title="Сбросить" style={{ ...iconBtnStyle, background: "rgba(239,68,68,0.18)", color: "#ef4444", borderRadius: 0 }}
          >↺</button>
        )}
        <button
          onClick={e => { e.stopPropagation(); onUpdate(cardKey, { pinned: !isPinned }); }}
          onMouseDown={e => e.stopPropagation()}
          title={isPinned ? "Открепить" : "Закрепить"}
          style={{ ...iconBtnStyle, background: isPinned ? "rgba(34,197,94,0.18)" : "rgba(124,58,237,0.15)", color: accent, borderRadius: "0 11px 0 4px" }}
        >{isPinned ? "📌" : "📍"}</button>
      </div>

      {/* resize handle */}
      <div
        onMouseDown={startResize}
        style={{
          position: "absolute", bottom: 0, right: 0,
          width: 22, height: 22, cursor: "se-resize", pointerEvents: "all",
          display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 4,
        }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M9 1L1 9M9 5L5 9" stroke={accent} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>,
    document.body,
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 24, height: 24, border: "none",
  cursor: "pointer", fontSize: 12,
  display: "flex", alignItems: "center", justifyContent: "center",
};

// ─── context ──────────────────────────────────────────────────────────────────

const Ctx = createContext<CtxValue>({ editing: false, textScale: 1 });

export function useLayoutEditor() { return useContext(Ctx); }

// ─── provider ─────────────────────────────────────────────────────────────────

export function LayoutEditorProvider({ children }: { children: React.ReactNode }) {
  const pathname    = usePathname();
  const [mounted,   setMounted]   = useState(false);
  const [editing,   setEditing]   = useState(false);
  const [textScale, setTextScale] = useState(1);
  const [layout,    setLayout]    = useState<LayoutData>({});
  const [cards,     setCards]     = useState<Array<{ el: HTMLElement; key: string }>>([]);

  // Hydrate once from localStorage
  useEffect(() => {
    setMounted(true);
    setTextScale(loadTextScale());
    setLayout(loadLayout());
  }, []);

  // Scan .card elements when entering edit mode
  useEffect(() => {
    if (!editing || !mounted) { setCards([]); return; }
    const pageKey = pathname ?? "/";
    const scan = () => {
      const found = Array.from(document.querySelectorAll<HTMLElement>(".card")).map((el, i) => ({
        el,
        key: `${pageKey}:${i}`,
      }));
      setCards(found);
    };
    scan();
    const t1 = setTimeout(scan, 400);
    const t2 = setTimeout(scan, 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [editing, pathname, mounted]);

  // Apply pinned positions when NOT in edit mode (e.g. after navigation or page load)
  useEffect(() => {
    if (editing || !mounted) return;
    const pageKey = pathname ?? "/";
    const apply = () => {
      Array.from(document.querySelectorAll<HTMLElement>(".card")).forEach((el, i) => {
        const s = layout[`${pageKey}:${i}`];
        const dx = s?.dx ?? 0, dy = s?.dy ?? 0;
        el.style.transform  = (s?.pinned && (dx || dy)) ? `translate(${dx}px, ${dy}px)` : "";
        el.style.zIndex     = (s?.pinned && (dx || dy)) ? "50" : "";
        el.style.width      = s?.w ? `${s.w}px` : "";
        el.style.minHeight  = s?.h ? `${s.h}px` : "";
      });
    };
    const t = setTimeout(apply, 200);
    return () => clearTimeout(t);
  }, [editing, layout, pathname, mounted]);

  const updateCard = useCallback((key: string, patch: Partial<CardState>) => {
    setLayout(prev => {
      const cur  = prev[key] ?? { dx: 0, dy: 0, pinned: false };
      const next = { ...prev, [key]: { ...cur, ...patch } };
      saveLayout(next);
      return next;
    });
  }, []);

  const stepText = (dir: 1 | -1) => {
    setTextScale(prev => {
      const idx     = TEXT_STEPS.findIndex(v => Math.abs(v - prev) < 0.01);
      const nextIdx = Math.max(0, Math.min(TEXT_STEPS.length - 1, (idx < 0 ? 3 : idx) + dir));
      const next    = TEXT_STEPS[nextIdx];
      try { localStorage.setItem(LS_TEXT, String(next)); } catch {}
      return next;
    });
  };

  const resetPage = () => {
    const pageKey = pathname ?? "/";
    Array.from(document.querySelectorAll<HTMLElement>(".card")).forEach(el => {
      el.style.transform = ""; el.style.zIndex = "";
      el.style.width     = ""; el.style.minHeight = "";
    });
    setLayout(prev => {
      const next = { ...prev };
      Object.keys(next).filter(k => k.startsWith(pageKey + ":")).forEach(k => delete next[k]);
      saveLayout(next);
      return next;
    });
  };

  // Toolbar rendered via portal into document.body (bypasses overflow/z-index issues)
  const toolbar = mounted ? createPortal(
    <>
      <button
        onClick={() => setEditing(p => !p)}
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          padding: "9px 16px", borderRadius: 12,
          border: editing ? "1.5px solid #22c55e" : "1.5px solid #1e1e45",
          background: editing ? "rgba(34,197,94,0.12)" : "#141430",
          color: editing ? "#22c55e" : "#8888aa",
          cursor: "pointer", fontSize: 12, fontWeight: 700,
          boxShadow: editing
            ? "0 0 20px rgba(34,197,94,0.2), 0 4px 20px rgba(0,0,0,0.5)"
            : "0 4px 20px rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", gap: 8,
          transition: "all 0.2s", userSelect: "none",
        }}
      >
        <span style={{ fontSize: 14 }}>{editing ? "🔓" : "🔒"}</span>
        {editing ? "Зафиксировать" : "Настроить панели"}
      </button>

      {editing && (
        <div style={{
          position: "fixed", bottom: 24, right: 190, zIndex: 9999,
          display: "flex", alignItems: "center", gap: 6,
          background: "#141430", border: "1px solid #1e1e45",
          borderRadius: 12, padding: "6px 12px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          userSelect: "none",
        }}>
          <span style={{ fontSize: 11, color: "#8888aa" }}>Текст</span>
          <button onClick={() => stepText(-1)} style={smBtn}>A−</button>
          <span style={{ fontSize: 11, color: "#fff", minWidth: 36, textAlign: "center" }}>
            {Math.round(textScale * 100)}%
          </span>
          <button onClick={() => stepText(1)} style={smBtn}>A+</button>
          <div style={{ width: 1, height: 18, background: "#1e1e45", margin: "0 2px" }} />
          <button style={{ ...smBtn, color: "#ef4444" }} onClick={resetPage}>↺</button>
        </div>
      )}

      {editing && (
        <div style={{
          position: "fixed", top: 8, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, padding: "5px 16px", borderRadius: 20,
          background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
          fontSize: 11, color: "#22c55e", fontWeight: 600, pointerEvents: "none",
          whiteSpace: "nowrap",
        }}>
          ⠿ тяните панель · ↘ resize за угол · 📍 закрепить позицию · ↺ сбросить
        </div>
      )}
    </>,
    document.body,
  ) : null;

  return (
    <Ctx.Provider value={{ editing, textScale }}>
      {mounted && textScale !== 1 && (
        <style>{`.card { zoom: ${textScale}; }`}</style>
      )}

      {children}

      {editing && mounted && cards.map(({ el, key }) => (
        <CardHandle key={key} el={el} cardKey={key} state={layout[key]} onUpdate={updateCard} />
      ))}

      {toolbar}
    </Ctx.Provider>
  );
}

const smBtn: React.CSSProperties = {
  padding: "2px 8px", borderRadius: 6,
  border: "1px solid #1e1e45", background: "#1a1a38",
  color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700,
};
