import type { LivePosition } from "./types";

export function recompute(list: LivePosition[]): LivePosition[] {
  const total = list.reduce((s, p) => s + p.qty * p.currentPrice, 0);
  return list.map((p) => {
    const value = p.qty * p.currentPrice;
    const cost = p.qty * p.avgPrice;
    const pnl = p.avgPrice > 0 ? Math.round(value - cost) : 0;
    const pnlPct = p.avgPrice > 0 ? ((p.currentPrice - p.avgPrice) / p.avgPrice) * 100 : 0;
    const share = total > 0 ? (value / total) * 100 : 0;
    return { ...p, value: Math.round(value), pnl, pnlPct, share, targetShare: p.targetShare ?? 0 };
  });
}

export function dAgoLabel(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export function periodCutoff(period: string): string {
  const d = new Date();
  if (period === "1Д") d.setDate(d.getDate() - 1);
  else if (period === "7Д") d.setDate(d.getDate() - 7);
  else if (period === "1М") d.setMonth(d.getMonth() - 1);
  else if (period === "3М") d.setMonth(d.getMonth() - 3);
  else if (period === "6М") d.setMonth(d.getMonth() - 6);
  else if (period === "YTD") d.setMonth(0, 1);
  else if (period === "1Г") d.setFullYear(d.getFullYear() - 1);
  else return "0000-00-00";
  return d.toISOString().slice(0, 10);
}

export function fmtDate(iso: string): string {
  const [, m, day] = iso.split("-");
  return `${day}.${m}`;
}
