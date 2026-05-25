"use client";
import { useEffect, useMemo, useRef } from "react";
import { useAuthStore } from "./store/useAuthStore";
import { LS_POSITIONS_UPDATED_AT, usePortfolioStore } from "./store/usePortfolioStore";
import { useQuotesStore } from "./store/useQuotesStore";
import { createClient } from "./supabase/client";
import useSWR from "swr";
import { getTradingDayKey, isTradingDayStarted, isMarketHoursNow, loadDayBaseline, saveDayBaseline } from "./tradingDay";

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Quote request failed: ${res.status}`);
  return res.json();
};

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setAuthLoading, loadFromCloud, syncToCloud, scheduleSyncToCloud, user } = useAuthStore();
  const { positions, refreshPositions } = usePortfolioStore();
  const { liveQuotes, setQuotes, setQuoteStatus } = useQuotesStore();
  const supabase = createClient();

  // 1. Auth Listener
  useEffect(() => {
    refreshPositions(); // initial load
    const authTimeout = setTimeout(() => setAuthLoading(false), 4000);

    supabase.auth.getUser().then(({ data: { user: u } }) => {
      clearTimeout(authTimeout);
      setUser(u);
      if (u) loadFromCloud(u.id).finally(() => setAuthLoading(false));
      else setAuthLoading(false);
    }).catch(() => {
      clearTimeout(authTimeout);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      try {
        if (u) await loadFromCloud(u.id);
        else refreshPositions();
      } catch {
        setAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setAuthLoading, loadFromCloud, refreshPositions, supabase.auth]);

  // 2. Periodic cloud sync
  useEffect(() => {
    if (!user) return;
    const id = setInterval(syncToCloud, 60000);
    return () => clearInterval(id);
  }, [user, syncToCloud]);

  useEffect(() => {
    if (!user) return;
    const flush = () => { void syncToCloud(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [user, syncToCloud]);

  // 3. Storage / Position refresh listener
  useEffect(() => {
    const onCustom = () => {
      try {
        if (localStorage.getItem("positions-data")) {
          localStorage.setItem(LS_POSITIONS_UPDATED_AT, new Date().toISOString());
        }
      } catch {}
      refreshPositions();
      scheduleSyncToCloud();
    };
    const onStorage = (e: StorageEvent) => { if (e.key === "positions-data") refreshPositions(); };
    window.addEventListener("positions-updated", onCustom);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("positions-updated", onCustom); window.removeEventListener("storage", onStorage); };
  }, [refreshPositions, scheduleSyncToCloud]);

  
  // 4. Quotes via SWR
  const stockTickers = useMemo(
    () => [...new Set(positions.filter(p => p.type !== "Кэш" && p.type !== "Крипто").map(p => p.ticker))].join(","),
    [positions],
  );
  const cryptoTickers = useMemo(
    () => [...new Set(positions.filter(p => p.type === "Крипто").map(p => p.ticker))].join(","),
    [positions],
  );

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
      const nextQuotes = { ...(stockData ?? {}), ...(cryptoData ?? {}) };
      if (Object.keys(nextQuotes).length > 0) {
        setQuotes(nextQuotes);
        setQuoteStatus("ok");
      } else if (stockTickers || cryptoTickers) {
        setQuoteStatus("error");
      }
    }
  }, [stockData, cryptoData, stockErr, cryptoErr, stockLd, cryptoLd, stockTickers, cryptoTickers, setQuotes, setQuoteStatus]);

  useEffect(() => {
    // 300ms interval. Simulated price is clamped to ±0.01% of the last
    // real SWR price (realQuotes) so drift is always bounded.
    const INTERVAL = 300;
    const MAX_DRIFT = 0.0001; // 0.01%
    const id = setInterval(() => {
      const { quoteStatus } = useQuotesStore.getState();
      if (quoteStatus !== "ok" || !isMarketHoursNow()) return;
      useQuotesStore.setState(state => {
        const next = { ...state.liveQuotes };
        let changed = false;
        for (const ticker of Object.keys(next)) {
          const q = next[ticker];
          const anchor = state.realQuotes[ticker]?.current ?? q.current;
          if (!q.current || !anchor) continue;
          const delta = q.current * (Math.random() * 0.0002 - 0.0001);
          const raw = q.current + delta;
          const lo = anchor * (1 - MAX_DRIFT);
          const hi = anchor * (1 + MAX_DRIFT);
          const clamped = Math.max(lo, Math.min(hi, raw));
          const precision = clamped < 0.01 ? 8 : clamped < 1 ? 6 : 2;
          next[ticker] = { ...q, current: parseFloat(clamped.toFixed(precision)) };
          changed = true;
        }
        return changed ? { liveQuotes: next } : state;
      });
    }, INTERVAL);
    return () => clearInterval(id);
  }, []);

  // 5. Daily auto-snapshot + Istanbul 06:00 day-start baseline
  const autoSnapRef    = useRef("");
  const dayBaselineRef = useRef("");
  // Tracks whether we've already saved the baseline with real live prices this session.
  // Prevents a stale cost-basis value from being locked in before quotes load.
  const baselineLiveRef = useRef(false);

  useEffect(() => {
    const portfolioTotal = positions.reduce((s, p) => s + p.qty * (liveQuotes[p.ticker]?.current || p.avgPrice), 0);
    const totalCost = positions.reduce((s, p) => s + p.qty * p.avgPrice, 0);
    const totalPnl = portfolioTotal - totalCost;
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    if (!positions.length || portfolioTotal <= 0) return;

    // ── Istanbul 06:00 day-start baseline ──────────────────────────────────
    // Only save when live quotes are loaded — avgPrice (cost) would show total
    // unrealised gain as "today's profit" if saved before quotes arrive.
    if (isTradingDayStarted()) {
      const dayKey = getTradingDayKey();
      const qs = useQuotesStore.getState().quoteStatus;
      if (qs === "ok") {
        // Reset the live-save flag when a new trading day starts (tab stays open overnight)
        if (dayKey !== dayBaselineRef.current) baselineLiveRef.current = false;
        if (!baselineLiveRef.current) {
          // First live-price save for this trading day → write/overwrite baseline
          baselineLiveRef.current = true;
          dayBaselineRef.current = dayKey;
          saveDayBaseline(portfolioTotal);
        }
      } else if (dayBaselineRef.current !== dayKey && !loadDayBaseline()) {
        // Quotes not yet loaded AND no baseline at all → save placeholder with avgPrice
        // (will be overwritten once quotes load due to baselineLiveRef guard above)
        dayBaselineRef.current = dayKey;
        saveDayBaseline(portfolioTotal);
      }
    }
    // ──────────────────────────────────────────────────────────────────────

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

  // 6. Scheduled daily snapshot at 03:00 Istanbul (= 00:00 UTC)
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;

    function takeScheduledSnapshot() {
      const { positions: pos } = usePortfolioStore.getState();
      const { liveQuotes: lq } = useQuotesStore.getState();
      if (!pos.length) { schedule(); return; }

      const total = pos.reduce((s, p) => s + p.qty * (lq[p.ticker]?.current || p.avgPrice), 0);
      const cost  = pos.reduce((s, p) => s + p.qty * p.avgPrice, 0);
      const pnl   = total - cost;
      const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
      if (total <= 0) { schedule(); return; }

      const now = new Date();
      const snap = {
        date: now.toLocaleDateString("ru-РУ", { day: "2-digit", month: "2-digit", year: "numeric" }),
        time: now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
        capital: Math.round(total),
        cost: Math.round(cost),
        profit: Math.round(pnl),
        profitPct: pnlPct.toFixed(2) + "%",
        comment: "Авто 03:00",
      };
      try {
        const prev = JSON.parse(localStorage.getItem("snapshots-data") || "[]");
        prev.unshift(snap);
        localStorage.setItem("snapshots-data", JSON.stringify(prev.slice(0, 365)));
      } catch {}
      try {
        const today = now.toISOString().slice(0, 10);
        const hist: { date: string; value: number; cost: number }[] = JSON.parse(
          localStorage.getItem("portfolio-chart-history") || "[]"
        );
        const pt = { date: today, value: Math.round(total), cost: Math.round(cost) };
        const idx = hist.findIndex(h => h.date === today);
        if (idx >= 0) hist[idx] = pt; else hist.push(pt);
        hist.sort((a, b) => a.date.localeCompare(b.date));
        localStorage.setItem("portfolio-chart-history", JSON.stringify(hist.slice(-730)));
      } catch {}
      window.dispatchEvent(new Event("portfolio-snapshot"));
      schedule();
    }

    function schedule() {
      // 03:00 Istanbul = 00:00 UTC
      const now = new Date();
      const next = new Date(now);
      next.setUTCHours(0, 0, 0, 0);
      if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
      timerId = setTimeout(takeScheduledSnapshot, next.getTime() - now.getTime());
    }

    schedule();
    return () => clearTimeout(timerId);
  }, []);

  return <>{children}</>;
}
