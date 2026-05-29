"use client";

import type { TargetRow } from "../types";

interface EditInstrumentsDialogProps {
  open: boolean;
  rows: TargetRow[];
  onAddRow: () => void;
  onRemoveRow: (i: number) => void;
  onUpdateRow: (i: number, field: keyof TargetRow, value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function EditInstrumentsDialog({
  open,
  rows,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
  onClose,
  onSave,
}: EditInstrumentsDialogProps) {
  if (!open) return null;

  const total = rows.reduce((s, r) => s + r.target, 0);
  const totalOk = Math.abs(total - 100) < 0.01;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "var(--bg-card)", borderRadius: 16, padding: 28, width: 520,
        maxHeight: "80vh", display: "flex", flexDirection: "column", gap: 16,
        border: "1px solid var(--border)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Редактировать инструменты</div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-secondary)", fontSize: 20, cursor: "pointer" }}
          >✕</button>
        </div>

        <div style={{ fontSize: 12, color: totalOk ? "#22c55e" : "#f59e0b", fontWeight: 600 }}>
          Сумма целей: {total.toFixed(2)}% {totalOk ? "✓" : "(должно быть 100%)"}
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600 }}>Тикер</th>
                <th style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600 }}>Целевая доля, %</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "6px 8px" }}>
                    <input
                      value={row.ticker}
                      onChange={(e) => onUpdateRow(i, "ticker", e.target.value)}
                      placeholder="TICKER"
                      style={{
                        width: "100%", padding: "5px 8px", borderRadius: 6,
                        border: "1px solid var(--border)", background: "var(--bg-secondary)",
                        color: "var(--text-primary)", fontSize: 13, fontWeight: 600,
                      }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <input
                      type="number" min={0} max={100} step={0.1} value={row.target}
                      onChange={(e) => onUpdateRow(i, "target", e.target.value)}
                      style={{
                        width: "100%", padding: "5px 8px", borderRadius: 6, textAlign: "right",
                        border: "1px solid var(--border)", background: "var(--bg-secondary)",
                        color: "var(--text-primary)", fontSize: 13,
                      }}
                    />
                  </td>
                  <td style={{ padding: "6px 4px", textAlign: "center" }}>
                    <button
                      onClick={() => onRemoveRow(i)}
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
                    >✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={onAddRow}
            style={{
              padding: "7px 14px", borderRadius: 8, border: "1px dashed var(--border)",
              background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12,
            }}
          >+ Добавить инструмент</button>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              padding: "8px 18px", borderRadius: 8, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13,
            }}
          >Отмена</button>
          <button
            onClick={onSave}
            style={{
              padding: "8px 22px", borderRadius: 8, border: "none",
              background: "var(--accent)", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700,
            }}
          >Сохранить</button>
        </div>
      </div>
    </div>
  );
}
