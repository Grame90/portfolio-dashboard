import { actionItems } from "@/lib/mockData";
import type { useApp } from "@/lib/useApp";
import { LS_TARGET } from "./constants";
import type { TargetRow } from "./types";

export function loadTargetStructure(): TargetRow[] {
  try {
    const raw = localStorage.getItem(LS_TARGET);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveTargetStructure(rows: TargetRow[]): void {
  try {
    localStorage.setItem(LS_TARGET, JSON.stringify(rows));
  } catch {}
}

export function parseDMY(s: string): number {
  const [d, m, y] = s.split(".");
  return new Date(`${y}-${m}-${d}`).getTime();
}

type AppState = ReturnType<typeof useApp>;

export function buildActionList(
  positions: AppState["positions"],
  liveQuotes: AppState["liveQuotes"],
  portfolioTotal: number,
  structure: TargetRow[],
  fallback: typeof actionItems,
): typeof actionItems {
  if (!positions.length || !portfolioTotal) return fallback;
  const generated = structure
    .map(t => {
      const isCash = t.ticker === "КЭШ(USD)";
      const pos = isCash
        ? positions.find(p => p.type === "Кэш")
        : positions.find(p => p.ticker === t.ticker);
      const liveShare = pos
        ? (pos.qty * (liveQuotes[pos.ticker]?.current || pos.avgPrice) / portfolioTotal) * 100
        : 0;
      const dev = parseFloat((liveShare - t.target).toFixed(2));
      if (Math.abs(dev) < 1) return null;
      const displayTicker = isCash ? "КЭШ" : t.ticker;
      return {
        id: t.ticker.charCodeAt(0) * 31 + (t.ticker.charCodeAt(1) || 0),
        ticker: displayTicker,
        action: dev > 0 ? `Фиксировать прибыль ${displayTicker}` : `Докупить ${displayTicker}`,
        amount: Math.round(Math.abs(dev / 100) * portfolioTotal),
        qty: 0,
        priority: Math.abs(dev) > 5 ? "Высокий" : "Средний",
        reason: `Отклонение от цели ${dev > 0 ? "+" : ""}${dev.toFixed(2)}%. Целевая доля: ${t.target}%, текущая: ${liveShare.toFixed(2)}%.`,
        status: "Ожидание",
        deadline: "",
        color: dev > 0 ? "#ef4444" : "#7c3aed",
      };
    })
    .filter(Boolean) as typeof actionItems;
  return generated.length > 0 ? generated : fallback;
}
