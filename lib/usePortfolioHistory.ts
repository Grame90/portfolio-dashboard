"use client";

import { useState, useEffect, useMemo } from "react";
import type { StoredPosition } from "./types";

export type HistPoint = { date: string; value: number; cost: number };
export type HistData  = Record<string, { dates: string[]; closes: number[]; returns?: number[] }>;

export function usePortfolioHistory(
  positions: StoredPosition[],
  lsHistory:  HistPoint[],
  liveTotal:  number,
  liveCost:   number,
  extraTickers: string[] = [],
  days = 500,
) {
  const [histData,   setHistData]   = useState<HistData>({});
  const [histLoaded, setHistLoaded] = useState(false);

  useEffect(() => {
    const positionTickers = positions
      .filter(p => p.type !== "Кэш")
      .map(p => p.ticker);
    const tickers = Array.from(new Set([...positionTickers, ...extraTickers].filter(Boolean)));
    if (!tickers.length) { setHistLoaded(true); return; }
    setHistLoaded(false);
    fetch(`/api/historical?tickers=${tickers.join(",")}&days=${days}`)
      .then(r => r.ok ? r.json() : {})
      .then((data: HistData) => { setHistData(data ?? {}); setHistLoaded(true); })
      .catch(() => setHistLoaded(true));
  // Only re-run when ticker list or days changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions.map(p => p.ticker).join(","), extraTickers.join(","), days]);

  const computedTimeline = useMemo((): HistPoint[] => {
    if (!positions.length || !Object.keys(histData).length) return [];
    const totalCost = positions.reduce((s, p) => s + p.qty * p.avgPrice, 0);
    const allDates  = new Set<string>();
    for (const h of Object.values(histData)) h.dates.forEach(d => allDates.add(d));
    return [...allDates].sort().map(date => {
      let val = 0;
      for (const p of positions) {
        const fallback = p.qty * p.avgPrice;
        if (p.type === "Кэш") { val += fallback; continue; }
        const h = histData[p.ticker];
        if (!h?.dates.length) { val += fallback; continue; }
        let idx = -1;
        for (let i = h.dates.length - 1; i >= 0; i--) {
          if (h.dates[i] <= date) { idx = i; break; }
        }
        val += idx >= 0 ? p.qty * h.closes[idx] : fallback;
      }
      return { date, value: Math.round(val), cost: Math.round(totalCost) };
    });
  }, [histData, positions]);

  const mergedTimeline = useMemo((): HistPoint[] => {
    const byDate = new Map<string, { value: number; cost: number }>();
    for (const p of lsHistory) byDate.set(p.date, { value: p.value, cost: p.cost });
    for (const p of computedTimeline) {
      const ex = byDate.get(p.date);
      byDate.set(p.date, { value: p.value, cost: ex?.cost ?? p.cost });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (liveTotal > 0) byDate.set(today, { value: Math.round(liveTotal), cost: Math.round(liveCost) });
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));
  }, [lsHistory, computedTimeline, liveTotal, liveCost]);

  return { histData, histLoaded, computedTimeline, mergedTimeline };
}
