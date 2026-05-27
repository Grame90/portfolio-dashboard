import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { usePortfolioStore, LS_POSITIONS, LS_POSITIONS_UPDATED_AT } from './usePortfolioStore';

const LS_EXTRA_KEYS = [
  "portfolio-chart-history",
  "dividends-received",
  "snapshots-data",
  "target-structure",
  "dashboard-notifications",
];

export function isProduction(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host !== "localhost" && host !== "127.0.0.1" && !host.startsWith("192.168.");
}

function safeGet(key: string) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}

function safeSet(key: string, val: unknown) {
  try { if (val != null) localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function newerLocalData(localUpdatedAt: unknown, cloudUpdatedAt: unknown): boolean {
  if (typeof localUpdatedAt !== "string" || typeof cloudUpdatedAt !== "string") return false;
  return new Date(localUpdatedAt).getTime() > new Date(cloudUpdatedAt).getTime();
}

interface AuthState {
  user: User | null;
  authLoading: boolean;
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  syncToCloud: () => Promise<void>;
  scheduleSyncToCloud: () => void;
  loadFromCloud: (uid: string) => Promise<void>;
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
const supabase = createClient();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  authLoading: true,
  setUser: (user) => set({ user }),
  setAuthLoading: (loading) => set({ authLoading: loading }),

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  },

  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? error.message : null;
  },

  signOut: async () => {
    await get().syncToCloud();
    await supabase.auth.signOut();
    [LS_POSITIONS, 'dashboard-settings', ...LS_EXTRA_KEYS].forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });
    usePortfolioStore.getState().clearPositions();
  },

  loadFromCloud: async (uid) => {
    if (!isProduction()) {
      usePortfolioStore.getState().refreshPositions();
      return;
    }

    // Shared dataset: everyone reads the same row via the server endpoint
    // (service role bypasses RLS). `uid` is unused now — kept for signature.
    void uid;
    let data: Record<string, unknown> | null = null;
    try {
      const res = await fetch("/api/shared-data");
      if (res.ok) {
        const json = await res.json();
        data = json.data ?? null;
      }
    } catch {
      data = null;
    }

    if (data) {
      const row = data as Record<string, unknown>;
      const cloudPositions = (row.positions as unknown[]) ?? [];
      const localPositions = (safeGet(LS_POSITIONS) as unknown[]) ?? [];
      const localUpdatedAt = localStorage.getItem(LS_POSITIONS_UPDATED_AT);
      const cloudUpdatedAt = typeof row.updated_at === "string" ? row.updated_at : undefined;

      if (cloudPositions.length === 0 && localPositions.length > 0) {
        // use local
        usePortfolioStore.getState().refreshPositions();
        setTimeout(() => get().syncToCloud(), 3000);
        return;
      }

      if (cloudPositions.length > 0 && localPositions.length > 0 && newerLocalData(localUpdatedAt, cloudUpdatedAt)) {
        usePortfolioStore.getState().refreshPositions();
        setTimeout(() => get().syncToCloud(), 3000);
        return;
      }

      if (row.positions) safeSet(LS_POSITIONS, row.positions);
      if (row.positions) localStorage.setItem(LS_POSITIONS_UPDATED_AT, cloudUpdatedAt ?? new Date().toISOString());
      if (row.settings) safeSet('dashboard-settings', row.settings);

      LS_EXTRA_KEYS.forEach(k => {
        const dbKey = k.replace(/-/g, "_");
        if (row[dbKey]) safeSet(k, row[dbKey]);
      });

      usePortfolioStore.getState().refreshPositions();
    } else {
      usePortfolioStore.getState().refreshPositions();
      setTimeout(() => get().syncToCloud(), 3000);
    }
  },

  syncToCloud: async () => {
    const user = get().user;
    if (!user) return;
    if (!isProduction()) return;

    const positionsToSync = safeGet(LS_POSITIONS) ?? [];
    if (positionsToSync.length === 0 && (safeGet('dashboard-settings') === null)) return;

    // Shared dataset: write to the single shared row via the server endpoint.
    try {
      const res = await fetch("/api/shared-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          positions:        safeGet(LS_POSITIONS) ?? [],
          settings:         safeGet('dashboard-settings') ?? {},
          portfolio_chart_history: safeGet("portfolio-chart-history") ?? [],
          dividends_received:      safeGet("dividends-received") ?? [],
          snapshots_data:          safeGet("snapshots-data") ?? [],
          target_structure:        safeGet("target-structure") ?? [],
          dashboard_notifications: safeGet("dashboard-notifications") ?? [],
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        console.error("[Shared sync error]", j.error ?? res.status);
      }
    } catch (e) {
      console.error("[Shared sync exception]", e);
    }
  },

  scheduleSyncToCloud: () => {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => get().syncToCloud(), 2000);
  }
}));
