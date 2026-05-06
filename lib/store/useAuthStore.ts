import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { usePortfolioStore, LS_POSITIONS } from './usePortfolioStore';
import { useSettingsStore } from './useSettingsStore';

const LS_EXTRA_KEYS = [
  "portfolio-chart-history",
  "dividends-received",
  "snapshots-data",
  "target-structure",
  "dashboard-notifications",
  "operations-log",
  "portfolio-cols",
  "portfolio-col-order",
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

// Map localStorage key → Supabase column name
const KEY_TO_COL: Record<string, string> = {
  "portfolio-chart-history": "portfolio_chart_history",
  "dividends-received":      "dividends_received",
  "snapshots-data":          "snapshots_data",
  "target-structure":        "target_structure",
  "dashboard-notifications": "dashboard_notifications",
  "operations-log":          "operations_log",
  "portfolio-cols":          "portfolio_cols",
  "portfolio-col-order":     "portfolio_col_order",
};

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
  subscribeRealtime: (uid: string) => () => void;
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
    usePortfolioStore.getState().setPositions([]);
  },

  loadFromCloud: async (uid) => {
    if (!isProduction()) {
      usePortfolioStore.getState().refreshPositions();
      return;
    }

    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 8000));
    const query = supabase.from("user_data").select("*").eq("user_id", uid).single();
    const result = await Promise.race([query, timeout]);
    const data = result && "data" in result ? (result as any).data : result;

    if (data) {
      const cloudPositions = data.positions ?? [];
      const localPositions = safeGet(LS_POSITIONS) ?? [];

      if (cloudPositions.length === 0 && localPositions.length > 0) {
        usePortfolioStore.getState().refreshPositions();
        setTimeout(() => get().syncToCloud(), 3000);
        return;
      }

      if (data.positions) safeSet(LS_POSITIONS, data.positions);
      if (data.settings) safeSet('dashboard-settings', data.settings);

      LS_EXTRA_KEYS.forEach(k => {
        const col = KEY_TO_COL[k];
        if (col && data[col] != null) safeSet(k, data[col]);
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
    const settings = safeGet('dashboard-settings');
    if (positionsToSync.length === 0 && settings === null) return;

    const payload: Record<string, unknown> = {
      user_id:   user.id,
      positions: positionsToSync,
      settings:  settings ?? {},
      updated_at: new Date().toISOString(),
    };

    LS_EXTRA_KEYS.forEach(k => {
      const col = KEY_TO_COL[k];
      if (col) payload[col] = safeGet(k) ?? [];
    });

    try {
      const { error } = await supabase.from("user_data").upsert(payload, { onConflict: "user_id" });
      if (error) console.error("[Supabase sync error]", error.message, error.code);
    } catch (e) {
      console.error("[Supabase sync exception]", e);
    }
  },

  scheduleSyncToCloud: () => {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => get().syncToCloud(), 1500);
  },

  subscribeRealtime: (uid: string) => {
    if (!isProduction()) return () => {};

    const channel = supabase
      .channel(`user_data:${uid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_data", filter: `user_id=eq.${uid}` },
        (payload) => {
          const data = payload.new as Record<string, unknown>;

          // Update positions
          if (Array.isArray(data.positions)) {
            safeSet(LS_POSITIONS, data.positions);
            usePortfolioStore.getState().refreshPositions();
          }

          // Update settings
          if (data.settings) {
            safeSet('dashboard-settings', data.settings);
          }

          // Update all extra keys
          LS_EXTRA_KEYS.forEach(k => {
            const col = KEY_TO_COL[k];
            if (col && data[col] != null) safeSet(k, data[col]);
          });

          // Notify app that data changed
          window.dispatchEvent(new Event("positions-updated"));
          window.dispatchEvent(new Event("portfolio-snapshot"));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },
}));
