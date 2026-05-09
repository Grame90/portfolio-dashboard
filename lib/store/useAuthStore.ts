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
    usePortfolioStore.getState().setPositions([]);
  },

  loadFromCloud: async (uid) => {
    if (!isProduction()) {
      usePortfolioStore.getState().refreshPositions();
      return;
    }

    const { data } = await supabase
      .from("user_data")
      .select("*")
      .eq("user_id", uid)
      .single();

    if (data) {
      const cloudPositions = data.positions ?? [];
      const localPositions = safeGet(LS_POSITIONS) ?? [];

      if (cloudPositions.length === 0 && localPositions.length > 0) {
        // use local
        usePortfolioStore.getState().refreshPositions();
        setTimeout(() => get().syncToCloud(), 3000);
        return;
      }

      if (data.positions) safeSet(LS_POSITIONS, data.positions);
      if (data.settings) safeSet('dashboard-settings', data.settings);
      
      LS_EXTRA_KEYS.forEach(k => {
        const dbKey = k.replace(/-/g, "_");
        if (data[dbKey]) safeSet(k, data[dbKey]);
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
    
    try {
      const { error } = await supabase.from("user_data").upsert({
        user_id: user.id,
        positions:        safeGet(LS_POSITIONS) ?? [],
        settings:         safeGet('dashboard-settings') ?? {},
        portfolio_chart_history: safeGet("portfolio-chart-history") ?? [],
        dividends_received:      safeGet("dividends-received") ?? [],
        snapshots_data:          safeGet("snapshots-data") ?? [],
        target_structure:        safeGet("target-structure") ?? [],
        dashboard_notifications: safeGet("dashboard-notifications") ?? [],
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      
      if (error) console.error("[Supabase sync error]", error.message, error.code);
    } catch (e) {
      console.error("[Supabase sync exception]", e);
    }
  },

  scheduleSyncToCloud: () => {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => get().syncToCloud(), 2000);
  }
}));
