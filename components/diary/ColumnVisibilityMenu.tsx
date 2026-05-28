"use client";

// Dropdown to toggle any column on/off. Persists to localStorage via parent.
// Shows broker columns dynamically based on the brokers list.

import { useEffect, useRef, useState } from "react";
import { Columns3, Check } from "lucide-react";
import type { ColumnVisibilityState, DiaryBroker } from "@/lib/diary/types";

interface Props {
  brokers: DiaryBroker[];
  visibility: ColumnVisibilityState;
  onChange: (next: ColumnVisibilityState) => void;
}

type ColumnDef = { id: string; label: string; group: string; defaultOn: boolean };

function buildColumnDefs(brokers: DiaryBroker[]): ColumnDef[] {
  const defs: ColumnDef[] = [];
  // Brokers
  for (const b of brokers) {
    defs.push({
      id: `broker:${b.id}`,
      label: `${b.label} (${b.currency})`,
      group: "Брокеры",
      defaultOn: true,
    });
  }
  // Computed
  defs.push(
    { id: "totalUsd", label: "Total USD", group: "Расчёты", defaultOn: true },
    { id: "deltaDayPct", label: "Δ за день", group: "Расчёты", defaultOn: true },
    { id: "investedFromPositions", label: "Инвестировано", group: "Расчёты", defaultOn: true },
    { id: "transfersUsd", label: "Переводы", group: "Расчёты", defaultOn: true },
    { id: "target10Pct", label: "Целевая 10%", group: "Расчёты", defaultOn: true },
    { id: "earnedUsd", label: "Заработано USD", group: "Расчёты", defaultOn: true },
    { id: "strategyPlan", label: "План (стратегия)", group: "Расчёты", defaultOn: true },
    { id: "overProfitPct", label: "Сверх %", group: "Расчёты", defaultOn: true },
    { id: "returnPct", label: "Доходность %", group: "Расчёты", defaultOn: true },
    // Alt currencies
    { id: "balanceEur", label: "Баланс EUR", group: "Валюты", defaultOn: false },
    { id: "balanceBtc", label: "Баланс BTC", group: "Валюты", defaultOn: false },
    { id: "balanceTry", label: "Баланс TRY", group: "Валюты", defaultOn: false },
    { id: "balanceRub", label: "Баланс RUB", group: "Валюты", defaultOn: false },
    { id: "comment", label: "Комментарий", group: "Прочее", defaultOn: true },
  );
  return defs;
}

function isVisible(state: ColumnVisibilityState, def: ColumnDef): boolean {
  const v = state.visible[def.id];
  return v === undefined ? def.defaultOn : v;
}

export default function ColumnVisibilityMenu({
  brokers,
  visibility,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const defs = buildColumnDefs(brokers);
  const visibleCount = defs.filter((d) => isVisible(visibility, d)).length;

  function toggle(def: ColumnDef) {
    const current = isVisible(visibility, def);
    onChange({
      ...visibility,
      visible: { ...visibility.visible, [def.id]: !current },
    });
  }

  function showAll() {
    const next: Record<string, boolean> = {};
    for (const d of defs) next[d.id] = true;
    onChange({ visible: next });
  }
  function hideAll() {
    const next: Record<string, boolean> = {};
    for (const d of defs) next[d.id] = false;
    // Keep date column on implicitly (it's not in defs)
    onChange({ visible: next });
  }

  // Group columns for display
  const groups = new Map<string, ColumnDef[]>();
  for (const d of defs) {
    const arr = groups.get(d.group) ?? [];
    arr.push(d);
    groups.set(d.group, arr);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={triggerBtn}>
        <Columns3 size={14} />
        Колонки <span style={countBadge}>{visibleCount}/{defs.length}</span>
      </button>

      {open && (
        <div style={dropdown}>
          <div style={dropdownHeader}>
            <span>Видимость колонок</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={showAll} style={miniBtn}>Все</button>
              <button onClick={hideAll} style={miniBtn}>Никакие</button>
            </div>
          </div>

          <div style={{ maxHeight: 380, overflow: "auto" }}>
            {Array.from(groups.entries()).map(([group, items]) => (
              <div key={group} style={{ padding: "6px 0" }}>
                <div style={groupHeader}>{group}</div>
                {items.map((def) => {
                  const on = isVisible(visibility, def);
                  return (
                    <button
                      key={def.id}
                      onClick={() => toggle(def)}
                      style={{
                        ...row,
                        background: on ? "rgba(124,58,237,0.08)" : "transparent",
                      }}
                    >
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          border: `1.5px solid ${on ? "var(--accent)" : "var(--border)"}`,
                          background: on ? "var(--accent)" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {on && <Check size={12} color="white" strokeWidth={3} />}
                      </span>
                      <span style={{
                        fontSize: 12,
                        color: on ? "var(--text-primary)" : "var(--text-secondary)",
                      }}>
                        {def.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const triggerBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  padding: "8px 13px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-secondary)",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
};

const countBadge: React.CSSProperties = {
  fontSize: 10,
  padding: "1px 6px",
  borderRadius: 6,
  background: "var(--bg-secondary)",
  color: "var(--text-muted)",
};

const dropdown: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 6px)",
  right: 0,
  zIndex: 100,
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
  minWidth: 260,
  padding: 6,
};

const dropdownHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 10px",
  borderBottom: "1px solid var(--border)",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "var(--text-muted)",
};

const miniBtn: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  padding: "3px 8px",
  borderRadius: 5,
  border: "1px solid var(--border)",
  background: "var(--bg-secondary)",
  color: "var(--text-secondary)",
  cursor: "pointer",
};

const groupHeader: React.CSSProperties = {
  padding: "6px 12px 4px",
  fontSize: 10,
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  width: "100%",
  padding: "8px 12px",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left",
  borderRadius: 6,
};
