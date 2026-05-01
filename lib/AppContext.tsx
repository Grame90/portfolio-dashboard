"use client";
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export const LS_POSITIONS = "positions-data";
export const LS_SETTINGS  = "dashboard-settings";

const LS_EXTRA_KEYS = [
  "portfolio-chart-history",
  "dividends-received",
  "snapshots-data",
  "target-structure",
  "dashboard-notifications",
];

export type StoredPosition = {
  id: number; ticker: string; name: string; type: string;
  qty: number; avgPrice: number; color: string; purchaseDate: string; action: string;
};

export type Settings = {
  portfolioName: string;
  targetAmount: number;
  monthlyContribution: number;
  investmentHorizon: number;
  targetIncome: number;
  riskLevel: string;
  maxDrawdown: number;
  maxPositionSize: number;
  minCash: number;
  stopLoss: number;
  rebalancePeriod: string;
  currency: string;
};

export type LiveQuote = { current: number; previousClose: number };

export type AppState = {
  positions: StoredPosition[];
  liveQuotes: Record<string, LiveQuote>;
  settings: Settings;
  quoteStatus: "idle" | "loading" | "ok" | "error";
  user: User | null;
  authLoading: boolean;
  updateSettings: (patch: Partial<Settings>) => void;
  refreshPositions: () => void;
  syncToCloud: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  portfolioTotal: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPct: number;
  dailyChange: number;
  dailyChangePct: number;
};

const DEFAULT_SETTINGS: Settings = {
  portfolioName: "Основной портфель",
  targetAmount: 400000,
  monthlyContribution: 1500,
  investmentHorizon: 10,
  targetIncome: 60000,
  riskLevel: "Средний",
  maxDrawdown: 20,
  maxPositionSize: 25,
  minCash: 5,
  stopLoss: 15,
  rebalancePeriod: "Квартально",
  currency: "USD",
};

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be inside AppProvider");
  return ctx;
}

function readPositions(): StoredPosition[] {
  try { const r = localStorage.getItem(LS_POSITIONS); return r ? JSON.parse(r) : []; } catch { return []; }
}
function readSettings(): Settings {
  try { const r = localStorage.getItem(LS_SETTINGS); return r ? { ...DEFAULT_SETTINGS, ...JSON.parse(r) } : DEFAULT_SETTINGS; } catch { return DEFAULT_SETTINGS; }
}

