// Free-form "Excel" grid inside the diary.
//
// Independent from the daily-snapshot journal:
//   • Columns are user-named. Each can optionally bind to a broker so the
//     bottom "Биржа" row auto-fills with that broker's live native balance.
//   • Rows above the live row are entirely manual (number, text, or =formula).

export type ExcelColumn = {
  id: string; // stable id (used as cell key)
  label: string; // user-editable header text
  brokerId?: string; // when set, the live row reads this broker's balance
};

export type ExcelCellValue =
  | { kind: "num"; value: number; formula?: string }
  | { kind: "text"; value: string }
  | { kind: "empty" };

export type ExcelRow = {
  id: string;
  label?: string; // optional left-column label
  date?: string; // YYYY-MM-DD when row is date-bound (auto-today mode)
  cells: Record<string, ExcelCellValue>;
};

export type ExcelGrid = {
  columns: ExcelColumn[];
  rows: ExcelRow[];
  // When set (YYYY-MM-DD), row labels become sequential daily dates
  // starting from this date: row 0 → startDate, row 1 → startDate + 1 day, ...
  startDate?: string;
  // When true: top row is always today (Istanbul), auto-added daily,
  // broker-mapped cells overlay live /positions data.
  autoToday?: boolean;
};

// Format a date as YYYY-MM-DD by adding `dayOffset` days to startDate.
export function dateForRow(startDate: string, dayOffset: number): string {
  if (!startDate) return "";
  const [y, m, d] = startDate.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + dayOffset * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export const LS_DIARY_EXCEL_GRID = "diary-excel-grid-v2";

export function makeDefaultGrid(): ExcelGrid {
  return {
    columns: [
      { id: "col-1", label: "Брокер 1" },
      { id: "col-2", label: "Брокер 2" },
      { id: "col-3", label: "Брокер 3" },
    ],
    rows: [
      { id: "row-1", label: "Январь", cells: {} },
      { id: "row-2", label: "Февраль", cells: {} },
      { id: "row-3", label: "Март", cells: {} },
    ],
  };
}

export function loadExcelGrid(): ExcelGrid {
  if (typeof window === "undefined") return makeDefaultGrid();
  try {
    const raw = localStorage.getItem(LS_DIARY_EXCEL_GRID);
    if (!raw) return makeDefaultGrid();
    const parsed = JSON.parse(raw) as ExcelGrid;
    if (!parsed?.columns || !parsed.rows) return makeDefaultGrid();
    return parsed;
  } catch {
    return makeDefaultGrid();
  }
}

export function saveExcelGrid(grid: ExcelGrid): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_DIARY_EXCEL_GRID, JSON.stringify(grid));
}

// Build the "live" bottom row by reading current positions per broker mapping.
// Returns a cells map keyed by column id; columns without a brokerId or with
// an unknown broker get `{ kind: "empty" }`.
import type { LiveQuote, StoredPosition } from "../types";
import type { DiaryBroker } from "./types";
import { istanbulToday } from "./istanbul-time";
import { shiftFormulaRows } from "./excel-formula";

// In auto-today mode, ensure the top row has date === today.
// If missing, prepend a new row that inherits all formulas from the
// previous top with row references shifted +1 (so yesterday's `=A1` keeps
// pointing at what's now the row below). Numeric values are NOT copied —
// today's manual cells start blank, and broker-mapped cells will be filled
// from /positions at render time.
export function ensureTodayAtTop(grid: ExcelGrid): ExcelGrid {
  if (!grid.autoToday) return grid;
  const today = istanbulToday();
  const sortedRows = [...grid.rows].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? ""),
  );
  const top = sortedRows[0];
  if (top && top.date === today) {
    return { ...grid, rows: sortedRows };
  }
  // Build new today row, inheriting formulas (shifted) from previous top.
  const newCells: Record<string, ExcelCellValue> = {};
  if (top) {
    for (const colId in top.cells) {
      const cv = top.cells[colId];
      if (cv.kind === "num" && cv.formula) {
        const shifted = shiftFormulaRows(cv.formula, 1);
        newCells[colId] = { kind: "num", value: 0, formula: shifted };
      }
      // Non-formula numeric values + text DO NOT carry over — that's the
      // user's per-day data, not a rule. Broker cells get live overlay.
    }
  }
  const newRow: ExcelRow = {
    id: `row-${today}`,
    date: today,
    label: today,
    cells: newCells,
  };
  return { ...grid, rows: [newRow, ...sortedRows] };
}

export function buildLiveRow(
  columns: ExcelColumn[],
  positions: StoredPosition[],
  quotes: Record<string, LiveQuote>,
  brokers: DiaryBroker[],
): Record<string, ExcelCellValue> {
  const cells: Record<string, ExcelCellValue> = {};
  for (const col of columns) {
    if (!col.brokerId) {
      cells[col.id] = { kind: "empty" };
      continue;
    }
    const broker = brokers.find((b) => b.id === col.brokerId);
    if (!broker) {
      cells[col.id] = { kind: "empty" };
      continue;
    }
    // Sum positions whose broker name matches one of broker.positionBrokers,
    // priced at current quote × qty (in broker's native currency).
    const names = broker.positionBrokers.map((n) => n.toLowerCase().trim());
    let amount = 0;
    for (const p of positions) {
      const b = p.broker?.toLowerCase().trim();
      if (!b || !names.includes(b)) continue;
      const live = quotes[p.ticker]?.current;
      const price = live && live > 0 ? live : p.avgPrice;
      amount += p.qty * price;
    }
    cells[col.id] = amount > 0
      ? { kind: "num", value: Math.round(amount * 100) / 100 }
      : { kind: "empty" };
  }
  return cells;
}

// Merge live broker-cell values into a row's stored cells WITHOUT persisting.
// Used for the top "today" row each render: manual cells stay; broker-mapped
// cells get overlaid by current /positions values.
export function overlayLiveBalances(
  row: ExcelRow,
  columns: ExcelColumn[],
  live: Record<string, ExcelCellValue>,
): ExcelRow {
  const cells: Record<string, ExcelCellValue> = { ...row.cells };
  for (const col of columns) {
    if (!col.brokerId) continue;
    const lv = live[col.id];
    if (!lv || lv.kind === "empty") continue;
    cells[col.id] = lv;
  }
  return { ...row, cells };
}
