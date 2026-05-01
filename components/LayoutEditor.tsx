"use client";

import { createContext, useContext, useState, useEffect, useRef } from "react";

type Sizes = Record<string, { w?: number; h?: number }>;

interface EditContextValue {
  editing: boolean;
  sizes: Sizes;
  setSize: (id: string, w: number | undefined, h: number) => void;
}

const EditCtx = createContext<EditContextValue | null>(null);

export function useEditCtx() {
  return useContext(EditCtx);
}

const LS_KEY = "card-layout-sizes";

function loadSizes(): Sizes {
  try {
    const s = localStorage.getItem(LS_KEY);
    return s ? JSON.parse(s) : {};
  } catch { return {}; }
}

function saveSizes(s: Sizes) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}

export function LayoutEditorProvider({ children }: { children: React.ReactNode }) {
  const [editing, setEditing] = useState(false);
  const [sizes, setSizes] = useState<Sizes>({});

  useEffect(() => { setSizes(loadSizes()); }, []);

  function setSize(id: string, w: number | undefined, h: number) {
    setSizes(prev => {
      const next = { ...prev, [id]: { w, h } };
      saveSizes(next);
      return next;
    });
  }

  return (
    <EditCtx.Provider value={{ editing, sizes, setSize }}>
      {children}

      {/* Floating lock button */}
      <button
        onClick={() => setEditing(p => !p)}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9000,
          padding: "10px 20px",
          borderRadius: 12,
          border: editing ? "1.5px solid #22c55e" : "1.5px solid var(--border)",
          background: editing ? "rgba(34,197,94,0.12)" : "var(--bg-card)",
          color: editing ? "#22c55e" : "var(--text-secondary)",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 700,
          boxShadow: editing
            ? "0 0 20px rgba(34,197,94,0.25), 0 4px 16px rgba(0,0,0,0.3)"
            : "0 4px 16px rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "all 0.2s",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 14 }}>{editing ? "🔓" : "🔒"}</span>
        {editing ? "Зафиксировать макет" : "Настроить макет"}
      </button>

      {editing && (
        <div style={{
          position: "fixed",
          top: 8,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9000,
          padding: "6px 16px",
          borderRadius: 20,
          background: "rgba(34,197,94,0.15)",
          border: "1px solid #22c55e44",
          fontSize: 11,
          color: "#22c55e",
          fontWeight: 600,
          pointerEvents: "none",
        }}>
          Режим редактирования — тяните за уголок карточки для изменения размера
        </div>
      )}
    </EditCtx.Provider>
  );
}

export function ResizableCard({
  id,
  className = "card",
  style,
  children,
}: {
  id: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const ctx = useEditCtx();
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  const saved = ctx?.sizes[id];

  function onMouseDown(e: React.MouseEvent) {
    if (!ctx?.editing) return;
    e.preventDefault();
    e.stopPropagation();
    const el = cardRef.current;
    if (!el) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: el.offsetWidth,
      startH: el.offsetHeight,
    };

    function onMove(ev: MouseEvent) {
      if (!dragRef.current || !cardRef.current) return;
      const newW = Math.max(150, dragRef.current.startW + ev.clientX - dragRef.current.startX);
      const newH = Math.max(80, dragRef.current.startH + ev.clientY - dragRef.current.startY);
      cardRef.current.style.width = `${newW}px`;
      cardRef.current.style.minHeight = `${newH}px`;
    }

    function onUp() {
      if (cardRef.current) {
        const w = cardRef.current.offsetWidth;
        const h = cardRef.current.offsetHeight;
        ctx?.setSize(id, w, h);
      }
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  const editing = ctx?.editing ?? false;

  return (
    <div
      ref={cardRef}
      className={className}
      style={{
        ...style,
        minHeight: saved?.h ?? (style?.minHeight as number | undefined),
        width: saved?.w ? `${saved.w}px` : (style?.width as string | undefined),
        position: "relative",
        outline: editing ? "1.5px dashed rgba(34,197,94,0.4)" : undefined,
        transition: editing ? "outline 0.15s" : undefined,
        boxSizing: "border-box",
      }}
    >
      {children}

      {editing && (
        <>
          {/* drag handle bottom-right */}
          <div
            onMouseDown={onMouseDown}
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 20,
              height: 20,
              cursor: "se-resize",
              zIndex: 10,
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-end",
              padding: 3,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M9 1L1 9M9 5L5 9M9 9" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* reset size button */}
          {saved && (
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={() => {
                if (!cardRef.current) return;
                cardRef.current.style.width = "";
                cardRef.current.style.minHeight = "";
                ctx?.setSize(id, undefined, 0);
              }}
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: "none",
                background: "rgba(239,68,68,0.2)",
                color: "#ef4444",
                cursor: "pointer",
                fontSize: 9,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
                lineHeight: 1,
              }}
              title="Сбросить размер"
            >
              ✕
            </button>
          )}
        </>
      )}
    </div>
  );
}
