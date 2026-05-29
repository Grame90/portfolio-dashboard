import { positions as initialPositions } from "@/lib/mockData";
import {
  BROKER_COLORS,
  COLORS,
  LS_POSITIONS,
  PURCHASE_DATES,
} from "./constants";
import type { Position, SavedPosition } from "./types";

export function autoColor(ticker: string): string {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) & 0xffffffff;
  return COLORS[Math.abs(h) % COLORS.length];
}

export function brokerColor(name: string): string {
  if (!name) return "#94a3b8";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return BROKER_COLORS[Math.abs(h) % BROKER_COLORS.length];
}

export function recompute(positions: Position[]): Position[] {
  const total = positions.reduce((s, p) => s + p.qty * p.currentPrice, 0);
  return positions.map((p) => {
    const value = p.qty * p.currentPrice;
    const cost = p.qty * p.avgPrice;
    const pnl = p.avgPrice > 0 ? Math.round(value - cost) : 0;
    const pnlPct = p.avgPrice > 0 ? ((p.currentPrice - p.avgPrice) / p.avgPrice) * 100 : 0;
    const share = total > 0 ? (value / total) * 100 : 0;
    return { ...p, value: Math.round(value), pnl, pnlPct, share };
  });
}

export function persistPositions(list: Position[]): void {
  try {
    const data: SavedPosition[] = list.map(({ id, ticker, name, type, qty, avgPrice, color, purchaseDate, action, broker }) => ({
      id, ticker, name, type, qty, avgPrice, color, purchaseDate, action, broker,
    }));
    localStorage.setItem(LS_POSITIONS, JSON.stringify(data));
    try { window.dispatchEvent(new CustomEvent("positions-updated")); } catch {}
  } catch {}
}

export const seed: Position[] = recompute(
  initialPositions.map((p) => ({
    id: p.id,
    ticker: p.ticker,
    name: p.name,
    type: p.type,
    qty: p.qty,
    avgPrice: p.avgPrice,
    currentPrice: p.currentPrice,
    previousClose: p.previousClose,
    color: p.color,
    value: p.value,
    pnl: p.pnl,
    pnlPct: p.pnlPct,
    share: p.share,
    action: p.action,
    live: p.type !== "Кэш",
    purchaseDate: PURCHASE_DATES[p.id] ?? "",
  }))
);

export function loadPositions(): Position[] {
  try {
    const raw = localStorage.getItem(LS_POSITIONS);
    if (!raw) return seed;
    const data: SavedPosition[] = JSON.parse(raw);
    if (!data.length) return [];
    return data.map((d) => ({
      ...d,
      broker: d.broker ?? "",
      color: d.type === "Кэш" ? d.color : autoColor(d.ticker),
      currentPrice: d.avgPrice,
      previousClose: d.avgPrice,
      value: 0, pnl: 0, pnlPct: 0, share: 0,
      live: d.type !== "Кэш",
    }));
  } catch { return seed; }
}

export function fmtDate(iso: string): string {
  const [, m, day] = iso.split("-");
  return `${day}.${m}`;
}

const COMMODITY_TICKERS = new Set([
  "GLD", "IAU", "SGOL", "GDX", "GDXJ",
  "SLV", "PSLV", "SI",
  "USO", "BNO", "UCO", "SCO",
  "UNG", "BOIL", "KOLD",
  "DBA", "CORN", "WEAT", "SOYB", "CANE", "COW",
  "PDBC", "COMT", "DJP", "GSG", "DBC",
  "CPER", "COPX", "PALL", "PPLT",
]);

const BOND_TICKERS = new Set([
  "BND", "AGG", "BNDX", "TLT", "IEF", "SHY", "VGSH", "VCSH",
  "LQD", "HYG", "JNK", "VCIT", "USHY", "BKLN", "EMB", "PCY",
  "MUB", "VTEB", "SUB", "TIP", "STIP", "SCHP",
]);

export function detectInstrumentType(finnhubType: string, symbol: string): string {
  if (finnhubType === "Крипто") return "Крипто";
  const upper = symbol.toUpperCase();
  if (COMMODITY_TICKERS.has(upper)) return "Сырьё";
  if (BOND_TICKERS.has(upper)) return "Облигация";
  if (finnhubType === "ETF" || finnhubType === "ETP") return "ETF";
  if (finnhubType === "Common Stock") return "Акция";
  return "ETF";
}

export function chartCutoff(p: string): string {
  const d = new Date();
  if (p === "7Д")  d.setDate(d.getDate() - 7);
  else if (p === "1М")  d.setMonth(d.getMonth() - 1);
  else if (p === "3М")  d.setMonth(d.getMonth() - 3);
  else if (p === "6М")  d.setMonth(d.getMonth() - 6);
  else if (p === "YTD") d.setMonth(0, 1);
  else if (p === "1Г")  d.setFullYear(d.getFullYear() - 1);
  else return "0000-00-00";
  return d.toISOString().slice(0, 10);
}
