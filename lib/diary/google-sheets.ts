// Google Sheets two-way sync for the Excel tab.
//
// Auth: Google Identity Services token client (client-side OAuth).
//   • Scope: spreadsheets (read + write).
//   • Access token cached in-memory for ~58 min; user re-consents when expired.
//
// Setup required (once per project):
//   1. Google Cloud → enable "Google Sheets API"
//   2. OAuth consent screen → External
//   3. Credentials → OAuth Client ID → Web app
//        Authorized JavaScript origins: http://localhost:3005 (+ tunnel URL)
//   4. .env.local → NEXT_PUBLIC_GOOGLE_CLIENT_ID=<client_id>
//
// Sheet must be accessible to the signed-in Google account.

const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
const GIS_SRC = "https://accounts.google.com/gsi/client";

type TokenResponse = { access_token?: string; error?: string; expires_in?: number };
type TokenClient = {
  requestAccessToken: (opts?: { prompt?: string }) => void;
  callback?: (resp: TokenResponse) => void;
};

// Loose global typing for Google Identity Services
type GISLib = {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (resp: TokenResponse) => void;
      }) => TokenClient;
      revoke: (token: string, done?: () => void) => void;
    };
  };
};
declare global {
  interface Window {
    google?: GISLib;
  }
}

let gisPromise: Promise<void> | null = null;
export function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Server-side call"));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      if (window.google?.accounts?.oauth2) return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("GIS load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("GIS load failed"));
    document.head.appendChild(s);
  });
  return gisPromise;
}

// True iff the GIS library has loaded and is ready to call synchronously.
export function isGisReady(): boolean {
  return typeof window !== "undefined" && !!window.google?.accounts?.oauth2;
}

let cachedToken: { value: string; expiresAt: number } | null = null;
let tokenClient: TokenClient | null = null;

export function getClientId(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
}

// IMPORTANT: must be called *synchronously inside* a user-gesture handler
// (button click) — otherwise browsers block the OAuth popup. Pre-load GIS
// via loadGis() during mount so this function returns instantly.
export function requestAccessToken(opts: { prompt?: string } = {}): Promise<string> {
  const clientId = getClientId();
  if (!clientId) {
    return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID не задан в .env.local"));
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000 && !opts.prompt) {
    return Promise.resolve(cachedToken.value);
  }
  if (!isGisReady()) {
    return Promise.reject(
      new Error("GIS ещё не загружен. Перезагрузи страницу — попробуй ещё раз."),
    );
  }
  return new Promise<string>((resolve, reject) => {
    tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error ?? "Нет токена"));
          return;
        }
        const ttl = (resp.expires_in ?? 3500) * 1000;
        cachedToken = { value: resp.access_token, expiresAt: Date.now() + ttl };
        resolve(resp.access_token);
      },
    });
    // Synchronously kick off the popup — this MUST happen within the user
    // gesture frame to bypass popup-blocker.
    tokenClient.requestAccessToken({ prompt: opts.prompt ?? "" });
  });
}

export function signOut(): void {
  if (cachedToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(cachedToken.value);
  }
  cachedToken = null;
  tokenClient = null;
}

export function isSignedIn(): boolean {
  return cachedToken !== null && cachedToken.expiresAt > Date.now();
}

// Extract a spreadsheet ID from a full Google Sheets URL or accept a bare ID.
// Examples:
//   https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0
//   <ID>
export function parseSheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

// Read a sheet range with the given valueRenderOption.
// Returns 2D array of strings; missing cells become "".
async function readSheetWithOption(
  spreadsheetId: string,
  range: string,
  option: "FORMULA" | "UNFORMATTED_VALUE" | "FORMATTED_VALUE",
): Promise<string[][]> {
  const token = await requestAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId,
  )}/values/${encodeURIComponent(range)}?valueRenderOption=${option}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Sheets read ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as { values?: unknown[][] };
  return (data.values ?? []).map((row) => row.map((c) => String(c ?? "")));
}

// Read a sheet in formula mode (cells with formulas come as "=..." text).
export function readSheet(spreadsheetId: string, range: string): Promise<string[][]> {
  return readSheetWithOption(spreadsheetId, range, "FORMULA");
}

// Read a sheet TWICE in parallel: once for formulas, once for computed values.
// Used so we can preserve the formula text AND have Google's last calculated
// value as a fallback when our local parser can't evaluate the formula
// (e.g. VLOOKUP, QUERY, IMPORTRANGE, IMPORTDATA, REGEX*, …).
export type DualSheet = {
  formulas: string[][];
  values: string[][];
};
export async function readSheetDual(
  spreadsheetId: string,
  range: string,
): Promise<DualSheet> {
  const [formulas, values] = await Promise.all([
    readSheetWithOption(spreadsheetId, range, "FORMULA"),
    readSheetWithOption(spreadsheetId, range, "UNFORMATTED_VALUE"),
  ]);
  return { formulas, values };
}

// Write a 2D array to a sheet range (replaces existing values in that range).
// Uses USER_ENTERED so formulas like "=A1+B1" land as live formulas, not text.
export async function writeSheet(
  spreadsheetId: string,
  range: string,
  values: string[][],
): Promise<void> {
  const token = await requestAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId,
  )}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Sheets write ${res.status}: ${errText.slice(0, 200)}`);
  }
}

// Pull data from a PUBLICLY-VIEWABLE Google Sheet without OAuth.
// Routes through our /api/sheets-public proxy because docs.google.com does
// not send CORS headers on the CSV export endpoint (direct browser fetch
// would fail with "Failed to fetch"). Sheet must be shared with
// "Anyone with the link can view".
export async function pullPublicCsv(spreadsheetId: string): Promise<string[][]> {
  const res = await fetch(`/api/sheets-public?id=${encodeURIComponent(spreadsheetId)}`);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch { /* keep msg */ }
    throw new Error(msg);
  }
  const text = await res.text();
  return parseCsv(text);
}

// Minimal CSV parser (handles quoted fields with commas + newlines).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      rows.push(row);
      row = [];
      continue;
    }
    cur += ch;
  }
  if (cur || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.length > 0));
}

// Fetch the first sheet's title (used to build a default range).
export async function getFirstSheetTitle(spreadsheetId: string): Promise<string> {
  const token = await requestAccessToken();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId,
  )}?fields=sheets(properties(title))`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Sheets metadata ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    sheets?: Array<{ properties?: { title?: string } }>;
  };
  return data.sheets?.[0]?.properties?.title ?? "Sheet1";
}
