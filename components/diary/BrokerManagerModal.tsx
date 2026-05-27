"use client";

// Modal for managing diary brokers — add, edit, remove.
// Add flow: dropdown of broker names found in /positions, or free text.

import { useMemo, useState } from "react";
import { X, Trash2, Plus, Edit2, Save } from "lucide-react";
import {
  CURRENCY_LABELS,
} from "@/lib/diary/types";
import type { BrokerCurrency, DiaryBroker } from "@/lib/diary/types";
import {
  inferBrokerCurrency,
  summarizeCurrencyMix,
} from "@/lib/diary/broker-currency";
import { usePortfolioStore } from "@/lib/store/usePortfolioStore";

interface Props {
  brokers: DiaryBroker[];
  onChange: (brokers: DiaryBroker[]) => void;
  onClose: () => void;
}

const CURRENCIES: BrokerCurrency[] = ["USD", "TRY", "RUB", "EUR"];

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24) || `broker-${Date.now()}`;
}

export default function BrokerManagerModal({
  brokers,
  onChange,
  onClose,
}: Props) {
  const positions = usePortfolioStore((s) => s.positions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DiaryBroker | null>(null);
  const [adding, setAdding] = useState(false);

  // Unique broker names from /positions for the dropdown.
  const positionBrokerNames = useMemo(() => {
    const set = new Set<string>();
    for (const p of positions) {
      if (p.broker?.trim()) set.add(p.broker.trim());
    }
    return Array.from(set).sort();
  }, [positions]);

  // Names not yet mapped to any diary broker
  const unmappedNames = useMemo(() => {
    const mapped = new Set(
      brokers.flatMap((b) => b.positionBrokers.map((n) => n.toLowerCase())),
    );
    return positionBrokerNames.filter((n) => !mapped.has(n.toLowerCase()));
  }, [positionBrokerNames, brokers]);

  function startEdit(b: DiaryBroker) {
    setDraft({ ...b, positionBrokers: [...b.positionBrokers] });
    setEditingId(b.id);
    setAdding(false);
  }

  function startAdd(preset?: string) {
    const label = preset?.trim() || "";
    setDraft({
      id: slugify(label || `broker-${Date.now()}`),
      label,
      currency: "USD",
      isCrypto: false,
      positionBrokers: preset ? [preset] : [],
      order: (brokers[brokers.length - 1]?.order ?? 0) + 1,
    });
    setEditingId(null);
    setAdding(true);
  }

  function saveDraft() {
    if (!draft) return;
    if (!draft.label.trim()) {
      alert("Введите название брокера");
      return;
    }
    const finalDraft = {
      ...draft,
      id: editingId ?? (draft.id || slugify(draft.label)),
    };
    if (adding) {
      // Ensure id is unique
      if (brokers.some((b) => b.id === finalDraft.id)) {
        finalDraft.id = `${finalDraft.id}-${Date.now()}`;
      }
      onChange([...brokers, finalDraft]);
    } else if (editingId) {
      onChange(
        brokers.map((b) => (b.id === editingId ? finalDraft : b)),
      );
    }
    setDraft(null);
    setEditingId(null);
    setAdding(false);
  }

  function cancelDraft() {
    setDraft(null);
    setEditingId(null);
    setAdding(false);
  }

  function removeBroker(id: string) {
    if (!confirm("Удалить брокера? Балансы за прошлые даты не пропадут, но колонка скроется.")) {
      return;
    }
    onChange(brokers.filter((b) => b.id !== id));
  }

  function move(id: string, dir: -1 | 1) {
    const sorted = [...brokers].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= sorted.length) return;
    const next = sorted.map((b, i) => {
      if (i === idx) return { ...b, order: sorted[swapWith].order };
      if (i === swapWith) return { ...b, order: sorted[idx].order };
      return b;
    });
    onChange(next);
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <header style={headerBar}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Управление брокерами
          </h2>
          <button onClick={onClose} style={iconBtn} aria-label="Закрыть">
            <X size={18} />
          </button>
        </header>

        <div style={body}>
          <p style={subline}>
            Брокеры формируют колонки в журнале. К каждому привязываются имена
            из <code style={code}>/positions</code> — балансы собираются по этим именам.
          </p>

          {/* Existing brokers */}
          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0" }}>
            {[...brokers].sort((a, b) => a.order - b.order).map((b, i, arr) => (
              <li key={b.id}>
                {editingId === b.id && draft ? (
                  <BrokerForm
                    draft={draft}
                    setDraft={setDraft}
                    positionBrokerNames={positionBrokerNames}
                    positions={positions}
                    onSave={saveDraft}
                    onCancel={cancelDraft}
                  />
                ) : (
                  <div style={brokerRow}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{b.label}</span>
                        <span style={tagStyle(b.currency)}>{b.currency}</span>
                        {b.isCrypto && <span style={cryptoTag}>крипта</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {b.positionBrokers.length > 0
                          ? `Маппинг: ${b.positionBrokers.join(", ")}`
                          : "Маппинг не задан (балансы не будут собираться)"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => move(b.id, -1)} disabled={i === 0} style={smallIcon}>↑</button>
                      <button onClick={() => move(b.id, 1)} disabled={i === arr.length - 1} style={smallIcon}>↓</button>
                      <button onClick={() => startEdit(b)} style={smallIcon} title="Редактировать">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => removeBroker(b.id)} style={{ ...smallIcon, color: "#ef4444" }} title="Удалить">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {/* Add new */}
          {adding && draft ? (
            <div style={{ marginTop: 8 }}>
              <BrokerForm
                draft={draft}
                setDraft={setDraft}
                positionBrokerNames={positionBrokerNames}
                positions={positions}
                onSave={saveDraft}
                onCancel={cancelDraft}
              />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => startAdd()} style={addBtn}>
                <Plus size={14} /> Добавить брокера вручную
              </button>
              {unmappedNames.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                    Из ваших позиций — не привязаны:
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {unmappedNames.map((n) => (
                      <button
                        key={n}
                        onClick={() => startAdd(n)}
                        style={chipBtn}
                      >
                        <Plus size={12} /> {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inline form for create/edit ─────────────────────────────────────────

function BrokerForm({
  draft,
  setDraft,
  positionBrokerNames,
  positions,
  onSave,
  onCancel,
}: {
  draft: DiaryBroker;
  setDraft: (b: DiaryBroker) => void;
  positionBrokerNames: string[];
  positions: import("@/lib/types").StoredPosition[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const [newMapping, setNewMapping] = useState("");

  // Auto-detected currency from positions matching this broker's mapping.
  // We don't auto-apply on every change (user may have intentionally overridden);
  // instead we surface the suggestion and an explicit "Авто" button to apply.
  const inferredCurrency = useMemo(
    () => inferBrokerCurrency(draft.positionBrokers, positions),
    [draft.positionBrokers, positions],
  );
  const currencyMix = useMemo(
    () => summarizeCurrencyMix(draft.positionBrokers, positions),
    [draft.positionBrokers, positions],
  );

  function addMapping(name: string) {
    const v = name.trim();
    if (!v || draft.positionBrokers.includes(v)) return;
    const nextMapping = [...draft.positionBrokers, v];
    // Auto-set currency if user hasn't intentionally chosen one yet (= default USD on fresh draft).
    const auto = inferBrokerCurrency(nextMapping, positions);
    setDraft({
      ...draft,
      positionBrokers: nextMapping,
      currency: auto ?? draft.currency,
    });
    setNewMapping("");
  }
  function removeMapping(name: string) {
    setDraft({
      ...draft,
      positionBrokers: draft.positionBrokers.filter((x) => x !== name),
    });
  }

  return (
    <div style={formBox}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 8 }}>
        <div>
          <label style={lblStyle}>Название</label>
          <input
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="IBKR, OSMAN, Bybit…"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={lblStyle}>
            Валюта
            {inferredCurrency && inferredCurrency !== draft.currency && (
              <button
                type="button"
                onClick={() => setDraft({ ...draft, currency: inferredCurrency })}
                style={{
                  marginLeft: 6,
                  padding: "1px 6px",
                  fontSize: 10,
                  borderRadius: 4,
                  border: "1px solid var(--accent, #3b82f6)",
                  background: "transparent",
                  color: "var(--accent, #3b82f6)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
                title="Применить валюту, определённую по позициям"
              >
                ← {inferredCurrency}
              </button>
            )}
          </label>
          <select
            value={draft.currency}
            onChange={(e) =>
              setDraft({ ...draft, currency: e.target.value as BrokerCurrency })
            }
            style={inputStyle}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{CURRENCY_LABELS[c]}</option>
            ))}
          </select>
          {currencyMix && (
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
              В позициях: {currencyMix}
            </div>
          )}
        </div>
      </div>

      <label style={{ ...lblStyle, display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
        <input
          type="checkbox"
          checked={draft.isCrypto}
          onChange={(e) => setDraft({ ...draft, isCrypto: e.target.checked })}
        />
        Это криптобиржа (метка для аналитики)
      </label>

      <div style={{ marginTop: 10 }}>
        <label style={lblStyle}>Имена в позициях (маппинг)</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {draft.positionBrokers.map((n) => (
            <span key={n} style={mappingChip}>
              {n}
              <button onClick={() => removeMapping(n)} style={chipRemove}>×</button>
            </span>
          ))}
          {draft.positionBrokers.length === 0 && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Маппинг пуст — добавьте хотя бы одно имя
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={newMapping}
            onChange={(e) => setNewMapping(e.target.value)}
            placeholder="IBKR, Interactive Brokers…"
            style={{ ...inputStyle, flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addMapping(newMapping);
              }
            }}
            list="position-broker-suggestions"
          />
          <datalist id="position-broker-suggestions">
            {positionBrokerNames.map((n) => <option key={n} value={n} />)}
          </datalist>
          <button onClick={() => addMapping(newMapping)} style={chipBtn}>
            <Plus size={12} /> Добавить
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={cancelBtn}>Отмена</button>
        <button onClick={onSave} style={saveBtn}>
          <Save size={13} /> Сохранить
        </button>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 16,
};

const modal: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  width: "100%",
  maxWidth: 640,
  maxHeight: "85vh",
  overflow: "auto",
  display: "flex",
  flexDirection: "column",
};

const headerBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 18px",
  borderBottom: "1px solid var(--border)",
};

const iconBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--text-secondary)",
  padding: 4,
};

const body: React.CSSProperties = { padding: 18 };

const subline: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "var(--text-muted)",
  lineHeight: 1.5,
};

const code: React.CSSProperties = {
  background: "var(--bg-secondary)",
  padding: "1px 5px",
  borderRadius: 4,
  fontSize: 11,
};

const brokerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  background: "var(--bg-secondary)",
  borderRadius: 8,
  marginBottom: 6,
};

const smallIcon: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "4px 7px",
  cursor: "pointer",
  color: "var(--text-secondary)",
  fontSize: 12,
};

const tagStyle = (currency: BrokerCurrency): React.CSSProperties => ({
  fontSize: 10,
  fontWeight: 700,
  padding: "2px 6px",
  borderRadius: 4,
  background: "rgba(124,58,237,0.15)",
  color: "var(--accent-light)",
});

const cryptoTag: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: "2px 6px",
  borderRadius: 4,
  background: "rgba(245,158,11,0.15)",
  color: "#f59e0b",
};

const addBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "9px 14px",
  borderRadius: 8,
  border: "1px dashed var(--border)",
  background: "transparent",
  color: "var(--text-secondary)",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
};

const chipBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "5px 10px",
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "var(--bg-secondary)",
  color: "var(--text-secondary)",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600,
};

const formBox: React.CSSProperties = {
  padding: 14,
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  marginBottom: 12,
};

const lblStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  fontSize: 13,
};

const mappingChip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 8px",
  borderRadius: 12,
  background: "rgba(124,58,237,0.15)",
  color: "var(--accent-light)",
  fontSize: 11,
  fontWeight: 600,
};

const chipRemove: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "inherit",
  fontSize: 14,
  padding: 0,
  lineHeight: 1,
};

const cancelBtn: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: 7,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-secondary)",
  cursor: "pointer",
  fontSize: 12,
};

const saveBtn: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "7px 14px",
  borderRadius: 7,
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "white",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
};
