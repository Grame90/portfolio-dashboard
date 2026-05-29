"use client";

import { Dialog } from "@/components/ui/Dialog";
import { Select, SelectItem } from "@/components/ui/Select";
import { TYPES } from "../constants";
import type { PositionForm } from "../types";

interface EditPositionDialogProps {
  open: boolean;
  form: PositionForm;
  onChange: (form: PositionForm) => void;
  onClose: () => void;
  onSave: () => void;
}

export function EditPositionDialog({ open, form, onChange, onClose, onSave }: EditPositionDialogProps) {
  const fields = [
    { label: "Тикер", key: "ticker" as const, type: "text" },
    { label: "Название", key: "name" as const, type: "text" },
    { label: "Количество", key: "qty" as const, type: "number" },
    { label: "Средняя цена ($)", key: "avgPrice" as const, type: "number" },
    { label: "Текущая цена ($)", key: "currentPrice" as const, type: "number" },
    { label: "Дата покупки", key: "purchaseDate" as const, type: "date" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }} title="Редактировать позицию" maxWidth={500}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, padding: "10px 12px", background: "var(--bg-secondary)", borderRadius: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: form.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "white", flexShrink: 0 }}>
          {(form.ticker || "??").slice(0, 2)}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{form.ticker || "—"}</div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{form.name || "Инструмент"}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        {fields.map((f) => (
          <div key={f.key}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 5 }}>{f.label}</div>
            <input
              type={f.type}
              value={form[f.key]}
              onChange={(e) => onChange({ ...form, [f.key]: e.target.value })}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>Тип актива</div>
          <Select value={form.type} onValueChange={(v) => onChange({ ...form, type: v })}>
            {TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </Select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>Брокер</div>
          <input
            list="brokers-list"
            value={form.broker}
            onChange={(e) => onChange({ ...form, broker: e.target.value })}
            placeholder="Interactive Brokers"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box" }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Отмена</button>
        <button onClick={onSave} style={{ flex: 2, padding: "10px", borderRadius: 8, border: "none", background: "var(--accent)", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Сохранить изменения</button>
      </div>
    </Dialog>
  );
}
