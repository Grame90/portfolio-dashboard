import { LS_DIVIDENDS } from "./constants";
import type { ReceivedDividend } from "./types";

export function periodCutoff(period: string): string {
  const d = new Date();
  if (period === "7Д")  d.setDate(d.getDate() - 7);
  else if (period === "1М")  d.setMonth(d.getMonth() - 1);
  else if (period === "3М")  d.setMonth(d.getMonth() - 3);
  else if (period === "6М")  d.setMonth(d.getMonth() - 6);
  else if (period === "YTD") d.setMonth(0, 1);
  else if (period === "1Г")  d.setFullYear(d.getFullYear() - 1);
  else return "0000-00-00";
  return d.toISOString().slice(0, 10);
}

export function formatDate(iso: string): string {
  const [, m, day] = iso.split("-");
  return `${day}.${m}`;
}

export function loadDividends(): ReceivedDividend[] {
  try {
    const r = localStorage.getItem(LS_DIVIDENDS);
    return r ? JSON.parse(r) : [];
  } catch {
    return [];
  }
}

export function saveDividends(list: ReceivedDividend[]): void {
  try {
    localStorage.setItem(LS_DIVIDENDS, JSON.stringify(list));
  } catch {}
}
