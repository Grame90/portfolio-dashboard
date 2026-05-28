"use client";

// Excel-like free-form grid for the diary.
//
//   • Columns: user-named. Each can optionally bind to a broker → the bottom
//     "Биржа" row pulls that broker's live native balance from /positions.
//   • Rows: free-form. Cells accept text, numbers, or "=formula".
//   • Last row is auto-rendered, always at the bottom, not in `grid.rows`.

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Upload, RefreshCw, Cloud, CloudOff } from "lucide-react";
import {
  buildLiveRow,
  dateForRow,
  ensureTodayAtTop,
  loadExcelGrid,
  overlayLiveBalances,
  saveExcelGrid,
  type ExcelCellValue,
  type ExcelColumn,
  type ExcelGrid,
  type ExcelRow,
} from "@/lib/diary/excel-grid";
import { parseUsdInput } from "./EditableCells";
import {
  colToLetter,
  evaluateExcelFormula,
  type FormulaContext,
} from "@/lib/diary/excel-formula";
import {
  isExcelFile,
  isNumbersFile,
  NUMBERS_EXPORT_INSTRUCTIONS,
  xlsxFileToCsv,
} from "@/lib/diary/excel";
import { parseDelimited } from "@/lib/diary/import";
import {
  getClientId,
  getFirstSheetTitle,
  isGisReady,
  isSignedIn,
  loadGis,
  parseSheetId,
  pullPublicCsv,
  readSheetDual,
  requestAccessToken,
  signOut,
  writeSheet,
} from "@/lib/diary/google-sheets";
import type { LiveQuote, StoredPosition } from "@/lib/types";
import type { DiaryBroker } from "@/lib/diary/types";

export type ExcelViewProps = {
  positions: StoredPosition[];
  liveQuotes: Record<string, LiveQuote>;
  brokers: DiaryBroker[];
};

