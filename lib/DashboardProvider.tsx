"use client";
import { useEffect, useRef } from "react";
import { useAuthStore } from "./store/useAuthStore";
import { usePortfolioStore } from "./store/usePortfolioStore";
import { useSettingsStore } from "./store/useSettingsStore";
import { useQuotesStore } from "./store/useQuotesStore";
import { createClient } from "./supabase/client";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setAuthLoading, loadFromCloud, syncToCloud, subscribeRealtime, user } = useAuthStore();
  const { positions, refreshPositions } = usePortfolioStore();
  const { liveQuotes, updateQuotes, setQuotes, setQuoteStatus } = useQuotesStore();
  const supabase = createClient();
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Auth Listener + Realtime subscription
  useEffect(() => {
    refreshPositions(); // initial load
    let unsubRealtime: (() => void) | undefined;

    // getSession reads from localStorage instantly — no network hang
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        loadFromCloud(u.id).finally(() => setAuthLoading(false));
        unsubRealtime = subscribeRealtime(u.id);
      } else {
        setAuthLoading(false);
      }
    }).catch(() => {
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) await loadFromCloud(u.id);
      else refreshPositions();
    });

    return () => { subscription.unsubscribe(); unsubRealtime?.(); };
  }, [setUser, setAuthLoading, loadFromCloud, refreshPositions, subscribeRealtime, supabase.auth]);

  // 2. Periodic cloud sync (every 15 sec instead of 60)
  useEffect(() => {
    if (!user) return;
    const id = setInterval(syncToCloud, 15000);
    return () => clearInterval(id);
  }, [user, syncToCloud]);

  // 3. Storage / Position refresh listener
  useEffect(() => {
    const onCustom = () => refreshPositions();
    const onStorage = (e: StorageEvent) => { if (e.key === "positions-data") refreshPositions(); };
    window.addEventListener("positions-updated", onCustom);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("positions-updated", onCustom); window.removeEventListener("storage", onStorage); };
  }, [refreshPositions]);

  
  // 4. Quotes via SWR
  const stocks  = positions.filter(p => p.type !== "Кэш" && p.type !== "Крипто");
  const cryptos = positions.filter(p => p.type === "Крипто");
  const stockTickers = stocks.map(p=>p.ticker).join(",");
  const cryptoTickers = cryptos.map(p=>p.ticker).join(",");

  const { data: stockData, error: stockErr, isLoading: stockLd } = useSWR(stockTickers ? `/api/quotes?tickers=${stockTickers}` : null, fetcher, { refreshInterval: 30000 });
  const { data: cryptoData, error: cryptoErr, isLoading: cryptoLd } = useSWR(cryptoTickers ? `/api/crypto?tickers=${cryptoTickers}` : null, fetcher, { refreshInterval: 30000 });

  useEffect(() => {
    if (stockLd || cryptoLd) {
      setQuoteStatus("loading");
      return;
    }
    if (stockErr || cryptoErr) {
      setQuoteStatus("error");
      return;
    }
    if (stockData || cryptoData) {
      setQuotes({ ...stockData, ...cryptoData });
      setQuoteStatus("ok");
    }
  }, [stockData, cryptoData, stockErr, cryptoErr, stockLd, cryptoLd, setQuotes, setQuoteStatus]);

  useEffect(() => {
    const id = setInterval(() => {

      const currentQuotes = useQuotesStore.getState().liveQuotes;
      const next = { ...currentQuotes };
      let changed = false;
      for (const ticker of Object.keys(next)) {
        const q = next[ticker];
        if (!q.current) continue;
        const delta = q.current * (Math.random() * 0.003 - 0.0015);
        next[ticker] = { ...q, current: Math.round((q.current + delta) * 100) / 100 };
        changed = true;
      }
      if (changed) setQuotes(next);
    }, 3000);
    return () => clearInterval(id);
  }, [setQuotes]);

  // 5. Daily auto-snapshot
  const autoSnapRef = useRef("");
  useEffect(() => {
    const portfolioTotal = positions.reduce((s, p) => s + p.qty * (liveQuotes[p.ticker]?.current || p.avgPrice), 0);
    const totalCost = positions.reduce((s, p) => s + p.qty * p.avgPrice, 0);
    const totalPnl = portfolioTotal - totalCost;
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    if (!positions.length || portfolioTotal <= 0) return;
    const today = new Date().toISOString().slice(0, 10);
    if (autoSnapRef.current === today) return;
    try { if (localStorage.getItem("auto-snapshot-date") === today) { autoSnapRef.current = today; return; } } catch {}
    autoSnapRef.current = today;
    try { localStorage.setItem("auto-snapshot-date", today); } catch {}
    const now = new Date();
    const snap = {
      date: now.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }),
      time: now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      capital: Math.round(portfolioTotal),
      cost: Math.round(totalCost),
      profit: Math.round(totalPnl),
      profitPct: totalPnlPct.toFixed(2) + "%",
      comment: "Авто-фиксация",
    };
    try {
      const existing = JSON.parse(localStorage.getItem("snapshots-data") || "[]");
      existing.unshift(snap);
      localStorage.setItem("snapshots-data", JSON.stringify(existing.slice(0, 365)));
    } catch {}
    try {
      const hist: {date: string; value: number; cost: number}[] = JSON.parse(localStorage.getItem("portfolio-chart-history") || "[]");
      const pt = { date: today, value: Math.round(portfolioTotal), cost: Math.round(totalCost) };
      const idx = hist.findIndex(p => p.date === today);
      if (idx >= 0) hist[idx] = pt; else hist.push(pt);
      hist.sort((a, b) => a.date.localeCompare(b.date));
      localStorage.setItem("portfolio-chart-history", JSON.stringify(hist.slice(-730)));
    } catch {}
    window.dispatchEvent(new Event("portfolio-snapshot"));
  }, [positions, liveQuotes]);

  return <>{children}</>;
}
