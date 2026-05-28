// Excel-style formula evaluator for the Excel grid.
//
// Supports:
//   • Literals:   123, 12.5, 1,5
//   • Operators:  +, -, *, /, parens, unary +/-
//   • Cell refs:  A1, B12, AA5  (column letter, row number 1-based)
//   • Ranges:     A1:A5 (only as function args)
//   • Functions:  SUM, AVG/AVERAGE, MIN, MAX, COUNT, IF
//
// Pure recursive-descent. No eval, no Function — safe.

export type FormulaContext = {
  // Resolve a single cell. col & row are 0-indexed.
  // Returns undefined for out-of-bounds or non-numeric / circular refs.
  cellAt: (col: number, row: number) => number | undefined;
  totalCols: number;
  totalRows: number;
};

// "A" → 0, "B" → 1, ..., "Z" → 25, "AA" → 26, "AB" → 27 ...
export function letterToCol(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) return -1;
    n = n * 26 + (code - 64);
  }
  return n - 1;
}

export function colToLetter(col: number): string {
  let n = col + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s || "A";
}

// Shift every cell-row reference inside a formula by `delta`. Used when
// inserting a new today row at index 0 — yesterday's formulas referring to
// (relative) row N must shift to row N+1 to keep meaning the same.
export function shiftFormulaRows(formula: string, delta: number): string {
  if (!formula.startsWith("=") || delta === 0) return formula;
  // Match LETTERS+DIGITS that look like cell refs. Word-boundaries on both
  // sides so we don't break function names like SUM (those are LETTERS only).
  return formula.replace(/\b([A-Za-z]+)(\d+)\b/g, (full, letters: string, digits: string) => {
    const row = parseInt(digits, 10);
    if (!Number.isFinite(row)) return full;
    const shifted = row + delta;
    if (shifted < 1) return full;
    return `${letters}${shifted}`;
  });
}

type Tok =
  | { kind: "num"; value: number }
  | { kind: "op"; op: "+" | "-" | "*" | "/" }
  | { kind: "lp" }
  | { kind: "rp" }
  | { kind: "comma" }
  | { kind: "colon" }
  | { kind: "ref"; col: number; row: number }
  | { kind: "ident"; name: string };

function tokenize(body: string): Tok[] | null {
  const tokens: Tok[] = [];
  let i = 0;
  while (i < body.length) {
    const c = body[i];
    if (c === " " || c === "\t") { i++; continue; }
    if (c === "(") { tokens.push({ kind: "lp" }); i++; continue; }
    if (c === ")") { tokens.push({ kind: "rp" }); i++; continue; }
    if (c === ",") { tokens.push({ kind: "comma" }); i++; continue; }
    if (c === ":") { tokens.push({ kind: "colon" }); i++; continue; }
    if (c === "+" || c === "-" || c === "*" || c === "/") {
      tokens.push({ kind: "op", op: c as "+" | "-" | "*" | "/" });
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < body.length && /[0-9.]/.test(body[j])) j++;
      const n = parseFloat(body.slice(i, j));
      if (!Number.isFinite(n)) return null;
      tokens.push({ kind: "num", value: n });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      // Try cell ref pattern: letters followed by digits.
      let j = i;
      while (j < body.length && /[a-zA-Z]/.test(body[j])) j++;
      const lettersEnd = j;
      while (j < body.length && /[0-9]/.test(body[j])) j++;
      const letters = body.slice(i, lettersEnd);
      const digits = body.slice(lettersEnd, j);
      if (digits.length > 0) {
        const col = letterToCol(letters);
        const row = parseInt(digits, 10) - 1;
        if (col >= 0 && row >= 0) {
          tokens.push({ kind: "ref", col, row });
          i = j;
          continue;
        }
      }
      // Otherwise it's a function/identifier.
      tokens.push({ kind: "ident", name: letters.toUpperCase() });
      i = lettersEnd;
      continue;
    }
    return null;
  }
  return tokens;
}

// ── Parser & evaluator ─────────────────────────────────────────────────

type RangeArg = { kind: "range"; from: { col: number; row: number }; to: { col: number; row: number } };
type ValueArg = { kind: "value"; value: number };
type Arg = RangeArg | ValueArg;

const FUNCTIONS: Record<string, (args: Arg[], ctx: FormulaContext) => number | undefined> = {
  SUM: (args, ctx) => reduceArgs(args, ctx, (acc, v) => acc + v, 0),
  AVG: (args, ctx) => avg(args, ctx),
  AVERAGE: (args, ctx) => avg(args, ctx),
  MIN: (args, ctx) => {
    const vals = flattenArgs(args, ctx);
    if (vals.length === 0) return undefined;
    return Math.min(...vals);
  },
  MAX: (args, ctx) => {
    const vals = flattenArgs(args, ctx);
    if (vals.length === 0) return undefined;
    return Math.max(...vals);
  },
  COUNT: (args, ctx) => flattenArgs(args, ctx).length,
  IF: (args, _ctx) => {
    // IF(cond, then, else) — cond evaluated as non-zero truthy.
    if (args.length < 2) return undefined;
    const cond = args[0];
    if (cond.kind !== "value") return undefined;
    if (cond.value !== 0) {
      return args[1]?.kind === "value" ? args[1].value : undefined;
    }
    if (args[2]?.kind === "value") return args[2].value;
    return 0;
  },
};