function safeGet(key: string) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}
function safeSet(key: string, val: unknown) {
  try { if (val != null) localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const [positions, setPositions] = useState<StoredPosition[]>([]);
  const [liveQuotes, setLiveQuotes]   = useState<Record<string, LiveQuote>>({});
  const [settings, setSettings]       = useState<Settings>(DEFAULT_SETTINGS);
  const [quoteStatus, setQuoteStatus] = useState<"idle"|"loading"|"ok"|"error">("idle");
  const [user, setUser]               = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const quotesRef = useRef(liveQuotes);
  quotesRef.current = liveQuotes;
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Supabase helpers ────────────────────────────────────────────────────────

  async function loadFromCloud(uid: string) {
    const { data } = await supabase
      .from("user_data")
      .select("*")
      .eq("user_id", uid)
      .single();

    if (data) {
      if (data.positions)      safeSet(LS_POSITIONS, data.positions);
      if (data.settings)       safeSet(LS_SETTINGS, data.settings);
      LS_EXTRA_KEYS.forEach(k => { if (data[k.replace(/-/g, "_")]) safeSet(k, data[k.replace(/-/g, "_")]); });

      setPositions(data.positions ?? []);
      setSettings({ ...DEFAULT_SETTINGS, ...(data.settings ?? {}) });
    } else {
      // First login — load from localStorage if any
      setPositions(readPositions());
      setSettings(readSettings());
    }
  }

  async function syncToCloud() {
    if (!user) return;
    try {
      await supabase.from("user_data").upsert({
        user_id: user.id,
        positions:        safeGet(LS_POSITIONS) ?? [],
        settings:         safeGet(LS_SETTINGS) ?? {},
        portfolio_chart_history: safeGet("portfolio-chart-history") ?? [],
        dividends_received:      safeGet("dividends-received") ?? [],
        snapshots_data:          safeGet("snapshots-data") ?? [],
        target_structure:        safeGet("target-structure") ?? [],
        dashboard_notifications: safeGet("dashboard-notifications") ?? [],
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    } catch {}
  }

  function scheduleSyncToCloud() {
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(syncToCloud, 2000);
  }

  // ── Auth state ──────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      if (u) loadFromCloud(u.id).finally(() => setAuthLoading(false));
      else setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) await loadFromCloud(u.id);
      else {
        setPositions([]);
        setSettings(DEFAULT_SETTINGS);
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic cloud sync every 60 seconds
  useEffect(() => {
    if (!user) return;
    const id = setInterval(syncToCloud, 60000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Auth actions ─────────────────────────────────────────────────────────────

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }

  async function signUp(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? error.message : null;
  }

  async function signOut() {
    await syncToCloud();
    await supabase.auth.signOut();
    // Clear localStorage
    [LS_POSITIONS, LS_SETTINGS, ...LS_EXTRA_KEYS].forEach(k => { try { localStorage.removeItem(k); } catch {} });
  }

  // ── Positions ────────────────────────────────────────────────────────────────

  const refreshPositions = useCallback(() => {
    setPositions(readPositions());
    scheduleSyncToCloud();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const onCustom  = () => refreshPositions();
    const onStorage = (e: StorageEvent) => { if (e.key === LS_POSITIONS) refreshPositions(); };
    window.addEventListener("positions-updated", onCustom);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("positions-updated", onCustom); window.removeEventListener("storage", onStorage); };
  }, [refreshPositions]);

  // ── Settings ─────────────────────────────────────────────────────────────────

  function updateSettings(patch: Partial<Settings>) {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(LS_SETTINGS, JSON.stringify(next)); } catch {}
      scheduleSyncToCloud();
      return next;
    });
  }

  // ── Live quotes ──────────────────────────────────────────────────────────────

  const fetchAllQuotes = useCallback(async (list: StoredPosition[]) => {
    const stocks  = list.filter(p => p.type !== "Кэш" && p.type !== "Крипто");
    const cryptos = list.filter(p => p.type === "Крипто");
    if (!stocks.length && !cryptos.length) return;
    setQuoteStatus("loading");
    try {
      const combined: Record<string, LiveQuote> = {};
      if (stocks.length)  { const r = await fetch(`/api/quotes?tickers=${stocks.map(p=>p.ticker).join(",")}`);  if (r.ok) Object.assign(combined, await r.json()); }
      if (cryptos.length) { const r = await fetch(`/api/crypto?tickers=${cryptos.map(p=>p.ticker).join(",")}`); if (r.ok) Object.assign(combined, await r.json()); }
      setLiveQuotes(combined);
      setQuoteStatus("ok");
    } catch { setQuoteStatus("error"); }
  }, []);

  useEffect(() => {
    if (positions.length) fetchAllQuotes(positions);
    const id = setInterval(() => { setPositions(prev => { fetchAllQuotes(prev); return prev; }); }, 30000);
    return () => clearInterval(id);
  }, [positions, fetchAllQuotes]);

  useEffect(() => {
    const id = setInterval(() => {
      setLiveQuotes(prev => {
        const next = { ...prev };
        let changed = false;
        for (const ticker of Object.keys(next)) {
          const q = next[ticker];
          if (!q.current) continue;
          const delta = q.current * (Math.random() * 0.003 - 0.0015);
          next[ticker] = { ...q, current: Math.round((q.current + delta) * 100) / 100 };
          changed = true;
        }
        return changed ? next : prev;
      });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // ── Derived metrics ──────────────────────────────────────────────────────────

  const portfolioTotal = positions.reduce((s, p) => s + p.qty * (liveQuotes[p.ticker]?.current || p.avgPrice), 0);
  const totalCost      = positions.reduce((s, p) => s + p.qty * p.avgPrice, 0);
  const totalPnl       = portfolioTotal - totalCost;
  const totalPnlPct    = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const prevTotal      = positions.reduce((s, p) => s + p.qty * (liveQuotes[p.ticker]?.previousClose || p.avgPrice), 0);
  const dailyChange    = portfolioTotal - prevTotal;
  const dailyChangePct = prevTotal > 0 ? (dailyChange / prevTotal) * 100 : 0;

  return (
    <AppContext.Provider value={{
      positions, liveQuotes, settings, quoteStatus, user, authLoading,
      updateSettings, refreshPositions, syncToCloud,
      signIn, signUp, signOut,
      portfolioTotal, totalCost, totalPnl, totalPnlPct, dailyChange, dailyChangePct,
    }}>
      {children}
    </AppContext.Provider>
  );
}
