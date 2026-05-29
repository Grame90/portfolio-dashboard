"use client";

import type { Dispatch, SetStateAction } from "react";

export interface DividendFormState {
  ticker: string;
  amountPerShare: string;
  shares: string;
  date: string;
  note: string;
}

interface AddDividendModalProps {
  open: boolean;
  form: DividendFormState;
  setForm: Dispatch<SetStateAction<DividendFormState>>;
  onClose: () => void;
  onSave: () => void;
}

const FIELDS: { label: string; key: keyof DividendFormState; type: string; placeholder: string }[] = [
  { label: "Тикер",                      key: "ticker",         type: "text",   placeholder: "VOO" },
  { label: "Дивиденд на акцию (USD)",    key: "amountPerShare", type: "number", placeholder: "0.00" },
  { label: "Количество акций",           key: "shares",         type: "number", placeholder: "0" },
  { label: "Дата выплаты",               key: "date",           type: "date",   placeholder: "" },
  { label: "Примечание",                 key: "note",           type: "text",   placeholder: "Квартальный дивиденд" },
];

export function AddDividendModal({ open, form, setForm, onClose, onSave }: AddDividendModalProps) {
  if (!open) return null;
  const total = form.amountPerShare && form.shares
    ? Number(form.amountPerShare) * Number(form.shares)
    : 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="card" style={{ width: 360, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Добавить дивиденд</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 18 }}>✕</button>
        </div>
        {FIELDS.map(f => (
          <div key={f.key}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{f.label}</div>
            <input
              type={f.type}
              placeholder={f.placeholder}
              value={form[f.key]}
              onChange={(e) => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>
        ))}
        {total > 0 && (
          <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>
            Итого: ${total.toFixed(2)}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onSave} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", background: "var(--accent)", color: "white", fontWeight: 600, fontSize: 13 }}>Сохранить</button>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", background: "transparent", color: "var(--text-secondary)", fontSize: 13 }}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
