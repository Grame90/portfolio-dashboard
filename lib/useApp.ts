import { useMemo } from "react";
import { useAuthStore } from "./store/useAuthStore";
import { usePortfolioStore } from "./store/usePortfolioStore";
import { useSettingsStore } from "./store/useSettingsStore";
import { useQuotesStore } from "./store/useQuotesStore";

export function useApp() {
  const auth = useAuthStore();
  const portfolio = usePortfolioStore();
  const settings = useSettingsStore();
  const quotes = useQuotesStore();

  const positions = portfolio.positions;
  const liveQuotes = quotes.liveQuotes;

  // Memoized: the 7+ portfolio calculations and the per-position map only re-run
  // when positions or live quotes actually change — not on every unrelated render
  // (this hook is called across 40+ pages, so the saving compounds).
  const { portfolioTotal, totalCost, totalPnl, totalPnlPct, dailyChange, dailyChangePct, computedPositions } = useMemo(() => {
    const portfolioTotal = positions.reduce((s, p) => s + p.qty * (liveQuotes[p.ticker]?.current || p.avgPrice), 0);
    const totalCost = positions.reduce((s, p) => s + p.qty * p.avgPrice, 0);
    const totalPnl = portfolioTotal - totalCost;
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    // Daily change: sum of (current - previousClose) × qty across positions.
    // Reflects the real market move from yesterday's close, regardless of when the
    // app was opened — matches the per-position "День $/%" columns.
    const dailyChange = positions.reduce((sum, p) => {
      const q = liveQuotes[p.ticker];
      if (!q) return sum;
      const current = Number(q.current);
      const previousClose = Number(q.previousClose);
      if (!Number.isFinite(current) || !Number.isFinite(previousClose) || current <= 0 || previousClose <= 0) return sum;
      const rel = Math.abs(current - previousClose) / previousClose;
      if (rel > 0.5) return sum; // guard against broken feed spikes (>50% day move)
      return sum + p.qty * (current - previousClose);
    }, 0);

    const prevTotal = portfolioTotal - dailyChange;
    const dailyChangePct = prevTotal > 0 ? (dailyChange / prevTotal) * 100 : 0;

    const computedPositions = positions.map(p => {
      const q = liveQuotes[p.ticker];
      const currentPrice = q?.current || p.avgPrice;
      const previousClose = q?.previousClose || p.avgPrice;
      const value = p.qty * currentPrice;
      const cost = p.qty * p.avgPrice;
      const pnl = p.avgPrice > 0 ? Math.round(value - cost) : 0;
      const pnlPct = p.avgPrice > 0 ? ((currentPrice - p.avgPrice) / p.avgPrice) * 100 : 0;
      const share = portfolioTotal > 0 ? (value / portfolioTotal) * 100 : 0;

      return {
        ...p,
        currentPrice,
        previousClose,
        value: Math.round(value),
        pnl,
        pnlPct,
        share,
        live: p.type !== "Кэш",
      };
    });

    return { portfolioTotal, totalCost, totalPnl, totalPnlPct, dailyChange, dailyChangePct, computedPositions };
  }, [positions, liveQuotes]);

  return {
    positions: computedPositions, // Now fully computed!
    rawPositions: portfolio.positions,
    setPositions: portfolio.setPositions,
    refreshPositions: portfolio.refreshPositions,
    
    liveQuotes: quotes.liveQuotes,
    quoteStatus: quotes.quoteStatus,
    
    settings: settings.settings,
    updateSettings: settings.updateSettings,
    
    user: auth.user,
    authLoading: auth.authLoading,
    signIn: auth.signIn,
    signUp: auth.signUp,
    signOut: auth.signOut,
    syncToCloud: auth.syncToCloud,
    
    portfolioTotal,
    totalCost,
    totalPnl,
    totalPnlPct,
    dailyChange,
    dailyChangePct,
  };
}
