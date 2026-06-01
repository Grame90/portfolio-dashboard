"use client";

import {
  createContext, useContext, useState, useEffect, useRef, useCallback,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

// ─── types ────────────────────────────────────────────────────────────────────

interface CardState {
  // Legacy: dx/dy used to be supported but caused grid gaps. Now ignored on
  // load, kept on the type so old saved values don't break parsing.
  dx?: number;
  dy?: number;
  w?: number;
  h?: number;
  pinned: boolean;
}

type LayoutData = Record<string, CardState>;

interface CtxValue {
  editing: boolean;
  textScale: number;
  setEditing?: (v: boolean | ((p: boolean) => boolean)) => void;
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

  // Apply saved layout state to the card DOM element. Drag (dx/dy) is no
  // longer applied — only width/height. This keeps cards inside their grid
  // slots so no empty gaps appear.
  useEffect(() => {
    // Always clear any leftover transform from older saved states.
    el.style.transform = "";
    el.style.zIndex    = "";
    el.style.width     = state?.w ? `${state.w}px` : "";
    el.style.height    = state?.h ? `${state.h}px` : "";
    el.style.minHeight = state?.h ? `${state.h}px` : "";
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

  // Resize either axis. `axis`: "x" = width-only, "y" = height-only, "xy" = both.
  const startResize = (axis: "x" | "y" | "xy") => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const w0 = el.offsetWidth, h0 = el.offsetHeight;
    const mx0 = e.clientX, my0 = e.clientY;
    const pointerId = e.pointerId;
    (e.target as Element).setPointerCapture?.(pointerId);

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      if (axis !== "y") {
        el.style.width = `${Math.max(160, w0 + ev.clientX - mx0)}px`;
      }
      if (axis !== "x") {
        const h = Math.max(80, h0 + ev.clientY - my0);
        el.style.height = `${h}px`;
        el.style.minHeight = `${h}px`;
      }
      syncOverlay();
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      onUpdate(cardKey, { w: el.offsetWidth, h: el.offsetHeight });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const reset = (e: React.MouseEvent) => {
    e.stopPropagation();
    el.style.transform = ""; el.style.zIndex = "";
    el.style.width     = "";
    el.style.height    = "";
    el.style.minHeight = "";
    onUpdate(cardKey, { w: undefined, h: undefined, pinned: false });
  };

  const isPinned = state?.pinned ?? false;
  const hasMoved = !!(state?.w || state?.h);
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

      {/* info label (replaces former drag strip — cards no longer reposition) */}
      <div
        style={{
          position: "absolute", top: 0, left: 0, right: 56, height: 28,
          pointerEvents: "none",
          display: "flex", alignItems: "center", paddingLeft: 10, gap: 8,
          background: accentBg, borderRadius: "11px 0 0 0", userSelect: "none",
        }}
      >
        <span style={{ fontSize: 10, color: accent, fontWeight: 600, opacity: 0.85 }}>
          размер
        </span>
      </div>

      {/* top-right buttons */}
      <div style={{ position: "absolute", top: 0, right: 0, display: "flex", pointerEvents: "all" }}>
        {hasMoved && (
          <button
            onClick={reset}
            onPointerDown={e => e.stopPropagation()}
            title="Сбросить"
            style={{ ...iconBtnStyle, background: "rgba(239,68,68,0.18)", color: "#ef4444", borderRadius: 0 }}
          >↺</button>
        )}
        <button
          onClick={e => { e.stopPropagation(); onUpdate(cardKey, { pinned: !isPinned }); }}
          onPointerDown={e => e.stopPropagation()}
          title={isPinned ? "Открепить" : "Закрепить"}
          style={{ ...iconBtnStyle, background: isPinned ? "rgba(34,197,94,0.18)" : "rgba(124,58,237,0.15)", color: accent, borderRadius: "0 11px 0 4px" }}
        >{isPinned ? "📌" : "📍"}</button>
      </div>

      {/* right-edge handle — width-only */}
      <div
        onPointerDown={startResize("x")}
        title="Изменить ширину"
        style={{
          position: "absolute", top: 32, bottom: 24, right: -3,
          width: 10, cursor: "ew-resize", pointerEvents: "all", touchAction: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <div style={{ width: 3, height: 28, background: accent, borderRadius: 2, opacity: 0.7 }} />
      </div>

      {/* bottom-edge handle — height-only */}
      <div
        onPointerDown={startResize("y")}
        title="Изменить высоту"
        style={{
          position: "absolute", left: 24, right: 24, bottom: -3,
          height: 10, cursor: "ns-resize", pointerEvents: "all", touchAction: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <div style={{ height: 3, width: 28, background: accent, borderRadius: 2, opacity: 0.7 }} />
      </div>

      {/* bottom-right corner — both axes */}
      <div
        onPointerDown={startResize("xy")}
        title="Изменить размер"
        style={{
          position: "absolute", bottom: 0, right: 0,
          width: 28, height: 28, cursor: "se-resize", pointerEvents: "all", touchAction: "none",
          display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 5,
          background: accentBg, borderRadius: "0 0 11px 0",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
          <path d="M9 1L1 9M9 5L5 9" stroke={accent} strokeWidth="1.8" strokeLinecap="round"/>
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
      el.style.width     = "";
      el.style.height    = "";
      el.style.minHeight = "";
    });
    setLayout(prev => {
      const next = { ...prev };
      Object.keys(next).filter(k => k.startsWith(pageKey + ":")).forEach(k => delete next[k]);
      saveLayout(next);
      return next;
    });
  };

  const resetAllPages = () => {
    if (!window.confirm("Сбросить расположение и размер ВСЕХ карточек на ВСЕХ страницах?")) return;
    Array.from(document.querySelectorAll<HTMLElement>(".card")).forEach(el => {
      el.style.transform = ""; el.style.zIndex = "";
      el.style.width     = "";
      el.style.height    = "";
      el.style.minHeight = "";
    });
    setLayout({});
    saveLayout({});
  };

  // Toolbar rendered via portal into document.body (bypasses overflow/z-index issues)
  const toolbar = mounted ? createPortal(
    <>
      {/* The lock toggle button now lives in the MarketTicker bar (top), next
          to the gear icon. The bottom-right cluster shows text-scale controls
          only when editing. */}

      {editing && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
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
          <button
            style={{ ...smBtn, color: "#ef4444" }}
            onClick={resetPage}
            title="Сбросить расположение карточек на этой странице"
          >↺</button>
          <button
            style={{ ...smBtn, color: "#ef4444", fontSize: 9, fontWeight: 800 }}
            onClick={resetAllPages}
            title="Сбросить расположение на ВСЕХ страницах"
          >↺ВСЁ</button>
        </div>
      )}

      {editing && (
        <div style={{
          position: "fixed", top: 42, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, padding: "5px 14px", borderRadius: 20,
          background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.35)",
          fontSize: 11, color: "#a78bfa", fontWeight: 600, pointerEvents: "none",
          whiteSpace: "nowrap",
        }}>
          │ правая грань — ширина · ─ нижняя грань — высота · ↘ угол — оба · 📍 закрепить · ↺ сброс
        </div>
      )}
    </>,
    document.body,
  ) : null;

  return (
    <Ctx.Provider value={{ editing, textScale, setEditing }}>
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