export default function ExcelView({ positions, liveQuotes, brokers }: ExcelViewProps) {
  const [grid, setGrid] = useState<ExcelGrid | null>(null);
  const [importMsg, setImportMsg] = useState<{ text: string; color: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Google Sheets sync state ──────────────────────────────────────────
  const [sheetUrl, setSheetUrl] = useState<string>(
    () => (typeof window !== "undefined" && localStorage.getItem("diary-excel-sheet-url")) || "",
  );
  const [gApiSignedIn, setGApiSignedIn] = useState(false);
  const [gisReady, setGisReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [embedMode, setEmbedMode] = useState(
    () => (typeof window !== "undefined" && localStorage.getItem("diary-excel-embed-mode") === "1"),
  );
  const clientId = getClientId();
  const sheetId = useMemo(() => parseSheetId(sheetUrl), [sheetUrl]);

  function toggleEmbedMode() {
    setEmbedMode((on) => {
      const next = !on;
      if (typeof window !== "undefined") {
        localStorage.setItem("diary-excel-embed-mode", next ? "1" : "0");
      }
      return next;
    });
  }

  // Pre-load Google Identity Services script on mount so the OAuth popup
  // can open synchronously inside the user-click handler later. Otherwise
  // browsers block the popup as "not user-initiated".
  useEffect(() => {
    if (!clientId) return;
    if (isGisReady()) {
      setGisReady(true);
      return;
    }
    loadGis()
      .then(() => setGisReady(true))
      .catch((err) => {
        console.warn("GIS load failed:", err);
      });
  }, [clientId]);

  useEffect(() => {
    setGrid(loadExcelGrid());
  }, []);

  // When autoToday mode is on: ensure today's row exists at top, every mount
  // and every minute (catches day rollover without page reload).
  useEffect(() => {
    if (!grid?.autoToday) return;
    function tick() {
      setGrid((prev) => {
        if (!prev?.autoToday) return prev;
        const next = ensureTodayAtTop(prev);
        if (next === prev) return prev;
        saveExcelGrid(next);
        return next;
      });
    }
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [grid?.autoToday]);

  function flashMsg(text: string, color = "#22c55e") {
    setImportMsg({ text, color });
    setTimeout(() => setImportMsg(null), 4000);
  }

  // ── Google Sheets sync ────────────────────────────────────────────────
  function persistSheetUrl(url: string) {
    setSheetUrl(url);
    if (typeof window !== "undefined") {
      if (url) localStorage.setItem("diary-excel-sheet-url", url);
      else localStorage.removeItem("diary-excel-sheet-url");
    }
  }

  // CRITICAL: this handler must NOT have any await before requestAccessToken,
  // otherwise the browser strips the user-gesture context and the OAuth
  // popup is blocked. GIS is preloaded on mount.
  function handleConnectGoogle() {
    if (!clientId) {
      flashMsg("Не задан NEXT_PUBLIC_GOOGLE_CLIENT_ID в .env.local", "#ef4444");
      return;
    }
    if (!gisReady) {
      flashMsg("Google API ещё загружается, подожди секунду", "#f59e0b");
      return;
    }
    requestAccessToken({ prompt: "consent" })
      .then(() => {
        setGApiSignedIn(true);
        flashMsg("Google подключен");
      })
      .catch((err) => {
        console.error("Google connect:", err);
        flashMsg(`Ошибка авторизации: ${err instanceof Error ? err.message : "?"}`, "#ef4444");
      });
  }

  function handleSignOut() {
    signOut();
    setGApiSignedIn(false);
    flashMsg("Отключено от Google", "#f59e0b");
  }

  // Convert a 2D string array (header row + data rows) into our grid model.
  function applySheetValues(values: string[][]) {
    if (values.length === 0) {
      flashMsg("Лист пуст", "#f59e0b");
      return;
    }
    const headers = values[0];
    const dataRows = values.slice(1);
    const newColumns: ExcelColumn[] = headers.slice(1).map((h, i) => ({
      id: `col-${Date.now()}-${i}`,
      label: h.trim() || `Колонка ${i + 1}`,
    }));
    const newRows: ExcelRow[] = dataRows.map((rawRow, rIdx) => {
      const id = `row-${Date.now()}-${rIdx}`;
      const label = (rawRow[0] ?? "").trim();
      const cells: Record<string, ExcelCellValue> = {};
      for (let c = 0; c < newColumns.length; c++) {
        const raw = (rawRow[c + 1] ?? "").trim();
        if (!raw) continue;
        if (raw.startsWith("=")) {
          cells[newColumns[c].id] = { kind: "num", value: 0, formula: raw };
          continue;
        }
        const cleaned = raw.replace(/\s/g, "").replace(/[₺$€₽]/g, "").replace(/,/g, ".");
        if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
          const n = parseFloat(cleaned);
          if (Number.isFinite(n)) {
            cells[newColumns[c].id] = { kind: "num", value: n };
            continue;
          }
        }
        cells[newColumns[c].id] = { kind: "text", value: raw };
      }
      return { id, label: label || undefined, cells };
    });
    commit({ ...(grid ?? { columns: [], rows: [] }), columns: newColumns, rows: newRows });
    flashMsg(`Подтянуто: ${newColumns.length} колонок, ${newRows.length} строк`);
  }

  async function handlePullPublic() {
    if (!sheetId) {
      flashMsg("Вставь ссылку или ID Google Sheet", "#ef4444");
      return;
    }
    setSyncing(true);
    try {
      const values = await pullPublicCsv(sheetId);
      applySheetValues(values);
    } catch (err) {
      flashMsg(`Public pull: ${err instanceof Error ? err.message : "?"}`, "#ef4444");
    } finally {
      setSyncing(false);
    }
  }

  // Apply a dual-fetched sheet (formulas + computed values in parallel).
  // For each cell:
  //   • Header row → column label
  //   • First column → row label
  //   • Formula cells: store the "=…" text. Pre-populate `value` with Google's
  //     last calculated number (fallback for formulas our parser can't eval).
  //   • Plain numeric cells: store as number
  //   • Everything else: store as text
  function applyDualSheetValues(dual: {
    formulas: string[][];
    values: string[][];
  }) {
    const { formulas, values } = dual;
    if (formulas.length === 0) {
      flashMsg("Лист пуст", "#f59e0b");
      return;
    }
    const headers = formulas[0];
    const fData = formulas.slice(1);
    const vData = values.slice(1);

    const newColumns: ExcelColumn[] = headers.slice(1).map((h, i) => ({
      id: `col-${Date.now()}-${i}`,
      label: h.trim() || `Колонка ${i + 1}`,
    }));
    const newRows: ExcelRow[] = fData.map((fRow, rIdx) => {
      const vRow = vData[rIdx] ?? [];
      const id = `row-${Date.now()}-${rIdx}`;
      const label = (fRow[0] ?? "").trim();
      const cells: Record<string, ExcelCellValue> = {};
      for (let c = 0; c < newColumns.length; c++) {
        const fRaw = (fRow[c + 1] ?? "").trim();
        const vRaw = (vRow[c + 1] ?? "").trim();
        if (!fRaw && !vRaw) continue;
        if (fRaw.startsWith("=")) {
          // Formula cell. Try to parse Google's computed value as fallback.
          const cleaned = vRaw.replace(/\s/g, "").replace(/[₺$€₽]/g, "").replace(/,/g, ".");
          const fallback = /^-?\d+(\.\d+)?$/.test(cleaned) ? parseFloat(cleaned) : 0;
          cells[newColumns[c].id] = {
            kind: "num",
            value: Number.isFinite(fallback) ? fallback : 0,
            formula: fRaw,
          };
          continue;
        }
        const cleaned = fRaw.replace(/\s/g, "").replace(/[₺$€₽]/g, "").replace(/,/g, ".");
        if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
          const n = parseFloat(cleaned);
          if (Number.isFinite(n)) {
            cells[newColumns[c].id] = { kind: "num", value: n };
            continue;
          }
        }
        cells[newColumns[c].id] = { kind: "text", value: fRaw };
      }
      return { id, label: label || undefined, cells };
    });
    const next: ExcelGrid = {
      ...(grid ?? { columns: [], rows: [] }),
      columns: newColumns,
      rows: newRows,
    };
    commit(next);
    // Re-evaluate local formulas (SUM/AVG/A1+B2/…). Cells whose formulas our
    // parser can't handle keep their Google fallback value.
    setTimeout(() => recalcAllFormulas(next), 0);
    flashMsg(`Подтянуто из Google: ${newColumns.length} колонок, ${newRows.length} строк (формулы + значения)`);
  }

  async function handlePullFromSheet() {
    if (!sheetId) {
      flashMsg("Вставь ссылку или ID Google Sheet", "#ef4444");
      return;
    }
    setSyncing(true);
    try {
      const title = await getFirstSheetTitle(sheetId);
      const range = `${title}!A1:ZZ1000`;
      const dual = await readSheetDual(sheetId, range);
      applyDualSheetValues(dual);
    } catch (err) {
      flashMsg(`Pull ошибка: ${err instanceof Error ? err.message : "?"}`, "#ef4444");
    } finally {
      setSyncing(false);
    }
  }

  async function handlePushToSheet() {
    if (!sheetId || !grid) {
      flashMsg("Вставь ссылку или ID Google Sheet", "#ef4444");
      return;
    }
    setSyncing(true);
    try {
      // Serialize grid: row 1 = headers; first col = row label.
      const headers = ["Строка", ...grid.columns.map((c) => c.label)];
      const rows: string[][] = [headers];
      for (const r of grid.rows) {
        const row: string[] = [r.label ?? r.date ?? ""];
        for (const c of grid.columns) {
          const cv = r.cells[c.id];
          if (!cv || cv.kind === "empty") {
            row.push("");
          } else if (cv.kind === "num") {
            row.push(cv.formula ?? String(cv.value));
          } else {
            row.push(cv.value);
          }
        }
        rows.push(row);
      }
      const title = await getFirstSheetTitle(sheetId);
      const endCol = String.fromCharCode(64 + Math.min(headers.length, 26));
      const range = `${title}!A1:${endCol}${rows.length}`;
      await writeSheet(sheetId, range, rows);
      flashMsg(`Отправлено в Google: ${rows.length - 1} строк`);
    } catch (err) {
      flashMsg(`Push ошибка: ${err instanceof Error ? err.message : "?"}`, "#ef4444");
    } finally {
      setSyncing(false);
    }
  }

  async function handleImport(file: File) {
    if (isNumbersFile(file)) {
      flashMsg(NUMBERS_EXPORT_INSTRUCTIONS, "#f59e0b");
      return;
    }
    let text: string;
    try {
      text = isExcelFile(file) ? await xlsxFileToCsv(file) : await file.text();
    } catch (err) {
      flashMsg(`Ошибка чтения файла: ${err instanceof Error ? err.message : "?"}`, "#ef4444");
      return;
    }
    const { headers, rows } = parseDelimited(text);
    if (!headers.length || !rows.length) {
      flashMsg("Файл пустой или формат не распознан", "#ef4444");
      return;
    }
    // First column of the source file becomes the row-label column;
    // remaining columns become the grid columns.
    const newColumns: ExcelColumn[] = headers.slice(1).map((h, i) => ({
      id: `col-${Date.now()}-${i}`,
      label: h.trim() || `Колонка ${i + 1}`,
    }));
    const newRows: ExcelRow[] = rows.map((rawRow, rIdx) => {
      const id = `row-${Date.now()}-${rIdx}`;
      const label = rawRow[0]?.trim();
      const cells: Record<string, ExcelCellValue> = {};
      for (let cIdx = 0; cIdx < newColumns.length; cIdx++) {
        const raw = (rawRow[cIdx + 1] ?? "").trim();
        if (!raw) continue;
        // Heuristic: try number first (Excel exports rarely have "=").
        const cleaned = raw.replace(/\s/g, "").replace(/[₺$€₽]/g, "").replace(/,/g, ".");
        if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
          const n = parseFloat(cleaned);
          if (Number.isFinite(n)) {
            cells[newColumns[cIdx].id] = { kind: "num", value: n };
            continue;
          }
        }
        // Formula? Keep verbatim, will evaluate via the resolver below.
        if (raw.startsWith("=")) {
          cells[newColumns[cIdx].id] = { kind: "num", value: 0, formula: raw };
          continue;
        }
        cells[newColumns[cIdx].id] = { kind: "text", value: raw };
      }
      return { id, label: label || undefined, cells };
    });

    const next: ExcelGrid = {
      ...(grid ?? { columns: [], rows: [] }),
      columns: newColumns,
      rows: newRows,
    };
    commit(next);

    // Recompute formula values now that the full grid is in place.
    setTimeout(() => recalcAllFormulas(next), 0);

    flashMsg(`Импорт готов: ${newColumns.length} колонок, ${newRows.length} строк`);
  }

  function recalcAllFormulas(g: ExcelGrid) {
    const liveRowIdx = g.rows.length;
    function resolve(col: number, row: number, visiting: Set<string>): number | undefined {
      const key = `${col},${row}`;
      if (visiting.has(key)) return undefined;
      if (col < 0 || col >= g.columns.length) return undefined;
      if (row < 0 || row > liveRowIdx) return undefined;
      const colId = g.columns[col].id;
      if (row === liveRowIdx) return undefined;
      const cv = g.rows[row].cells[colId];
      if (!cv || cv.kind !== "num") return cv?.kind === "text" ? undefined : 0;
      if (cv.formula) {
        const next = new Set(visiting);
        next.add(key);
        const v = evaluateExcelFormula(cv.formula, {
          cellAt: (c, r) => resolve(c, r, next),
          totalCols: g.columns.length,
          totalRows: liveRowIdx + 1,
        });
        return v ?? cv.value;
      }
      return cv.value;
    }
    const updated: ExcelGrid = {
      ...g,
      rows: g.rows.map((r) => ({
        ...r,
        cells: Object.fromEntries(
          Object.entries(r.cells).map(([cid, cv]) => {
            if (cv.kind !== "num" || !cv.formula) return [cid, cv];
            const col = g.columns.findIndex((c) => c.id === cid);
            const row = g.rows.indexOf(r);
            const v = resolve(col, row, new Set());
            // If local parser can't evaluate, keep existing value (e.g. Google's
            // last calculated number that we pre-populated on dual-pull).
            return [cid, { ...cv, value: v ?? cv.value }];
          }),
        ),
      })),
    };
    commit(updated);
  }

  // Live cells, recomputed each render from current positions/quotes.
  // In auto-today mode → overlaid onto top row.
  // Otherwise → rendered as the static bottom "Биржа · LIVE" row.
  const liveCells = useMemo<Record<string, ExcelCellValue>>(() => {
    if (!grid) return {};
    return buildLiveRow(grid.columns, positions, liveQuotes, brokers);
  }, [grid, positions, liveQuotes, brokers]);

  // Rows for rendering: when autoToday is on, overlay live broker cells into
  // the top (today) row. Frozen rows below stay as-is.
  const displayRows = useMemo<ExcelRow[]>(() => {
    if (!grid) return [];
    if (!grid.autoToday) return grid.rows;
    if (grid.rows.length === 0) return grid.rows;
    const [top, ...rest] = grid.rows;
    return [overlayLiveBalances(top, grid.columns, liveCells), ...rest];
  }, [grid, liveCells]);

  // Cell resolver for formula references (A1, B2, etc.).
  // Includes the live "Биржа" row at the very bottom (row index = grid.rows.length).
  // Handles re-evaluation of cells that themselves contain formulas, with a
  // visited-set guard against circular references.
  const ctx = useMemo<FormulaContext>(() => {
    if (!grid) {
      return { cellAt: () => undefined, totalCols: 0, totalRows: 0 };
    }
    const liveRowIdx = grid.rows.length;
    function resolve(col: number, row: number, visiting: Set<string>): number | undefined {
      const key = `${col},${row}`;
      if (visiting.has(key)) return undefined; // cycle
      if (col < 0 || col >= grid!.columns.length) return undefined;
      if (row < 0 || row > liveRowIdx) return undefined;
      const colId = grid!.columns[col].id;
      if (row === liveRowIdx) {
        const cv = liveCells[colId];
        return cv?.kind === "num" ? cv.value : undefined;
      }
      const cv = grid!.rows[row].cells[colId];
      if (!cv || cv.kind === "empty") return undefined;
      if (cv.kind === "text") return undefined;
      // num — value already evaluated at write time; if it was a formula, the
      // stored value reflects the formula AT THE TIME OF SAVE. To support
      // live deps, recompute on read when a formula is present.
      if (cv.formula) {
        const next = new Set(visiting);
        next.add(key);
        const v = evaluateExcelFormula(cv.formula, {
          cellAt: (c, r) => resolve(c, r, next),
          totalCols: grid!.columns.length,
          totalRows: liveRowIdx + 1,
        });
        return v ?? cv.value;
      }
      return cv.value;
    }
    return {
      cellAt: (c, r) => resolve(c, r, new Set()),
      totalCols: grid.columns.length,
      totalRows: liveRowIdx + 1,
    };
  }, [grid, liveCells]);

  if (!grid) return null;

  function commit(next: ExcelGrid) {
    saveExcelGrid(next);
    setGrid(next);
  }

  // ── Mutations ─────────────────────────────────────────────────────────
  function addColumn() {
    const id = `col-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    commit({
      ...grid!,
      columns: [...grid!.columns, { id, label: `Колонка ${grid!.columns.length + 1}` }],
    });
  }
  function removeColumn(colId: string) {
    if (!confirm("Удалить колонку и все её значения?")) return;
    commit({
      ...grid!,
      columns: grid!.columns.filter((c) => c.id !== colId),
      rows: grid!.rows.map((r) => {
        const cells = { ...r.cells };
        delete cells[colId];
        return { ...r, cells };
      }),
    });
  }
  function renameColumn(colId: string, label: string) {
    commit({
      ...grid!,
      columns: grid!.columns.map((c) => (c.id === colId ? { ...c, label } : c)),
    });
  }
  function setColumnBroker(colId: string, brokerId: string | undefined) {
    commit({
      ...grid!,
      columns: grid!.columns.map((c) => (c.id === colId ? { ...c, brokerId } : c)),
    });
  }

  function reverseRows() {
    if (!grid || grid.rows.length === 0) return;
    commit({ ...grid, rows: [...grid.rows].reverse() });
    flashMsg("Порядок строк перевёрнут");
  }

  function clearTable() {
    if (!confirm("Очистить всю таблицу — колонки, строки, данные? Действие необратимо.")) return;
    commit({
      columns: [],
      rows: [],
      startDate: undefined,
      autoToday: false,
    });
    flashMsg("Таблица очищена", "#f59e0b");
  }

  function addRow() {
    const id = `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    commit({
      ...grid!,
      rows: [...grid!.rows, { id, cells: {} }],
    });
  }
  function removeRow(rowId: string) {
    if (!confirm("Удалить строку?")) return;
    commit({
      ...grid!,
      rows: grid!.rows.filter((r) => r.id !== rowId),
    });
  }
  function renameRow(rowId: string, label: string) {
    commit({
      ...grid!,
      rows: grid!.rows.map((r) => (r.id === rowId ? { ...r, label } : r)),
    });
  }
  function setCell(rowId: string, colId: string, raw: string) {
    const next = applyCellInput(raw, ctx);
    commit({
      ...grid!,
      rows: grid!.rows.map((r) => {
        if (r.id !== rowId) return r;
        const nextCells = { ...r.cells };
        if (next.kind === "empty") delete nextCells[colId];
        else nextCells[colId] = next;
        return { ...r, cells: nextCells };
      }),
    });
  }

  return (
    <div>
      <p style={blurb}>
        Свободная таблица. Заголовки колонок (<b>A, B, C…</b>) можно переименовать
        и связать с брокером — тогда нижняя строка <b>«Биржа»</b> подтянет живой баланс.
        В ячейках поддерживаются формулы Excel-стиля: <code style={codeStyle}>=A1+B2*0.1</code>,{" "}
        <code style={codeStyle}>=SUM(A1:A5)</code>, <code style={codeStyle}>=AVG(B1:B3)</code>,{" "}
        <code style={codeStyle}>=MIN/MAX/COUNT(...)</code>.
      </p>

      {/* Google Sheets sync panel */}
      <div style={syncPanel}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
          {gApiSignedIn || isSignedIn() ? <Cloud size={14} color="#22c55e" /> : <CloudOff size={14} color="var(--text-muted)" />}
          Google Sheets
        </div>
        {!clientId ? (
          <span style={{ fontSize: 11, color: "#f59e0b" }}>
            Сначала задай <code style={codeStyle}>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> в <code style={codeStyle}>.env.local</code> и перезапусти dev-сервер.
          </span>
        ) : (
          <>
            <input
              value={sheetUrl}
              onChange={(e) => persistSheetUrl(e.target.value)}
              placeholder="URL или ID Google Sheet"
              style={{ ...dateInputStyle, flex: 1, minWidth: 280 }}
            />
            <button
              onClick={handlePullPublic}
              disabled={syncing || !sheetId}
              style={importBtn}
              title="Прочитать публичный лист без входа в Google (требует доступ «Anyone with link»)"
            >
              <RefreshCw size={13} /> Тянуть публично
            </button>
            <button
              onClick={toggleEmbedMode}
              disabled={!sheetId}
              style={embedMode ? dangerBtn : importBtn}
              title={embedMode ? "Вернуться к нашей таблице" : "Встроить лист Google как iframe прямо на странице"}
            >
              📺 {embedMode ? "Свернуть Google" : "Встроить Google"}
            </button>
            {!gApiSignedIn && !isSignedIn() ? (
              <button
                onClick={handleConnectGoogle}
                style={{ ...importBtn, opacity: gisReady ? 1 : 0.5 }}
                disabled={!gisReady}
                title={gisReady ? "Открыть окно входа Google" : "Загрузка Google API…"}
              >
                <Cloud size={13} /> {gisReady ? "Подключить Google" : "Загрузка…"}
              </button>
            ) : (
              <>
                <button
                  onClick={handlePullFromSheet}
                  disabled={syncing || !sheetId}
                  style={importBtn}
                  title="Загрузить данные из листа в таблицу"
                >
                  <RefreshCw size={13} /> Тянуть из Google
                </button>
                <button
                  onClick={handlePushToSheet}
                  disabled={syncing || !sheetId}
                  style={importBtn}
                  title="Залить текущую таблицу в лист"
                >
                  <Upload size={13} /> Отправить в Google
                </button>
                <button onClick={handleSignOut} style={clearBtn} title="Выйти из Google">
                  Выйти
                </button>
              </>
            )}
            {sheetUrl && !sheetId && (
              <span style={{ fontSize: 11, color: "#ef4444" }}>Неверная ссылка/ID</span>
            )}
          </>
        )}
      </div>

      {/* Auto-today + start date + import controls */}
      <div style={startDateRow}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={grid.autoToday ?? false}
            onChange={(e) => commit({ ...grid, autoToday: e.target.checked })}
          />
          Авто-сегодня <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(новая строка каждый день, формулы переносятся)</span>
        </label>
        <span style={{ width: 1, height: 24, background: "var(--border)" }} />
        <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
          Дата начала строк:
        </label>
        <input
          type="date"
          value={grid.startDate ?? ""}
          onChange={(e) => commit({ ...grid, startDate: e.target.value || undefined })}
          style={dateInputStyle}
        />
        {grid.startDate && (
          <button
            onClick={() => commit({ ...grid, startDate: undefined })}
            style={clearBtn}
            title="Очистить — вернуть свободные подписи строк"
          >
            Сбросить
          </button>
        )}
        <button
          onClick={() => fileInputRef.current?.click()}
          style={importBtn}
          title="Импортировать Excel / CSV"
        >
          <Upload size={13} /> Импорт Excel / CSV
        </button>
        <button
          onClick={reverseRows}
          style={importBtn}
          title="Перевернуть порядок строк (последняя ↔ первая)"
        >
          ↕ Перевернуть
        </button>
        <button
          onClick={clearTable}
          style={dangerBtn}
          title="Удалить все колонки и строки"
        >
          <Trash2 size={13} /> Очистить таблицу
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.xlsm,.numbers,.csv,.tsv,.txt"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = "";
          }}
        />
        {importMsg && (
          <span style={{ fontSize: 11, color: importMsg.color, fontWeight: 600 }}>
            {importMsg.text}
          </span>
        )}
        {grid.startDate && !importMsg && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Строки автоматически нумеруются ежедневно от <b>{grid.startDate}</b>
          </span>
        )}
      </div>

      {embedMode && sheetId ? (
        <div style={iframeWrap}>
          <iframe
            key={sheetId}
            src={`https://docs.google.com/spreadsheets/d/${sheetId}/preview`}
            style={iframeStyle}
            title="Google Sheet"
            allow="clipboard-read; clipboard-write"
          />
          <div style={iframeHint}>
            Это просмотр Google Sheets (read-only). Формулы и форматирование как в Google.
            Чтобы <b>редактировать</b> — открой в новой вкладке:
            {" "}
            <a
              href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent, #3b82f6)", fontWeight: 600 }}
            >
              открыть в Google →
            </a>
            <br />
            <span style={{ fontSize: 10 }}>
              ⚠️ Если iframe пустой — лист не публичный. В Google открой
              <b> Файл → Share → General access → «Anyone with the link» → Viewer</b>.
              Google запрещает встраивание приватных листов через X-Frame-Options.
            </span>
          </div>
        </div>
      ) : (
      <div style={tableWrap}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={firstColTh}>Строка</th>
              {grid.columns.map((c, idx) => (
                <th key={c.id} style={th}>
                  <div style={letterBadge}>{colToLetter(idx)}</div>
                  <input
                    value={c.label}
                    onChange={(e) => renameColumn(c.id, e.target.value)}
                    style={headerInputStyle}
                    placeholder="Название"
                  />
                  <select
                    value={c.brokerId ?? ""}
                    onChange={(e) => setColumnBroker(c.id, e.target.value || undefined)}
                    style={brokerSelect}
                    title="Привязать колонку к брокеру"
                  >
                    <option value="">— не привязан —</option>
                    {brokers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label} · {b.currency}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeColumn(c.id)}
                    style={iconBtn}
                    title="Удалить колонку"
                  >
                    <Trash2 size={11} />
                  </button>
                </th>
              ))}
              <th style={addColTh}>
                <button onClick={addColumn} style={addBtn} title="Добавить колонку">
                  <Plus size={14} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIdx) => {
              const isLiveToday = grid.autoToday && rowIdx === 0;
              return (
                <DataRow
                  key={row.id}
                  row={row}
                  rowIndex={rowIdx}
                  autoDate={
                    grid.autoToday
                      ? row.date
                      : grid.startDate
                      ? dateForRow(grid.startDate, rowIdx)
                      : undefined
                  }
                  isLive={isLiveToday}
                  columns={grid.columns}
                  onChangeCell={(colId, raw) => setCell(row.id, colId, raw)}
                  onRenameRow={(label) => renameRow(row.id, label)}
                  onRemoveRow={() => removeRow(row.id)}
                />
              );
            })}
            {/* Static "Биржа" row — only when autoToday is OFF */}
            {!grid.autoToday && (
            <tr style={{ background: "rgba(34,197,94,0.08)", fontWeight: 700 }}>
              <td style={{ ...firstColTd, color: "#22c55e" }}>
                <span style={rowNumBadge}>{grid.rows.length + 1}</span>
                {grid.startDate
                  ? ` ${dateForRow(grid.startDate, grid.rows.length)} · LIVE`
                  : " Биржа · LIVE"}
              </td>
              {grid.columns.map((c) => {
                const cv = liveCells[c.id];
                const broker = c.brokerId ? brokers.find((b) => b.id === c.brokerId) : null;
                if (!cv || cv.kind === "empty") {
                  return (
                    <td key={c.id} style={{ ...td, color: "var(--text-muted)" }}>
                      {broker ? "—" : "не привязан"}
                    </td>
                  );
                }
                if (cv.kind === "num") {
                  const sym = broker?.currency === "TRY" ? "₺" :
                    broker?.currency === "RUB" ? "₽" :
                    broker?.currency === "EUR" ? "€" : "$";
                  return (
                    <td key={c.id} style={{ ...td, color: "#22c55e", fontFamily: "ui-monospace, monospace" }}>
                      {sym}{cv.value.toLocaleString("ru-RU", { maximumFractionDigits: 0 })}
                    </td>
                  );
                }
                return <td key={c.id} style={td}>{cv.kind === "text" ? cv.value : ""}</td>;
              })}
              <td style={td} />
            </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {!embedMode && (
        <div style={{ marginTop: 12 }}>
          <button onClick={addRow} style={addRowBtn}>
            <Plus size={14} /> Добавить строку
          </button>
        </div>
      )}
    </div>
  );
}

