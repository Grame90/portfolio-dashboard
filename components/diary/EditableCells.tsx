"use client";

// Shared inline-edit cells for the diary table.
// All cells use the same pattern:
//   • Controlled input, local-state-while-focused (so re-renders don't wipe
//     the user's in-progress typing).
//   • Auto-select-on-focus → user can immediately replace.
//   • Enter → commit (blur). Escape → revert and blur.
//   • Empty + blur → clears the override (returns to auto-computed).

import { useEffect, useState } from "react";

const cellInputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 70,
  background: "transparent",
  border: "1px solid transparent",
  borderRadius: 4,
  padding: "2px 6px",
  font: "inherit",
  textAlign: "right",
  color: "var(--text-primary)",
  outline: "none",
};

// Parse "12 345,67" / "12,345.67" / "-500" → number | undefined.
export function parseUsdInput(raw: string): number | undefined {
  const cleaned = raw.trim().replace(/\s/g, "").replace(/,/g, ".");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return undefined;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

// Compute an Excel-style formula "=expr" → number | undefined.
// Supports +, -, *, /, parens, unary +/-, decimals (dot or comma).
// Pure recursive-descent parser. No eval(), no Function() — safe.
export function computeFormula(raw: string): number | undefined {
  let body = raw.trim();
  if (!body.startsWith("=")) return undefined;
  body = body.slice(1).trim();
  if (!body) return undefined;
  body = body.replace(/(\d),(\d)/g, "$1.$2");

  type Tok = { kind: "num" | "op" | "lp" | "rp"; value?: number; op?: string };
  const tokens: Tok[] = [];
  let i = 0;
  while (i < body.length) {
    const c = body[i];
    if (c === " " || c === "\t") { i++; continue; }
    if (c === "(") { tokens.push({ kind: "lp" }); i++; continue; }
    if (c === ")") { tokens.push({ kind: "rp" }); i++; continue; }
    if (c === "+" || c === "-" || c === "*" || c === "/") {
      tokens.push({ kind: "op", op: c });
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < body.length && /[0-9.]/.test(body[j])) j++;
      const n = parseFloat(body.slice(i, j));
      if (!Number.isFinite(n)) return undefined;
      tokens.push({ kind: "num", value: n });
      i = j;
      continue;
    }
    return undefined;
  }

  let pos = 0;
  function parseExpr(): number | undefined {
    let lhs = parseTerm();
    if (lhs === undefined) return undefined;
    while (pos < tokens.length && tokens[pos].kind === "op" &&
      (tokens[pos].op === "+" || tokens[pos].op === "-")) {
      const op = tokens[pos].op!;
      pos++;
      const rhs = parseTerm();
      if (rhs === undefined) return undefined;
      lhs = op === "+" ? lhs + rhs : lhs - rhs;
    }
    return lhs;
  }
  function parseTerm(): number | undefined {
    let lhs = parseFactor();
    if (lhs === undefined) return undefined;
    while (pos < tokens.length && tokens[pos].kind === "op" &&
      (tokens[pos].op === "*" || tokens[pos].op === "/")) {
      const op = tokens[pos].op!;
      pos++;
      const rhs = parseFactor();
      if (rhs === undefined) return undefined;
      if (op === "/") {
        if (rhs === 0) return undefined;
        lhs = lhs / rhs;
      } else lhs = lhs * rhs;
    }
    return lhs;
  }
  function parseFactor(): number | undefined {
    if (pos >= tokens.length) return undefined;
    const t = tokens[pos];
    if (t.kind === "op" && (t.op === "-" || t.op === "+")) {
      const sign = t.op === "-" ? -1 : 1;
      pos++;
      const v = parseFactor();
      return v === undefined ? undefined : sign * v;
    }
    if (t.kind === "num") {
      pos++;
      return t.value;
    }
    if (t.kind === "lp") {
      pos++;
      const v = parseExpr();
      if (v === undefined) return undefined;
      if (pos >= tokens.length || tokens[pos].kind !== "rp") return undefined;
      pos++;
      return v;
    }
    return undefined;
  }

  const result = parseExpr();
  if (result === undefined || pos !== tokens.length) return undefined;
  return Number.isFinite(result) ? result : undefined;
}

// Parse either a plain number or a `=expression`.
// formula is set iff input started with `=` and evaluated cleanly.
export function parseUsdOrFormula(raw: string): { value: number | undefined; formula?: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: undefined };
  if (trimmed.startsWith("=")) {
    const v = computeFormula(trimmed);
    if (v === undefined) return { value: undefined };
    return { value: v, formula: trimmed };
  }
  return { value: parseUsdInput(trimmed) };
}

function symbolFor(currency: string): string {
  return currency === "USD"
    ? "$"
    : currency === "TRY"
    ? "₺"
    : currency === "RUB"
    ? "₽"
    : currency === "EUR"
    ? "€"
    : "";
}