function flattenArgs(args: Arg[], ctx: FormulaContext): number[] {
  const out: number[] = [];
  for (const a of args) {
    if (a.kind === "value") {
      out.push(a.value);
    } else {
      for (let r = a.from.row; r <= a.to.row; r++) {
        for (let c = a.from.col; c <= a.to.col; c++) {
          const v = ctx.cellAt(c, r);
          if (v !== undefined) out.push(v);
        }
      }
    }
  }
  return out;
}
function reduceArgs(args: Arg[], ctx: FormulaContext, fn: (a: number, b: number) => number, init: number): number {
  const vals = flattenArgs(args, ctx);
  return vals.reduce(fn, init);
}
function avg(args: Arg[], ctx: FormulaContext): number | undefined {
  const vals = flattenArgs(args, ctx);
  if (vals.length === 0) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function evaluateExcelFormula(raw: string, ctx: FormulaContext): number | undefined {
  let body = raw.trim();
  if (!body.startsWith("=")) return undefined;
  body = body.slice(1).trim();
  if (!body) return undefined;
  body = body.replace(/(\d),(\d)/g, "$1.$2");

  const tokens = tokenize(body);
  if (!tokens) return undefined;

  let pos = 0;
  function parseExpr(): number | undefined {
    let lhs = parseTerm();
    if (lhs === undefined) return undefined;
    while (pos < tokens!.length && tokens![pos].kind === "op" &&
      ((tokens![pos] as { op: string }).op === "+" || (tokens![pos] as { op: string }).op === "-")) {
      const op = (tokens![pos] as { op: string }).op;
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
    while (pos < tokens!.length && tokens![pos].kind === "op" &&
      ((tokens![pos] as { op: string }).op === "*" || (tokens![pos] as { op: string }).op === "/")) {
      const op = (tokens![pos] as { op: string }).op;
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
    if (pos >= tokens!.length) return undefined;
    const t = tokens![pos];
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
    if (t.kind === "ref") {
      pos++;
      const v = ctx.cellAt(t.col, t.row);
      // Excel-style: empty / text cells in arithmetic = 0 (not "undefined").
      // (Ranges inside SUM/AVG/COUNT still skip empties — see flattenArgs.)
      return v === undefined ? 0 : v;
    }
    if (t.kind === "ident") {
      const name = t.name;
      pos++;
      if (pos >= tokens!.length || tokens![pos].kind !== "lp") return undefined;
      pos++; // consume (
      const args: Arg[] = [];
      // Parse function args
      if (tokens![pos]?.kind !== "rp") {
        while (true) {
          const arg = parseArg();
          if (arg === null) return undefined;
          args.push(arg);
          if (tokens![pos]?.kind === "comma") {
            pos++;
            continue;
          }
          break;
        }
      }
      if (tokens![pos]?.kind !== "rp") return undefined;
      pos++; // consume )
      const fn = FUNCTIONS[name];
      if (!fn) return undefined;
      return fn(args, ctx);
    }
    if (t.kind === "lp") {
      pos++;
      const v = parseExpr();
      if (v === undefined) return undefined;
      if (pos >= tokens!.length || tokens![pos].kind !== "rp") return undefined;
      pos++;
      return v;
    }
    return undefined;
  }
  function parseArg(): Arg | null {
    // Range: ref ":" ref. Detect by peeking.
    const t0 = tokens![pos];
    if (t0?.kind === "ref" && tokens![pos + 1]?.kind === "colon" && tokens![pos + 2]?.kind === "ref") {
      const a = t0 as Extract<Tok, { kind: "ref" }>;
      const b = tokens![pos + 2] as Extract<Tok, { kind: "ref" }>;
      pos += 3;
      const fromCol = Math.min(a.col, b.col);
      const toCol = Math.max(a.col, b.col);
      const fromRow = Math.min(a.row, b.row);
      const toRow = Math.max(a.row, b.row);
      return { kind: "range", from: { col: fromCol, row: fromRow }, to: { col: toCol, row: toRow } };
    }
    const v = parseExpr();
    if (v === undefined) return null;
    return { kind: "value", value: v };
  }

  const result = parseExpr();
  if (result === undefined || pos !== tokens.length) return undefined;
  return Number.isFinite(result) ? result : undefined;
}
