"use client";

import { CASH_CURRENCIES } from "../constants";
import type { PositionForm } from "../types";

interface AddCashFormProps {
  isMobile: boolean;
  form: PositionForm;
  formError: string;
  cashCurrency: string;
  cashRate: string;
  onChange: (form: PositionForm) => void;
  onCashCurrencyChange: (code: string) => void;
  onCashRateChange: (rate: string) => void;
  onAdd: () => void;
}

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-secondary)",
  color: "var(--text-primary)",
  fontSize: 12,
  boxSizing: "border-box" as const,
};

export function AddCashForm({
  isMobile,
  form,
  formError,
  cashCurrency,
  cashRate,
  onChange,
  onCashCurrencyChange,
  onCashRateChange,
  onAdd,
}: AddCashFormProps) {
  const isStable = cashCurrency === "USD" || cashCurrency === "USDT";

  function handleCurrencyChange(code: string) {
    const cur = CASH_CURRENCIES.find(c => c.code === code);
    onCashCurrencyChange(code);
    onCashRateChange(String(cur?.defaultRate ?? 1));
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="card-title">Добавить кэш</div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 5 }}>Валюта *</div>
          <select
            value={cashCurrency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}
          >
            {CASH_CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 5 }}>Сумма *</div>
          <input
            type="number" value={form.qty} min="0" placeholder="1000"
            onChange={(e) => onChange({ ...form, qty: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 5 }}>
            Курс к $ {cashCurrency !== "USD" && <span style={{ color: "var(--text-muted)" }}>(средняя цена)</span>}
          </div>
          <input
            type="number" value={cashRate} step="0.0001" min="0"
            placeholder="1.08"
            disabled={isStable}
            onChange={(e) => onCashRateChange(e.target.value)}
            style={{
              ...inputStyle,
              background: isStable ? "var(--bg-card)" : "var(--bg-secondary)",
              color: isStable ? "var(--text-muted)" : "var(--text-primary)",
            }}
          />
          {!isStable && (
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
              ≈ {(Number(form.qty || 0) * Number(cashRate || 1)).toLocaleString("en-US", { maximumFractionDigits: 0 })} USD
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 5 }}>Дата</div>
          <input
            type="date" value={form.purchaseDate}
            onChange={(e) => onChange({ ...form, purchaseDate: e.target.value })}
            style={inputStyle}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 5 }}>Брокер</div>
          <input
            list="brokers-list" value={form.broker}
            placeholder="Interactive Brokers"
            onChange={(e) => onChange({ ...form, broker: e.target.value })}
            style={inputStyle}
          />
        </div>
        <button
          onClick={onAdd}
          style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "var(--accent)", color: "white", whiteSpace: "nowrap", alignSelf: "flex-end" }}
        >
          Добавить
        </button>
      </div>
      {formError && <div style={{ marginTop: 8, fontSize: 12, color: "#ef4444" }}>{formError}</div>}
    </div>
  );
}