function fmtUsd(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("ru-RU", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

// ── Read-only formatted display (used for live/frozen non-editable cells)─

export function FormattedAmount({
  amount,
  currency,
  faint = false,
}: {
  amount: number;
  currency: string;
  faint?: boolean;
}) {
  const symbol = symbolFor(currency);
  return (
    <span style={{ color: faint ? "var(--text-muted)" : "var(--text-primary)" }}>
      {amount
        ? `${symbol}${amount.toLocaleString("ru-RU", { maximumFractionDigits: 0 })}`
        : "—"}
    </span>
  );
}

// ── Editable broker balance (native currency) ──────────────────────────

export function EditableBalanceCell({
  amount,
  currency,
  usdEquivalent,
  rate,
  formula,
  disabled = false,
  onSave,
}: {
  amount: number;
  currency: string;
  usdEquivalent: number | null;
  rate: number | undefined;
  formula?: string;
  disabled?: boolean;
  onSave: (v: number | undefined, formula?: string) => void;
}) {
  const symbol = symbolFor(currency);
  const displayText = amount ? Math.round(amount).toString() : "";
  const [local, setLocal] = useState(displayText);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setLocal(displayText);
  }, [displayText, focused]);
  const perUsd = rate && rate > 0 ? 1 / rate : 0;

  if (disabled) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        <FormattedAmount amount={amount} currency={currency} />
        {currency !== "USD" && amount > 0 && (
          <span style={{ fontSize: 9, color: "var(--text-muted)", lineHeight: 1 }}>
            {usdEquivalent !== null
              ? `≈ ${fmtUsd(usdEquivalent)}${perUsd > 0 ? ` · 1$=${perUsd.toFixed(2)}${symbol}` : ""}`
              : "нет курса"}
          </span>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 2, width: "100%" }}>
        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{symbol}</span>
        <input
          type="text"
          value={local}
          title={formula ? `Формула: ${formula}` : undefined}
          onChange={(e) => setLocal(e.target.value)}
          onFocus={(e) => {
            setFocused(true);
            // Switch to formula text if saved, so user can edit the expression.
            setLocal(formula ?? displayText);
            e.currentTarget.select();
          }}
          onBlur={() => {
            setFocused(false);
            const trimmed = local.trim();
            if (trimmed === "") {
              if (amount || formula) onSave(undefined, undefined);
              return;
            }
            const parsed = parseUsdOrFormula(trimmed);
            if (parsed.value === undefined) {
              setLocal(displayText);
              return;
            }
            if (parsed.value === amount && parsed.formula === formula) return;
            onSave(parsed.value, parsed.formula);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
            else if (e.key === "Escape") {
              setLocal(displayText);
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          placeholder="—"
          style={{
            ...cellInputStyle,
            padding: "2px 4px",
            fontStyle: formula ? "italic" : "normal",
            color: formula ? "#60a5fa" : cellInputStyle.color,
          }}
        />
        {formula && !focused && (
          <span title={`Формула: ${formula}`} style={fxBadge}>
            fx
          </span>
        )}
      </div>
      {currency !== "USD" && amount > 0 && (
        <span style={{ fontSize: 9, color: "var(--text-muted)", lineHeight: 1 }}>
          {usdEquivalent !== null
            ? `≈ ${fmtUsd(usdEquivalent)}${perUsd > 0 ? ` · 1$=${perUsd.toFixed(2)}${symbol}` : ""}`
            : "нет курса"}
        </span>
      )}
    </div>
  );
}

const fxBadge: React.CSSProperties = {
  marginLeft: 4,
  padding: "0 4px",
  fontSize: 9,
  fontWeight: 700,
  background: "rgba(96, 165, 250, 0.15)",
  color: "#60a5fa",
  borderRadius: 3,
  letterSpacing: 0.4,
};

// ── Editable USD amount (Переводы / Инвестировано override) ────────────

export function EditableUsdCell({
  value,
  formula,
  placeholder,
  emphasis,
  onSave,
}: {
  value: number | undefined;
  formula?: string;
  placeholder?: string;
  emphasis?: { fontWeight?: number; color?: string };
  onSave: (v: number | undefined, formula?: string) => void;
}) {
  const displayText = value !== undefined ? String(value) : "";
  const [local, setLocal] = useState(displayText);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setLocal(displayText);
  }, [displayText, focused]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <input
        type="text"
        value={local}
        title={formula ? `Формула: ${formula}` : undefined}
        onChange={(e) => setLocal(e.target.value)}
        onFocus={(e) => {
          setFocused(true);
          setLocal(formula ?? displayText);
          e.currentTarget.select();
        }}
        onBlur={() => {
          setFocused(false);
          const trimmed = local.trim();
          if (trimmed === "") {
            if (value !== undefined || formula !== undefined) onSave(undefined, undefined);
            return;
          }
          const parsed = parseUsdOrFormula(trimmed);
          if (parsed.value === undefined) {
            setLocal(displayText);
            return;
          }
          if (parsed.value === value && parsed.formula === formula) return;
          onSave(parsed.value, parsed.formula);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          else if (e.key === "Escape") {
            setLocal(displayText);
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        placeholder={placeholder ?? "—"}
        style={{
          ...cellInputStyle,
          fontWeight: emphasis?.fontWeight,
          color: formula ? "#60a5fa" : (emphasis?.color ?? cellInputStyle.color),
          fontStyle: formula ? "italic" : "normal",
        }}
      />
      {formula && !focused && (
        <span title={`Формула: ${formula}`} style={fxBadge}>
          fx
        </span>
      )}
    </div>
  );
}

// ── Editable comment (free text) ───────────────────────────────────────

export function EditableCommentCell({
  value,
  onSave,
}: {
  value: string | undefined;
  onSave: (v: string | undefined) => void;
}) {
  const initial = value ?? "";
  const [local, setLocal] = useState(initial);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setLocal(initial);
  }, [initial, focused]);

  return (
    <input
      type="text"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
      }}
      onBlur={() => {
        setFocused(false);
        const trimmed = local.trim();
        if (trimmed === (value ?? "")) return;
        onSave(trimmed === "" ? undefined : trimmed);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        else if (e.key === "Escape") {
          setLocal(initial);
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      placeholder="…"
      style={{ ...cellInputStyle, textAlign: "left", fontSize: 11, color: "var(--text-muted)" }}
    />
  );
}
