// iOS Scriptable widget for the grame.skin portfolio dashboard.
//
// HOW TO INSTALL — see end of file, or the README at:
//   https://grame.skin (the dashboard itself)
//
// Configuration: fill in YOUR_TOKEN below. Get it from Vercel env var
// WIDGET_TOKEN (same value you set there).

const WIDGET_URL = "https://grame.skin/api/widget";
const TOKEN = "REPLACE_WITH_YOUR_TOKEN";

// ─── Fetch data ─────────────────────────────────────────────────────────────

async function fetchPortfolio() {
  const req = new Request(`${WIDGET_URL}?token=${encodeURIComponent(TOKEN)}`);
  req.timeoutInterval = 10;
  return await req.loadJSON();
}

// ─── Format helpers ─────────────────────────────────────────────────────────

function fmtMoney(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n.toFixed(0)}`;
}

function fmtPct(n) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function fmtSignedMoney(n) {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${fmtMoney(n)}`;
}

// ─── Build widget ───────────────────────────────────────────────────────────

async function buildWidget() {
  let data;
  try {
    data = await fetchPortfolio();
  } catch (err) {
    return errorWidget(`Сеть: ${err.message || err}`);
  }
  if (data?.error) return errorWidget(data.error);
  if (typeof data?.total !== "number") return errorWidget("Нет данных");

  const widget = new ListWidget();
  widget.backgroundColor = new Color("#0b0b1f");
  widget.setPadding(12, 14, 12, 14);

  const isPos = data.dayUsd >= 0;
  const accent = isPos ? new Color("#22c55e") : new Color("#ef4444");
  const muted = new Color("#94a3b8");

  // Header
  const header = widget.addText("ПОРТФЕЛЬ");
  header.font = Font.semiboldSystemFont(9);
  header.textColor = muted;

  widget.addSpacer(2);

  // Total
  const totalLine = widget.addText(`$${data.total.toLocaleString("en-US", { maximumFractionDigits: 0 })}`);
  totalLine.font = Font.boldSystemFont(22);
  totalLine.textColor = Color.white();

  widget.addSpacer(4);

  // Day change
  const dayLine = widget.addText(fmtSignedMoney(data.dayUsd));
  dayLine.font = Font.semiboldSystemFont(16);
  dayLine.textColor = accent;

  const pctLine = widget.addText(fmtPct(data.dayPct));
  pctLine.font = Font.mediumSystemFont(13);
  pctLine.textColor = accent;

  widget.addSpacer();

  // Footer: timestamp
  if (data.asOf) {
    const ts = new Date(data.asOf);
    const time = ts.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    const footer = widget.addText(`${time}`);
    footer.font = Font.systemFont(9);
    footer.textColor = muted;
  }

  // Tap → open dashboard
  widget.url = "https://grame.skin/overview";

  return widget;
}

function errorWidget(message) {
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#0b0b1f");
  widget.setPadding(12, 14, 12, 14);
  const header = widget.addText("ПОРТФЕЛЬ");
  header.font = Font.semiboldSystemFont(9);
  header.textColor = new Color("#94a3b8");
  widget.addSpacer(4);
  const err = widget.addText("Ошибка");
  err.font = Font.boldSystemFont(16);
  err.textColor = new Color("#ef4444");
  widget.addSpacer(2);
  const detail = widget.addText(message);
  detail.font = Font.systemFont(11);
  detail.textColor = new Color("#94a3b8");
  detail.minimumScaleFactor = 0.6;
  return widget;
}

// ─── Entry point ────────────────────────────────────────────────────────────

const widget = await buildWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentSmall();
}
Script.complete();

// ─── Installation guide ────────────────────────────────────────────────────
//
// 1.  Open Vercel project "dashboard" → Settings → Environment Variables.
//     Add a new var:
//       Name:  WIDGET_TOKEN
//       Value: any random string you make up, e.g. "abcd1234efgh5678"
//     Apply to: Production
//     Hit "Save" → redeploy the project (Deployments → ⋯ → Redeploy).
//
// 2.  Install "Scriptable" on iPhone (App Store, free).
//
// 3.  Open Scriptable → tap "+" (top-right) → name it "Portfolio".
//     Delete everything and paste this whole file.
//
// 4.  In the script, replace REPLACE_WITH_YOUR_TOKEN with the same string
//     you put into WIDGET_TOKEN above.
//
// 5.  Tap ▶ (play, bottom-right) to test. You should see the small widget
//     preview with your total + today's change.
//
// 6.  Add to Home Screen:
//     - Long-press an empty spot on the Home screen.
//     - Tap "+" (top-left) → search "Scriptable" → choose the small size
//       → Add Widget.
//     - Long-press the new widget → Edit Widget.
//     - "Script" → pick "Portfolio".
//     - "When Interacting" → "Open URL" (so a tap opens the dashboard).
//     - Done.
//
// 7.  The widget refreshes every ~5 min on its own. To force a refresh,
//     long-press → Edit Widget → tap anywhere to dismiss; iOS pulls fresh
//     data within a minute.
