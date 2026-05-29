"use client";

import type { Dispatch, SetStateAction } from "react";

export interface DividendFormState {
  ticker: string;
  amountPerShare: string;
  shares: string;
  date: string;
  note: string;
  broker: string;
}

export interface TickerOption {
  ticker: string;
  shares: number;
  broker?: string;
}

interface AddDividendModalProps {
  open: boolean;
  form: DividendFormState;
  setForm: Dispatch<SetStateAction<DividendFormState>>;
  onClose: () => void;
  onSave: () => void;
  isEdit?: boolean;
  tickerOptions: TickerOption[];
  brokerOptions: string[];
}

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-secondary)",
  color: "var(--text-primary)",
  fontSize: 13,
  boxSizing: "border-box" as const,
};

export function AddDividendModal({
  open, form, setForm, onClose, onSave, isEdit = false,
  tickerOptions, brokerOptions,
}: AddDividendModalProps) {
  if (!open) return null;
  const total = form.amountPerShare && form.shares
    ? Number(form.amountPerShare) * Number(form.shares)
    : 0;

  function handleTickerChange(ticker: string) {
    const upper = ticker.toUpperCase();
    const opt = tickerOptions.find(t => t.ticker === upper);
    setForm(p => ({
      ...p,
      ticker: upper,
      // Auto-fill shares + broker from the matching position if user picked a known ticker.
      shares: opt ? String(opt.shares.toFixed(2)) : p.shares,
      broker: opt?.broker ?? p.broker,
    }));
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div className="card" style={{ width: 380, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {isEdit ? "Редактировать дивиденд" : "Добавить дивиденд"}
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 18 }}
          >✕</button>
        </div>

        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>Тикер</div>
          <input
            list="dividend-ticker-options"
            placeholder="VOO"
            value={form.ticker}
            onChange={(e) => handleTickerChange(e.target.value)}
            style={inputStyle}
          />
          <datalist id="dividend-ticker-options">
            {tickerOptions.map(t => (
              <option key={t.ticker} value={t.ticker}>{t.broker ? `${t.shares.toFixed(2)} шт. · ${t.broker}` : `${t.shares.toFixed(2)} шт.`}</option>
            ))}
          </datalist>
          {form.ticker && !tickerOptions.find(t => t.ticker === form.ticker.toUpperCase()) && (
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
              Нет такой позиции в портфеле — можно ввести вручную
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>Дивиденд на акцию (USD)</div>
          <input
            type="number" placeholder="0.00" value={form.amountPerShare}
            onChange={(e) => setForm(p => ({ ...p, amountPerShare: e.target.value }))}
            style={inputStyle}
          />
        </div>

        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>Количество акций</div>
          <input
            type="number" placeholder="0" value={form.shares}
            onChange={(e) => setForm(p => ({ ...p, shares: e.target.value }))}
            style={inputStyle}
          />
        </div>

        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>Дата выплаты</div>
          <input
            type="date" value={form.date}
            onChange={(e) => setForm(p => ({ ...p, date: e.target.value }))}
            style={inputStyle}
          />
        </div>

        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>Брокер</div>
          <input
            list="dividend-broker-options"
            placeholder="Interactive Brokers"
            value={form.broker}
            onChange={(e) => setForm(p => ({ ...p, broker: e.target.value }))}
            style={inputStyle}
          />
          <datalist id="dividend-broker-options">
            {brokerOptions.map(b => <option key={b} value={b} />)}
          </datalist>
        </div>

        <div>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>Примечание</div>
          <input
            type="text" placeholder="Квартальный дивиденд" value={form.note}
            onChange={(e) => setForm(p => ({ ...p, note: e.target.value }))}
            style={inputStyle}
          />
        </div>

        {total > 0 && (
          <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>
            Итого: ${total.toFixed(2)}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onSave}
            style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", background: "var(--accent)", color: "white", fontWeight: 600, fontSize: 13 }}
          >{isEdit ? "Сохранить" : "Добавить"}</button>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", background: "transparent", color: "var(--text-secondary)", fontSize: 13 }}
          >Отмена</button>
        </div>
      </div>
    </div>
  );
}
