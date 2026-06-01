// iOS Scriptable LARGE widget — current positions table.
// Mirrors the "Текущие позиции" panel from grame.skin/positions.

const WIDGET_URL = "https://grame.skin/api/widget";
const TOKEN = "a4f0a89afec865aa02facd1e3e132c2dc6fbd7d91dfef008";

// Column widths (pt) for the Large widget (~330pt usable width)
const COL_TICKER = 70;
const COL_AVG    = 65;
const COL_SHARE  = 60;
const COL_DAYUSD = 60;
const COL_DAYPCT = 60;

// Max rows that fit in a Large widget
const MAX_ROWS = 10;

// ─── Fetch ─────────────────────────────────────────────────────────────────

async function fetchData() {
  const req = new Request(`${WIDGET_URL}?token=${encodeURIComponent(TOKEN)}&detail=1`);
  req.timeoutInterval = 12;
  return await req.loadJSON();
}

// ─── Formatters ────────────────────────────────────────────────────────────

function fmt(n, digits) {
  if (digits === undefined) digits = 2;
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtSigned(n) {
  const sign = n >= 0 ? "+" : "";
  return sign + Math.round(n).toLocaleString("en-US");
}

function fmtPct(n) {
  const sign = n >= 0 ? "+" : "";
  return sign + n.toFixed(2) + "%";
}

// ─── Colors / fonts ────────────────────────────────────────────────────────

const BG          = new Color("#0b0b1f");
const TEXT_PRIM   = Color.white();
const TEXT_MUTED  = new Color("#94a3b8");
const TEXT_ACCENT = new Color("#a78bfa");
const POS         = new Color("#22c55e");
const NEG         = new Color("#ef4444");
const SEP         = new Color("#22223e");

const F_HEADER = Font.semiboldSystemFont(9);
const F_TICKER = Font.boldSystemFont(13);
const F_CELL   = Font.systemFont(12);
const F_TOTAL  = Font.boldSystemFont(13);

// Simple per-ticker hashed color so each row's ticker has a stable accent.
const TICKER_COLORS = ["#7c3aed","#9d6ef5","#3b82f6","#06b6d4","#f59e0b","#94a3b8","#ef4444","#ec4899","#22c55e","#84cc16","#f97316","#a855f7"];
function tickerColor(t) {
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) & 0xffffffff;
  return new Color(TICKER_COLORS[Math.abs(h) % TICKER_COLORS.length]);
}

// ─── Layout helpers ────────────────────────────────────────────────────────

function setCellLayout(stack, width, alignRight) {
  stack.size = new Size(width, 0);
  if (alignRight) stack.layoutHorizontally(); // right-align via spacer + text
}

function addText(stack, text, font, color, opts) {
  if (!opts) opts = {};
  if (opts.alignRight) stack.addSpacer();
  const t = stack.addText(text);
  t.font = font;
  t.textColor = color;
  if (opts.alignRight) t.rightAlignText();
  if (opts.lineLimit) t.lineLimit = opts.lineLimit;
  return t;
}

function addHeaderRow(parent) {
  const row = parent.addStack();
  row.layoutHorizontally();
  row.spacing = 0;

  const cols = [
    { label: "ТИКЕР",  w: COL_TICKER, right: false },
    { label: "СР.",    w: COL_AVG,    right: true  },
    { label: "ДОЛЯ",   w: COL_SHARE,  right: true  },
    { label: "ДЕНЬ $", w: COL_DAYUSD, right: true  },
    { label: "ДЕНЬ %", w: COL_DAYPCT, right: true  },
  ];

  for (const c of cols) {
    const cell = row.addStack();
    cell.size = new Size(c.w, 0);
    if (c.right) cell.addSpacer();
    const t = cell.addText(c.label);
    t.font = F_HEADER;
    t.textColor = TEXT_MUTED;
  }

  parent.addSpacer(2);
  const sep = parent.addStack();
  sep.backgroundColor = SEP;
  sep.size = new Size(0, 1);
  parent.addSpacer(3);
}

function addPositionRow(parent, p) {
  const row = parent.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.spacing = 0;

  // Ticker (colored)
  const tc = row.addStack();
  tc.size = new Size(COL_TICKER, 0);
  const tickerLabel = tc.addText(p.ticker);
  tickerLabel.font = F_TICKER;
  tickerLabel.textColor = tickerColor(p.ticker);
  tickerLabel.lineLimit = 1;

  // Avg price
  const ac = row.addStack();
  ac.size = new Size(COL_AVG, 0);
  ac.addSpacer();
  const avg = ac.addText(fmt(p.avgPrice, 2));
  avg.font = F_CELL;
  avg.textColor = TEXT_PRIM;

  // Share
  const sc = row.addStack();
  sc.size = new Size(COL_SHARE, 0);
  sc.addSpacer();
  const share = sc.addText(p.sharePct.toFixed(2) + "%");
  share.font = F_CELL;
  share.textColor = TEXT_PRIM;

  // Day $
  const duc = row.addStack();
  duc.size = new Size(COL_DAYUSD, 0);
  duc.addSpacer();
  const dayUsdText = duc.addText(p.dayUsd === 0 ? "0" : fmtSigned(p.dayUsd));
  dayUsdText.font = F_CELL;
  dayUsdText.textColor = p.dayUsd > 0 ? POS : p.dayUsd < 0 ? NEG : TEXT_MUTED;

  // Day %
  const dpc = row.addStack();
  dpc.size = new Size(COL_DAYPCT, 0);
  dpc.addSpacer();
  const dayPctText = dpc.addText(fmtPct(p.dayPct));
  dayPctText.font = F_CELL;
  dayPctText.textColor = p.dayPct > 0 ? POS : p.dayPct < 0 ? NEG : TEXT_MUTED;

  parent.addSpacer(4);
}