// ── Row component (small to keep parent readable) ──────────────────────

function DataRow({
  row,
  rowIndex,
  autoDate,
  isLive,
  columns,
  onChangeCell,
  onRenameRow,
  onRemoveRow,
}: {
  row: ExcelRow;
  rowIndex: number;
  autoDate?: string;
  isLive?: boolean;
  columns: ExcelColumn[];
  onChangeCell: (colId: string, raw: string) => void;
  onRenameRow: (label: string) => void;
  onRemoveRow: () => void;
}) {
  return (
    <tr style={isLive ? { background: "rgba(34,197,94,0.06)" } : undefined}>
      <td style={isLive ? { ...firstColTd, background: "rgba(34,197,94,0.06)" } : firstColTd}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={rowNumBadge}>{rowIndex + 1}</span>
          {autoDate ? (
            <span style={{ ...autoDateStyle, color: isLive ? "#22c55e" : autoDateStyle.color }}>
              {autoDate}{isLive && " · LIVE"}
            </span>
          ) : (
            <input
              value={row.label ?? ""}
              onChange={(e) => onRenameRow(e.target.value)}
              placeholder="—"
              style={rowLabelInput}
            />
          )}
          {!isLive && (
            <button onClick={onRemoveRow} style={iconBtn} title="Удалить строку">
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </td>
      {columns.map((c) => (
        <CellInput
          key={c.id}
          cell={row.cells[c.id]}
          onCommit={(raw) => onChangeCell(c.id, raw)}
        />
      ))}
      <td style={td} />
    </tr>
  );
}

// ── Cell input ─────────────────────────────────────────────────────────

function CellInput({
  cell,
  onCommit,
}: {
  cell: ExcelCellValue | undefined;
  onCommit: (raw: string) => void;
}) {
  const displayText = displayCell(cell);
  const formula = cell?.kind === "num" ? cell.formula : undefined;
  const [local, setLocal] = useState(displayText);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setLocal(displayText);
  }, [displayText, focused]);

  return (
    <td style={{ ...td, padding: 2 }}>
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
          if (local === displayText) return;
          onCommit(local);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          else if (e.key === "Escape") {
            setLocal(displayText);
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        style={{
          ...cellInput,
          fontStyle: formula ? "italic" : "normal",
          color: formula ? "#60a5fa" : cellInput.color,
        }}
      />
    </td>
  );
}

function displayCell(cv: ExcelCellValue | undefined): string {
  if (!cv || cv.kind === "empty") return "";
  if (cv.kind === "num") return Math.round(cv.value * 100) / 100 + "";
  return cv.value;
}

// ── Parse raw input into a cell value ──────────────────────────────────

function applyCellInput(raw: string, ctx: FormulaContext): ExcelCellValue {
  const trimmed = raw.trim();
  if (trimmed === "") return { kind: "empty" };
  // Formula?
  if (trimmed.startsWith("=")) {
    const v = evaluateExcelFormula(trimmed, ctx);
    if (v !== undefined) {
      return { kind: "num", value: v, formula: trimmed };
    }
    // Unparseable formula — store as text so user can edit and fix.
    return { kind: "text", value: trimmed };
  }
  // Plain number?
  if (/^-?[\d.,\s]+$/.test(trimmed)) {
    const n = parseUsdInput(trimmed);
    if (n !== undefined) return { kind: "num", value: n };
  }
  // Fallback to text.
  return { kind: "text", value: trimmed };
}

// ── Styles ──────────────────────────────────────────────────────────────

const blurb: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 12,
  color: "var(--text-muted)",
  lineHeight: 1.5,
};
const codeStyle: React.CSSProperties = {
  padding: "1px 5px",
  borderRadius: 4,
  background: "var(--bg-secondary)",
  color: "var(--text-primary)",
  fontSize: 11,
  fontFamily: "ui-monospace, monospace",
};
const iframeWrap: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  overflow: "hidden",
};
const iframeStyle: React.CSSProperties = {
  width: "100%",
  height: "75vh",
  border: "none",
  display: "block",
};
const iframeHint: React.CSSProperties = {
  padding: "8px 14px",
  fontSize: 11,
  color: "var(--text-muted)",
  borderTop: "1px solid var(--border)",
  background: "var(--bg-secondary)",
};
const tableWrap: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  overflow: "auto",
};
const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
};
const th: React.CSSProperties = {
  padding: "6px 8px",
  background: "var(--bg-secondary)",
  borderBottom: "1px solid var(--border)",
  borderRight: "1px solid var(--border)",
  minWidth: 140,
  verticalAlign: "top",
};
const firstColTh: React.CSSProperties = {
  ...th,
  position: "sticky",
  left: 0,
  zIndex: 2,
  background: "var(--bg-secondary)",
  minWidth: 120,
};
const addColTh: React.CSSProperties = {
  ...th,
  minWidth: 36,
  textAlign: "center",
};
const td: React.CSSProperties = {
  padding: "4px 8px",
  borderBottom: "1px solid var(--border)",
  borderRight: "1px solid var(--border)",
  color: "var(--text-primary)",
  whiteSpace: "nowrap",
};
const firstColTd: React.CSSProperties = {
  ...td,
  position: "sticky",
  left: 0,
  background: "var(--bg-card)",
  zIndex: 1,
  fontWeight: 600,
};
const syncPanel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 12,
  padding: "10px 14px",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  flexWrap: "wrap",
};
const startDateRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 12,
  padding: "10px 14px",
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  flexWrap: "wrap",
};
const dateInputStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-secondary)",
  color: "var(--text-primary)",
  fontSize: 12,
  fontFamily: "inherit",
};
const clearBtn: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-muted)",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
};
const importBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid var(--accent, #3b82f6)",
  background: "transparent",
  color: "var(--accent, #3b82f6)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
const dangerBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid #ef4444",
  background: "transparent",
  color: "#ef4444",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
const autoDateStyle: React.CSSProperties = {
  flex: 1,
  padding: "3px 6px",
  borderRadius: 4,
  background: "transparent",
  color: "var(--text-primary)",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "ui-monospace, monospace",
};
const letterBadge: React.CSSProperties = {
  display: "inline-block",
  marginBottom: 4,
  padding: "1px 6px",
  borderRadius: 4,
  background: "var(--bg-card)",
  color: "var(--accent, #3b82f6)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.6,
  fontFamily: "ui-monospace, monospace",
};
const rowNumBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "1px 5px",
  borderRadius: 3,
  background: "var(--bg-secondary)",
  color: "var(--accent, #3b82f6)",
  fontSize: 10,
  fontWeight: 800,
  fontFamily: "ui-monospace, monospace",
  minWidth: 18,
  textAlign: "center",
};
const headerInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "4px 6px",
  borderRadius: 4,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "inherit",
};
const brokerSelect: React.CSSProperties = {
  width: "100%",
  marginTop: 4,
  padding: "3px 4px",
  borderRadius: 4,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-muted)",
  fontSize: 10,
  fontFamily: "inherit",
};
const rowLabelInput: React.CSSProperties = {
  flex: 1,
  padding: "3px 6px",
  borderRadius: 4,
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--text-primary)",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "inherit",
};
const cellInput: React.CSSProperties = {
  width: "100%",
  padding: "3px 6px",
  borderRadius: 4,
  border: "1px solid transparent",
  background: "transparent",
  color: "var(--text-primary)",
  fontSize: 12,
  fontFamily: "ui-monospace, monospace",
  textAlign: "right",
};
const iconBtn: React.CSSProperties = {
  padding: "2px",
  border: "none",
  background: "transparent",
  color: "var(--text-muted)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
const addBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  border: "1px dashed var(--border)",
  background: "transparent",
  color: "var(--text-muted)",
  borderRadius: 6,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
const addRowBtn: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px dashed var(--border)",
  background: "transparent",
  color: "var(--text-muted)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};
