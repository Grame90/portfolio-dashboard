"use client";

import type { CSSProperties } from "react";
import type { Position } from "../types";

interface TakeProfitDialogProps {
  target: Position | null;
  pct: number;
  qtyStr: string;
  amtStr: string;
  onPctChange: (pct: number) => void;
  onQtyStrChange: (val: string) => void;
  onAmtStrChange: (val: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function TakeProfitDialog({
  target,
  pct: rawPct,
  qtyStr,
  amtStr,
  onPctChange,
  onQtyStrChange,
  onAmtStrChange,
  onClose,
  onConfirm,
}: TakeProfitDialogProps) {
  if (!target) return null;

  const p = target;
  const pct = Math.max(1, Math.min(100, rawPct));
  const qtyToSell = p.qty * (pct / 100);
  const proceeds = qtyToSell * p.currentPrice;
  const profitPart = proceeds - qtyToSell * p.avgPrice;

  const inputStyle: CSSProperties = {
    width: "100%",
    padding: "7px 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    color: "var(--text-primary)",
    fontSize: 13,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  function syncFromPct(newPct: number) {
    const qty2 = p.qty * (newPct / 100);
    const amt2 = qty2 * p.currentPrice;
    onPctChange(newPct);
    onQtyStrChange(qty2.toFixed(2));
    onAmtStrChange(Math.round(amt2).toString());
  }

  function handleQtyChange(val: string) {
    onQtyStrChange(val);
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0 && n <= p.qty) {
      const newPct = Math.round((n / p.qty) * 100);
      onPctChange(Math.max(1, Math.min(100, newPct)));
      onAmtStrChange(Math.round(n * p.currentPrice).toString());
    }
  }

  function handleAmtChange(val: string) {
    onAmtStrChange(val);
    const n = parseFloat(val);
    const maxAmt = p.qty * p.currentPrice;
    if (!isNaN(n) && n > 0 && n <= maxAmt) {
      const newPct = Math.round((n / maxAmt) * 100);
      onPctChange(Math.max(1, Math.min(100, newPct)));
      onQtyStrChange((p.qty * (newPct / 100)).toFixed(2));
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, minWidth: 380, maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: p.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>
            {p.ticker.slice(0, 2)}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{p.ticker}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.name}</div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: p.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{p.pnl >= 0 ? "+" : ""}{p.pnl.toLocaleString("en-US")} $</div>
            <div style={{ fontSize: 11, color: p.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(2)}%</div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
            <span style={{ color: "var(--text-secondary)" }}>Продать</span>
            <span style={{ fontWeight: 700, color: p.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{pct}% позиции</span>
          </div>
          <input
            type="range" min={1} max={100} value={pct}
            onChange={(e) => syncFromPct(Number(e.target.value))}
            style={{ width: "100%", accentColor: p.pnl >= 0 ? "#22c55e" : "#ef4444", cursor: "pointer" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
            <span>1%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>Кол-во акций</div>
            <input
              type="number" value={qtyStr} step="0.01"
              min={0.01} max={p.qty}
              onChange={(e) => handleQtyChange(e.target.value)}
              style={inputStyle}
              placeholder={qtyToSell.toFixed(2)}
            />
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
              Всего: {p.qty.toFixed(2)} шт.
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>Сумма (USD)</div>
            <input
              type="number" value={amtStr} step="1"
              min={1} max={Math.round(p.qty * p.currentPrice)}
              onChange={(e) => handleAmtChange(e.target.value)}
              style={inputStyle}
              placeholder={Math.round(proceeds).toString()}
            />
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
              Тек. цена: {p.currentPrice.toFixed(2)} $
            </div>
          </div>
        </div>

        <div style={{ background: "var(--bg-secondary)", borderRadius: 10, padding: "12px 14px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 7 }}>
          {([
            { label: "Продаётся акций", value: `${qtyToSell.toFixed(2)} шт.` },
            { label: "Выручка от продажи", value: `${Math.round(proceeds).toLocaleString("en-US")} $`, bold: true },
            { label: profitPart >= 0 ? "Из них прибыль" : "Из них убыток", value: `${profitPart >= 0 ? "+" : ""}${Math.round(profitPart).toLocaleString("en-US")} $`, color: profitPart >= 0 ? "#22c55e" : "#ef4444" },
            { label: "Переходит в Кэш", value: `${Math.round(proceeds).toLocaleString("en-US")} $`, color: "var(--text-primary)", bold: true },
          ] as { label: string; value: string; bold?: boolean; color?: string }[]).map(row => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
              <span style={{ fontWeight: row.bold ? 700 : 600, color: row.color ?? "var(--text-primary)" }}>{row.value}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid var(--border)",
            background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
          }}>Отмена</button>
          <button onClick={onConfirm} style={{
            flex: 2, padding: "10px 0", borderRadius: 10, border: "none",
            background: p.pnl >= 0 ? "#22c55e" : "#ef4444", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}>💰 Продать на {Math.round(proceeds).toLocaleString("en-US")} $</button>
        </div>
      </div>
    </div>
  );
}
