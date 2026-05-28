import { readdirSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export const runtime = "nodejs";

const RESTORE_KEYS = [
  "positions-data",
  "dashboard-settings",
  "portfolio-chart-history",
  "dividends-received",
  "snapshots-data",
  "target-structure",
];

function latestPortfolioBackup(): string | null {
  const downloads = join(homedir(), "Downloads");
  const files = readdirSync(downloads)
    .filter((name) => /^portfolio_backup_\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort()
    .reverse();

  return files[0] ? join(downloads, files[0]) : null;
}

export async function GET() {
  const backupPath = latestPortfolioBackup();
  if (!backupPath) {
    return new Response("Portfolio backup was not found in Downloads.", { status: 404 });
  }

  const backup = JSON.parse(readFileSync(backupPath, "utf8")) as Record<string, unknown>;
  const payload = RESTORE_KEYS.reduce<Record<string, unknown>>((acc, key) => {
    if (backup[key] != null) acc[key] = backup[key];
    return acc;
  }, {});

  const safePayload = JSON.stringify(payload).replace(/</g, "\\u003c");
  const safeName = JSON.stringify(backupPath.split("/").pop() ?? "backup").replace(/</g, "\\u003c");

  return new Response(
    `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>Restoring portfolio</title>
  </head>
  <body>
    <script>
      const payload = ${safePayload};
      for (const [key, value] of Object.entries(payload)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
      window.dispatchEvent(new Event("positions-updated"));
      document.body.textContent = "Портфель восстановлен из " + ${safeName} + ". Возвращаю на страницу портфеля...";
      setTimeout(() => location.replace("/portfolio"), 500);
    </script>
  </body>
</html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
