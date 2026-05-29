"use client";

import type { KeyboardEvent } from "react";
import { BROKERS } from "../constants";
import { detectInstrumentType } from "../utils";
import type { PositionForm } from "../types";

export interface SearchResult {
  symbol: string;
  description: string;
  type: string;
}

interface AddInstrumentFormProps {
  isMobile: boolean;
  form: PositionForm;
  formError: string;
  onChange: (form: PositionForm) => void;
  onAdd: () => void;
  searchResults: SearchResult[];
  searchLoading: boolean;
  dropdownOpen: boolean;
  dropdownIdx: number;
  onDropdownOpenChange: (open: boolean) => void;
  onDropdownIdxChange: (idx: number | ((prev: number) => number)) => void;
  onTickerInput: (value: string) => void;
  onSelectResult: (item: SearchResult) => void;
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

export function AddInstrumentForm({
  isMobile,
  form,
  formError,
  onChange,
  onAdd,
  searchResults,
  searchLoading,
  dropdownOpen,
  dropdownIdx,
  onDropdownOpenChange,
  onDropdownIdxChange,
  onTickerInput,
  onSelectResult,
}: AddInstrumentFormProps) {
  function handleTickerKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!dropdownOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      onDropdownIdxChange((i) => Math.min(i + 1, searchResults.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onDropdownIdxChange((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && dropdownIdx >= 0) {
      e.preventDefault();
      onSelectResult(searchResults[dropdownIdx]);
    }
    if (e.key === "Escape") {
      onDropdownOpenChange(false);
    }
  }

  const textFields = [
    { label: "Название", key: "name" as const, placeholder: "Apple Inc.", type: "text" },
    { label: "Кол-во *", key: "qty" as const, placeholder: "10", type: "number" },
    { label: "Ср.цена * ($)", key: "avgPrice" as const, placeholder: "150.00", type: "number" },
    { label: "Дата покупки", key: "purchaseDate" as const, placeholder: "", type: "date" },
  ];

  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="card-title">Новый инструмент</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr 1fr 1fr 1fr", gap: 10, alignItems: "end" }}>
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 5 }}>
              Тикер *{searchLoading && <span style={{ marginLeft: 5, color: "var(--accent-light)" }}>…</span>}
            </div>
            <input
              type="text"
              value={form.ticker}
              onChange={(e) => onTickerInput(e.target.value)}
              onFocus={() => searchResults.length > 0 && onDropdownOpenChange(true)}
              onBlur={() => setTimeout(() => onDropdownOpenChange(false), 150)}
              onKeyDown={handleTickerKeyDown}
              placeholder="AAPL"
              autoComplete="off"
              style={{ ...inputStyle, border: `1px solid ${dropdownOpen ? "var(--accent)" : "var(--border)"}` }}
            />
            {dropdownOpen && searchResults.length > 0 && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 500, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                {searchResults.map((item, idx) => (
                  <div
                    key={item.symbol}
                    onMouseDown={() => onSelectResult(item)}
                    onMouseEnter={() => onDropdownIdxChange(idx)}
                    style={{ padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, background: idx === dropdownIdx ? "rgba(124,58,237,0.12)" : "transparent", borderBottom: idx < searchResults.length - 1 ? "1px solid var(--border)" : "none" }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 12, color: "var(--accent-light)", minWidth: 52 }}>{item.symbol}</span>
                    <span style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</span>
                    <span style={{ marginLeft: "auto", fontSize: 9, flexShrink: 0, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "rgba(124,58,237,0.15)", color: "var(--accent-light)" }}>{detectInstrumentType(item.type, item.symbol)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {textFields.map((f) => (
            <div key={f.key}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 5 }}>{f.label}</div>
              <input
                type={f.type}
                value={form[f.key]}
                onChange={(e) => onChange({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                style={inputStyle}
              />
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 5 }}>Брокер</div>
            <input
              list="brokers-list"
              value={form.broker}
              onChange={(e) => onChange({ ...form, broker: e.target.value })}
              placeholder="Interactive Brokers, Binance, Bybit..."
              style={inputStyle}
            />
            <datalist id="brokers-list">{BROKERS.map(b => <option key={b} value={b} />)}</datalist>
          </div>
          <button
            onClick={onAdd}
            style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "var(--accent)", color: "white", whiteSpace: "nowrap", alignSelf: "flex-end" }}
          >
            Добавить
          </button>
        </div>
      </div>
      {formError && <div style={{ marginTop: 8, fontSize: 12, color: "#ef4444" }}>{formError}</div>}
    </div>
  );
}