function addTotalRow(parent, data) {
  const sep = parent.addStack();
  sep.backgroundColor = SEP;
  sep.size = new Size(0, 1);
  parent.addSpacer(4);

  const row = parent.addStack();
  row.layoutHorizontally();
  row.spacing = 0;

  const tc = row.addStack();
  tc.size = new Size(COL_TICKER, 0);
  const t = tc.addText("ИТОГО");
  t.font = F_TOTAL;
  t.textColor = TEXT_MUTED;

  // skip avg + share (just spacers)
  const ac = row.addStack(); ac.size = new Size(COL_AVG, 0);
  const sc = row.addStack(); sc.size = new Size(COL_SHARE, 0);
  sc.addSpacer();
  const sh = sc.addText("100%");
  sh.font = F_CELL;
  sh.textColor = TEXT_MUTED;

  const duc = row.addStack();
  duc.size = new Size(COL_DAYUSD, 0);
  duc.addSpacer();
  const du = duc.addText(fmtSigned(data.dayUsd));
  du.font = F_TOTAL;
  du.textColor = data.dayUsd >= 0 ? POS : NEG;

  const dpc = row.addStack();
  dpc.size = new Size(COL_DAYPCT, 0);
  dpc.addSpacer();
  const dp = dpc.addText(fmtPct(data.dayPct));
  dp.font = F_TOTAL;
  dp.textColor = data.dayPct >= 0 ? POS : NEG;
}

// ─── Widget ────────────────────────────────────────────────────────────────

async function buildWidget() {
  let data;
  try {
    data = await fetchData();
  } catch (err) {
    return errorWidget("Сеть: " + (err && err.message ? err.message : err));
  }
  if (!data || data.error) return errorWidget((data && data.error) || "Нет данных");
  if (!Array.isArray(data.positions)) return errorWidget("Сервер: detail=1 не вернул positions");

  const widget = new ListWidget();
  widget.backgroundColor = BG;
  widget.setPadding(12, 14, 12, 14);

  // Header
  const header = widget.addStack();
  header.layoutHorizontally();
  header.centerAlignContent();

  const titleLeft = header.addStack();
  titleLeft.layoutVertically();
  const titleLabel = titleLeft.addText("ТЕКУЩИЕ ПОЗИЦИИ");
  titleLabel.font = Font.semiboldSystemFont(10);
  titleLabel.textColor = TEXT_ACCENT;

  const totalText = titleLeft.addText("$" + Number(data.total).toLocaleString("en-US", { maximumFractionDigits: 0 }));
  totalText.font = Font.boldSystemFont(18);
  totalText.textColor = TEXT_PRIM;

  header.addSpacer();

  const rightSide = header.addStack();
  rightSide.layoutVertically();
  const dayUsdRight = rightSide.addText(fmtSigned(data.dayUsd));
  dayUsdRight.font = Font.semiboldSystemFont(14);
  dayUsdRight.textColor = data.dayUsd >= 0 ? POS : NEG;
  dayUsdRight.rightAlignText();
  const dayPctRight = rightSide.addText(fmtPct(data.dayPct));
  dayPctRight.font = Font.mediumSystemFont(11);
  dayPctRight.textColor = data.dayUsd >= 0 ? POS : NEG;
  dayPctRight.rightAlignText();

  widget.addSpacer(8);

  // Header row
  addHeaderRow(widget);

  // Position rows
  const rows = data.positions.slice(0, MAX_ROWS);
  for (const p of rows) {
    addPositionRow(widget, p);
  }

  widget.addSpacer();

  // Total
  addTotalRow(widget, data);

  // Footer timestamp
  if (data.asOf) {
    widget.addSpacer(4);
    const ts = new Date(data.asOf);
    const time = ts.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    const footer = widget.addText(time);
    footer.font = Font.systemFont(8);
    footer.textColor = TEXT_MUTED;
    footer.rightAlignText();
  }

  widget.url = "https://grame.skin/positions";
  return widget;
}

function errorWidget(message) {
  const widget = new ListWidget();
  widget.backgroundColor = BG;
  widget.setPadding(12, 14, 12, 14);
  const header = widget.addText("ТЕКУЩИЕ ПОЗИЦИИ");
  header.font = Font.semiboldSystemFont(10);
  header.textColor = TEXT_ACCENT;
  widget.addSpacer(6);
  const err = widget.addText("Ошибка");
  err.font = Font.boldSystemFont(18);
  err.textColor = NEG;
  widget.addSpacer(4);
  const detail = widget.addText(String(message));
  detail.font = Font.systemFont(12);
  detail.textColor = TEXT_MUTED;
  detail.minimumScaleFactor = 0.6;
  return widget;
}

// ─── Entry point ───────────────────────────────────────────────────────────

const widget = await buildWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentLarge();
}
Script.complete();
