"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import { useMobile } from "@/lib/useMobile";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  positions as initialPositions,
  portfolioHistory1M, portfolioHistory3M, portfolioHistoryYTD, portfolioHistory1Y,
} from "@/lib/mockData";

const tabs = ["ВСЕ ПОЗИЦИИ", "АКЦИИ", "ETF", "СЫРЬЁ", "КРИПТО", "КЭШ"];
const periodOptions = ["1Д", "7Д", "1М", "3М", "6М", "YTD", "1Г", "ВСЕ"];
const chartDataMap: Record<string, typeof portfolioHistory1M> = {
  "1М": portfolioHistory1M, "3М": portfolioHistory3M, "YTD": portfolioHistoryYTD,
  "1Г": portfolioHistory1Y, "1Д": portfolioHistory1M.slice(-5),
  "7Д": portfolioHistory1M.slice(-7), "6М": portfolioHistoryYTD, "ВСЕ": portfolioHistory1Y,
};
const COLORS = ["#7c3aed","#9d6ef5","#3b82f6","#06b6d4","#f59e0b","#94a3b8","#ef4444","#ec4899","#22c55e","#84cc16","#f97316","#a855f7"];

function autoColor(ticker: string): string {
  let h = 0;
  for (let i = 0; i < ticker.length; i++) h = (h * 31 + ticker.charCodeAt(i)) & 0xffffffff;
  return COLORS[Math.abs(h) % COLORS.length];
}
const TYPES = ["ETF", "Акция", "Крипто", "Сырьё", "Облигация", "Кэш"];

const CASH_CURRENCIES = [
  { code: "USD",  name: "Доллар США",           flag: "🇺🇸", color: "#22c55e", defaultRate: 1 },
  { code: "EUR",  name: "Евро",                  flag: "🇪🇺", color: "#3b82f6", defaultRate: 1.08 },
  { code: "GBP",  name: "Фунт стерлингов",       flag: "🇬🇧", color: "#8b5cf6", defaultRate: 1.27 },
  { code: "CHF",  name: "Швейцарский франк",     flag: "🇨🇭", color: "#06b6d4", defaultRate: 1.11 },
  { code: "CAD",  name: "Канадский доллар",      flag: "🇨🇦", color: "#84cc16", defaultRate: 0.73 },
  { code: "AED",  name: "Дирхам ОАЭ",            flag: "🇦🇪", color: "#f97316", defaultRate: 0.272 },
  { code: "CNY",  name: "Китайский юань",        flag: "🇨🇳", color: "#ec4899", defaultRate: 0.138 },
  { code: "JPY",  name: "Японская иена",         flag: "🇯🇵", color: "#94a3b8", defaultRate: 0.0067 },
  { code: "TRY",  name: "Турецкая лира",         flag: "🇹🇷", color: "#ef4444", defaultRate: 0.028 },
  { code: "RUB",  name: "Российский рубль",      flag: "🇷🇺", color: "#f59e0b", defaultRate: 0.011 },
  { code: "AZN",  name: "Азербайджанский манат", flag: "🇦🇿", color: "#06b6d4", defaultRate: 0.588 },
  { code: "GEL",  name: "Грузинский лари",       flag: "🇬🇪", color: "#84cc16", defaultRate: 0.364 },
  { code: "USDT", name: "Tether (стейблкоин)",   flag: "💵",  color: "#22c55e", defaultRate: 1 },
];
const TICKER_BETA: Record<string, number> = {
  VOO: 1.00, QQQ: 1.12, SMH: 1.35, SOXX: 1.30, GLD: -0.08,
  SLV: 0.12, "BRK.B": 0.82, TSLA: 1.85, IBKR: 1.10,
};
const TODAY_MS = new Date().getTime();
const LS_POSITIONS = "positions-data";

type SavedPosition = Pick<Position, "id"|"ticker"|"name"|"type"|"qty"|"avgPrice"|"color"|"purchaseDate"|"action">;

function persistPositions(list: Position[]) {
  try {
    const data: SavedPosition[] = list.map(({ id, ticker, name, type, qty, avgPrice, color, purchaseDate, action }) =>
      ({ id, ticker, name, type, qty, avgPrice, color, purchaseDate, action })
    );
    localStorage.setItem(LS_POSITIONS, JSON.stringify(data));
    try { window.dispatchEvent(new CustomEvent("positions-updated")); } catch {}
  } catch {}
}

function loadPositions(): Position[] {
  try {
    const raw = localStorage.getItem(LS_POSITIONS);
    if (!raw) return seed;
    const data: SavedPosition[] = JSON.parse(raw);
    if (!data.length) return [];
    return recompute(data.map((d) => ({
      ...d,
      color: d.type === "Кэш" ? d.color : autoColor(d.ticker),
      currentPrice: d.avgPrice,
      previousClose: d.avgPrice,
      value: 0, pnl: 0, pnlPct: 0, share: 0,
      live: d.type !== "Кэш",
    })));
  } catch { return seed; }
}

type Position = {
  id: number;
  ticker: string;
  name: string;
  type: string;
  qty: number;
  avgPrice: number;
  currentPrice: number;
  previousClose: number;
  color: string;
  value: number;
  pnl: number;
  pnlPct: number;
  share: number;
  action: string;
  live: boolean;
  purchaseDate: string;
};

function recompute(positions: Position[]): Position[] {
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

const purchaseDates: Record<number, string> = {
  1: "2023-02-14", 2: "2023-01-09", 3: "2022-11-21",
  4: "2023-04-03", 5: "2022-10-17", 6: "2022-09-05",
  7: "2023-03-28", 8: "2023-07-12", 9: "2022-12-01", 10: "",
};

const seed: Position[] = recompute(
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
    purchaseDate: purchaseDates[p.id] ?? "",
  }))
);

const TODAY = new Date().toISOString().slice(0, 10);
const emptyForm = { ticker: "", name: "", type: "ETF", qty: "", avgPrice: "", currentPrice: "", previousClose: "", color: COLORS[0], purchaseDate: TODAY };

export default function PositionsPage() {
  const isMobile = useMobile();
  const [positions, setPositions] = useState<Position[]>([]);
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [activeTab, setActiveTab] = useState("ВСЕ ПОЗИЦИИ");

  // Ticker search autocomplete
  const [searchResults, setSearchResults] = useState<{ symbol: string; description: string; type: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownIdx, setDropdownIdx] = useState(-1);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [period, setPeriod] = useState("1М");
  const [chartHistory, setChartHistory] = useState<{date:string;value:number;cost:number}[]>([]);
  const lastSavedChart = useRef(0);
  const [profitMode, setProfitMode] = useState<"USD" | "%">("USD");
  const [showForm, setShowForm] = useState(false);
  const [showCashForm, setShowCashForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [cashCurrency, setCashCurrency] = useState("USD");
  const [cashRate, setCashRate] = useState("1");
  const [lastTick, setLastTick] = useState<Record<number, "up" | "down" | null>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<Position | null>(null);
  const [takeProfitTarget, setTakeProfitTarget] = useState<Position | null>(null);
  const [takeProfitPct, setTakeProfitPct] = useState(100);
  const [takeProfitQtyStr, setTakeProfitQtyStr] = useState("");
  const [takeProfitAmtStr, setTakeProfitAmtStr] = useState("");
  const [editTarget, setEditTarget] = useState<Position | null>(null);
  const [editForm, setEditForm] = useState<typeof emptyForm & { purchaseDate: string }>(emptyForm);
  const [quoteStatus, setQuoteStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  // Fetch real quotes — stocks via Finnhub, crypto via CoinGecko
  const fetchQuotes = useCallback(async (current: Position[]) => {
    const stockPositions = current.filter((p) => p.live && p.type !== "Крипто");
    const cryptoPositions = current.filter((p) => p.live && p.type === "Крипто");
    if (stockPositions.length === 0 && cryptoPositions.length === 0) return;

    setQuoteStatus("loading");
    try {
      const allData: Record<string, { current: number; previousClose: number }> = {};

      if (stockPositions.length > 0) {
        const tickers = stockPositions.map((p) => p.ticker);
        const res = await fetch(`/api/quotes?tickers=${tickers.join(",")}`);
        if (res.ok) Object.assign(allData, await res.json());
      }

      if (cryptoPositions.length > 0) {
        const tickers = cryptoPositions.map((p) => p.ticker);
        const res = await fetch(`/api/crypto?tickers=${tickers.join(",")}`);
        if (res.ok) Object.assign(allData, await res.json());
      }

      setPositions((prev) =>
        recompute(
          prev.map((p) => {
            const q = allData[p.ticker];
            if (!q || q.current <= 0) return p;
            const direction = q.current > p.currentPrice ? "up" : q.current < p.currentPrice ? "down" : null;
            setLastTick((lt) => ({ ...lt, [p.id]: direction }));
            return { ...p, currentPrice: q.current, previousClose: q.previousClose };
          })
        )
      );
      setQuoteStatus("ok");
    } catch {
      setQuoteStatus("error");
    }
  }, []);

  // Load from localStorage on mount, then fetch quotes
  useEffect(() => {
    try { const r = localStorage.getItem("portfolio-chart-history"); if (r) setChartHistory(JSON.parse(r)); } catch {}
  }, []);

  useEffect(() => {
    if (!deleteConfirm) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") { e.preventDefault(); deletePosition(deleteConfirm!.id); }
      if (e.key === "Escape") setDeleteConfirm(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteConfirm]);

  useEffect(() => {
    const initial = loadPositions();
    setPositions(initial);
    fetchQuotes(initial);
    const id = setInterval(() => {
      setPositions((prev) => { fetchQuotes(prev); return prev; });
    }, 30000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchQuotes]);

  // Local simulation between real fetches — tick every 3 seconds
  useEffect(() => {
    const id = setInterval(() => {
      setPositions((prev) => {
        const changes: Record<number, "up" | "down" | null> = {};
        const updated = prev.map((p) => {
          if (!p.live || p.currentPrice === 0) { changes[p.id] = null; return p; }
          const delta = p.currentPrice * (Math.random() * 0.003 - 0.0015);
          const newPrice = Math.max(0.01, p.currentPrice + delta);
          changes[p.id] = delta > 0 ? "up" : "down";
          return { ...p, currentPrice: Math.round(newPrice * 100) / 100 };
        });
        setLastTick(changes);
        return recompute(updated);
      });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const total = positions.reduce((s, p) => s + p.value, 0);
  const totalCost = positions.reduce((s, p) => s + p.qty * p.avgPrice, 0);
  const totalPnl = Math.round(total - totalCost);
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const filtered = positions.filter((p) => {
    if (activeTab === "АКЦИИ") return p.type === "Акция";
    if (activeTab === "ETF") return p.type === "ETF";
    if (activeTab === "КЭШ") return p.type === "Кэш";
    if (activeTab === "СЫРЬЁ") return p.type === "Сырьё";
    if (activeTab === "КРИПТО") return p.type === "Крипто";
    return true;
  });

  const bestPos = [...positions].sort((a, b) => b.pnlPct - a.pnlPct)[0];
  const worstPos = [...positions].sort((a, b) => a.pnlPct - b.pnlPct)[0];
  const byValue = [...positions].sort((a, b) => b.value - a.value).slice(0, 5);
  // Auto-save chart history
  const totalForChart = positions.reduce((s, p) => s + p.value, 0);
  const costForChart  = positions.reduce((s, p) => s + p.qty * p.avgPrice, 0);
  useEffect(() => {
    if (totalForChart <= 0 || Math.abs(totalForChart - lastSavedChart.current) < 1) return;
    lastSavedChart.current = totalForChart;
    const today = new Date().toISOString().slice(0, 10);
    setChartHistory(prev => {
      const next = [...prev];
      const idx = next.findIndex(p => p.date === today);
      const pt = { date: today, value: Math.round(totalForChart), cost: Math.round(costForChart) };
      if (idx >= 0) next[idx] = pt; else next.push(pt);
      next.sort((a, b) => a.date.localeCompare(b.date));
      if (next.length > 730) next.splice(0, next.length - 730);
      try { localStorage.setItem("portfolio-chart-history", JSON.stringify(next)); } catch {}
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalForChart]);

  function chartCutoff(p: string): string {
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
  function fmtDate(iso: string) {
    const [,m,day] = iso.split("-");
    return `${day}.${m}`;
  }

  const chartData = useMemo(() => {
    if (totalForChart <= 0) return [];
    const cutoff = chartCutoff(period);
    const today = new Date().toISOString().slice(0, 10);
    const filtered = chartHistory.filter(p => p.date >= cutoff);
    const pts = filtered.map(p => ({ date: fmtDate(p.date), value: p.value, cost: p.cost }));
    // Always include live today value
    if (filtered[filtered.length - 1]?.date !== today)
      pts.push({ date: fmtDate(today), value: Math.round(totalForChart), cost: Math.round(costForChart) });
    // Need at least 2 points — synthesize a start-of-period point at cost basis
    if (pts.length < 2) {
      const startIso = cutoff === "0000-00-00"
        ? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
        : cutoff;
      pts.unshift({ date: fmtDate(startIso), value: Math.round(costForChart), cost: Math.round(costForChart) });
    }
    return pts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartHistory, period, totalForChart]);

  const allChartData = useMemo(() => {
    if (totalForChart <= 0) return [];
    const today = new Date().toISOString().slice(0, 10);
    const pts = chartHistory.map(p => ({ date: fmtDate(p.date), value: p.value, cost: p.cost }));
    if (chartHistory[chartHistory.length - 1]?.date !== today)
      pts.push({ date: fmtDate(today), value: Math.round(totalForChart), cost: Math.round(costForChart) });
    // Need at least 2 points — synthesize a start point 30 days back at cost basis
    if (pts.length < 2) {
      const startIso = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      pts.unshift({ date: fmtDate(startIso), value: Math.round(costForChart), cost: Math.round(costForChart) });
    }
    return pts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartHistory, totalForChart]);

  // #3 — Дневное изменение (currentPrice vs previousClose)
  const dailyChange = Math.round(
    positions.reduce((s, p) => {
      if (p.previousClose <= 0) return s;
      return s + p.qty * (p.currentPrice - p.previousClose);
    }, 0)
  );
  const prevTotal = positions.reduce((s, p) => s + p.qty * (p.previousClose > 0 ? p.previousClose : p.currentPrice), 0);
  const dailyChangePct = prevTotal > 0 ? (dailyChange / prevTotal) * 100 : 0;

  // #4 — Средняя доходность позиций (non-cash with avgPrice > 0)
  const tradeable = positions.filter((p) => p.avgPrice > 0 && p.type !== "Кэш");
  const avgReturn = tradeable.length > 0
    ? tradeable.reduce((s, p) => s + p.pnlPct, 0) / tradeable.length
    : 0;

  // #5 — Концентрация (крупнейшая позиция)
  const topPos = [...positions].sort((a, b) => b.share - a.share)[0];

  // #6 — Прибыльных позиций
  const profitableCount = positions.filter((p) => p.pnl > 0).length;
  const nonCashCount = positions.filter((p) => p.type !== "Кэш").length;

  // #7 — Типов активов
  const uniqueTypes = new Set(positions.map((p) => p.type)).size;

  // #8 — Бета портфеля (взвешенная)
  const portfolioBeta = positions
    .filter((p) => p.type !== "Кэш" && p.share > 0)
    .reduce((s, p) => s + (TICKER_BETA[p.ticker] ?? 1.0) * (p.share / 100), 0);

  // #9 — Средний срок владения
  const posWithDate = positions.filter((p) => p.purchaseDate);
  const avgHoldingDays = posWithDate.length > 0
    ? Math.round(
        posWithDate.reduce((s, p) => {
          return s + Math.round((TODAY_MS - new Date(p.purchaseDate).getTime()) / 86400000);
        }, 0) / posWithDate.length
      )
    : 0;

  // #10 — Старейшая позиция
  const oldestPos = [...positions]
    .filter((p) => p.purchaseDate)
    .sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime())[0];
  const oldestDays = oldestPos
    ? Math.round((TODAY_MS - new Date(oldestPos.purchaseDate).getTime()) / 86400000)
    : 0;

  function deletePosition(id: number) {
    setPositions((prev) => {
      const next = recompute(prev.filter((p) => p.id !== id));
      persistPositions(next);
      return next;
    });
    setDeleteConfirm(null);
  }

  function confirmTakeProfit() {
    if (!takeProfitTarget) return;
    const pos = takeProfitTarget;
    const pct = Math.max(1, Math.min(100, takeProfitPct));
    const qtyToSell = pos.qty * (pct / 100);
    const proceeds = qtyToSell * pos.currentPrice;

    setPositions(prev => {
      const hasUsdCash = prev.some(p => p.ticker === "КЭШ (USD)");
      let next = prev
        .map(p => {
          if (p.id === pos.id) {
            const newQty = pos.qty - qtyToSell;
            if (newQty < 0.001) return null;
            return { ...p, qty: parseFloat(newQty.toFixed(6)) };
          }
          if (p.ticker === "КЭШ (USD)") {
            return { ...p, qty: parseFloat((p.qty + proceeds).toFixed(2)), avgPrice: 1, currentPrice: 1 };
          }
          return p;
        })
        .filter(Boolean) as Position[];

      if (!hasUsdCash) {
        next.push({
          id: Date.now(),
          ticker: "КЭШ (USD)",
          name: "🇺🇸 Доллар США",
          type: "Кэш",
          qty: parseFloat(proceeds.toFixed(2)),
          avgPrice: 1,
          currentPrice: 1,
          previousClose: 1,
          color: "#22c55e",
          value: Math.round(proceeds),
          pnl: 0, pnlPct: 0, share: 0,
          action: "Удерживать",
          live: false,
          purchaseDate: new Date().toISOString().slice(0, 10),
        });
      }

      const result = recompute(next);
      persistPositions(result);
      return result;
    });

    setTakeProfitTarget(null);
    setTakeProfitPct(100);
  }

  function addPosition() {
    setFormError("");
    const isCash = showCashForm;

    if (isCash) {
      if (!form.qty || Number(form.qty) <= 0) { setFormError("Введите сумму > 0"); return; }
      const cur = CASH_CURRENCIES.find(c => c.code === cashCurrency) ?? CASH_CURRENCIES[0];
      const rate = Math.max(0.000001, Number(cashRate) || 1);
      const ticker = `КЭШ (${cur.code})`;

      setPositions(prev => {
        const existing = prev.find(p => p.ticker === ticker);
        let next: Position[];
        if (existing) {
          next = prev.map(p => p.ticker === ticker
            ? { ...p, qty: parseFloat((p.qty + Number(form.qty)).toFixed(6)) }
            : p
          );
        } else {
          next = [...prev, {
            id: Date.now(),
            ticker,
            name: `${cur.flag} ${cur.name}`,
            type: "Кэш",
            qty: Number(form.qty),
            avgPrice: rate,
            currentPrice: rate,
            previousClose: rate,
            color: cur.color,
            value: 0, pnl: 0, pnlPct: 0, share: 0,
            action: "Удерживать",
            live: false,
            purchaseDate: form.purchaseDate || new Date().toISOString().slice(0, 10),
          }];
        }
        const result = recompute(next);
        persistPositions(result);
        return result;
      });
      setForm(emptyForm);
      setCashCurrency("USD");
      setCashRate("1");
      setShowCashForm(false);
      return;
    }

    if (!form.ticker.trim()) { setFormError("Введите тикер"); return; }
    if (!form.qty || Number(form.qty) <= 0) { setFormError("Введите количество > 0"); return; }
    if (!form.avgPrice || Number(form.avgPrice) <= 0) { setFormError("Введите среднюю цену > 0"); return; }

    const newPos: Position = {
      id: Date.now(),
      ticker: form.ticker.trim().toUpperCase(),
      name: form.name.trim() || form.ticker.trim().toUpperCase(),
      type: form.type,
      qty: Number(form.qty),
      avgPrice: Number(form.avgPrice),
      currentPrice: Number(form.avgPrice),
      previousClose: Number(form.avgPrice),
      color: autoColor(form.ticker.trim().toUpperCase()),
      value: 0, pnl: 0, pnlPct: 0, share: 0,
      action: "Удерживать",
      live: true,
      purchaseDate: form.purchaseDate,
    };
    setPositions((prev) => {
      const next = recompute([...prev, newPos]);
      persistPositions(next);
      return next;
    });
    setForm(emptyForm);
    setShowForm(false);
  }

  function openEdit(p: Position) {
    setEditTarget(p);
    setEditForm({
      ticker: p.ticker,
      name: p.name,
      type: p.type,
      qty: String(p.qty),
      avgPrice: String(p.avgPrice),
      currentPrice: String(p.currentPrice),
      previousClose: String(p.previousClose),
      color: p.color,
      purchaseDate: p.purchaseDate,
    });
  }

  function saveEdit() {
    if (!editTarget) return;
    setPositions((prev) => {
      const next = recompute(
        prev.map((p) =>
          p.id !== editTarget.id ? p : {
            ...p,
            ticker: editForm.ticker.trim().toUpperCase() || p.ticker,
            name: editForm.name.trim() || p.name,
            type: editForm.type,
            qty: Number(editForm.qty) > 0 ? Number(editForm.qty) : p.qty,
            avgPrice: Number(editForm.avgPrice) > 0 ? Number(editForm.avgPrice) : p.avgPrice,
            currentPrice: Number(editForm.currentPrice) > 0 ? Number(editForm.currentPrice) : p.currentPrice,
            previousClose: Number((editForm as any).previousClose) > 0 ? Number((editForm as any).previousClose) : p.previousClose,
            color: p.type === "Кэш" ? p.color : autoColor(editForm.ticker.trim().toUpperCase() || p.ticker),
            purchaseDate: editForm.purchaseDate,
            live: editForm.type !== "Кэш",
          }
        )
      );
      persistPositions(next);
      return next;
    });
    setEditTarget(null);
  }

  function commitNameEdit(id: number) {
    const name = editingNameValue.trim();
    if (!name) { setEditingNameId(null); return; }
    setPositions((prev) => {
      const next = recompute(prev.map((p) => p.id === id ? { ...p, name } : p));
      persistPositions(next);
      return next;
    });
    setEditingNameId(null);
  }

  const priceColor = (id: number) => {
    const t = lastTick[id];
    if (t === "up") return "#22c55e";
    if (t === "down") return "#ef4444";
    return "var(--text-primary)";
  };

  function handleTickerInput(value: string) {
    setForm((f) => ({ ...f, ticker: value }));
    setDropdownIdx(-1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!value.trim()) { setSearchResults([]); setDropdownOpen(false); return; }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const q = encodeURIComponent(value.trim());
        // Search both sources in parallel — always
        const [stockRes, cryptoRes] = await Promise.allSettled([
          fetch(`/api/search?q=${q}`),
          fetch(`/api/search?q=${q}&type=crypto`),
        ]);
        const stocks = stockRes.status === "fulfilled" && stockRes.value.ok
          ? await stockRes.value.json() : [];
        const crypto = cryptoRes.status === "fulfilled" && cryptoRes.value.ok
          ? await cryptoRes.value.json() : [];

        // Merge: stocks first, then crypto; deduplicate by symbol
        const seen = new Set<string>();
        const merged = [...stocks, ...crypto].filter(item => {
          if (seen.has(item.symbol)) return false;
          seen.add(item.symbol);
          return true;
        }).slice(0, 10);

        setSearchResults(merged);
        setDropdownOpen(merged.length > 0);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 280);
  }

  function detectInstrumentType(finnhubType: string, symbol: string): string {
    // Crypto from CoinGecko already comes as "Крипто"
    if (finnhubType === "Крипто") return "Крипто";

    // Known commodity tickers
    const COMMODITY_TICKERS = new Set([
      "GLD","IAU","SGOL","GDX","GDXJ",
      "SLV","PSLV","SI",
      "USO","BNO","UCO","SCO",
      "UNG","BOIL","KOLD",
      "DBA","CORN","WEAT","SOYB","CANE","COW",
      "PDBC","COMT","DJP","GSG","DBC",
      "CPER","COPX","PALL","PPLT",
    ]);
    if (COMMODITY_TICKERS.has(symbol.toUpperCase())) return "Сырьё";

    // Known bond ETF tickers
    const BOND_TICKERS = new Set([
      "BND","AGG","BNDX","TLT","IEF","SHY","VGSH","VCSH",
      "LQD","HYG","JNK","VCIT","USHY","BKLN","EMB","PCY",
      "MUB","VTEB","SUB","TIP","STIP","SCHP",
    ]);
    if (BOND_TICKERS.has(symbol.toUpperCase())) return "Облигация";

    // Finnhub types
    if (finnhubType === "ETF" || finnhubType === "ETP") return "ETF";
    if (finnhubType === "Common Stock") return "Акция";

    return "ETF"; // safe fallback
  }

  function selectSearchResult(item: { symbol: string; description: string; type: string }) {
    const detectedType = detectInstrumentType(item.type, item.symbol);
    setForm((f) => ({ ...f, ticker: item.symbol, name: item.description, type: detectedType }));
    setDropdownOpen(false);
    setSearchResults([]);
  }

  // Portfolio total value history from first purchase date to today
  const portfolioSinceInception = useMemo(() => {
    const END = new Date("2024-05-21");
    const tracked = positions.filter(
      (p) => p.purchaseDate && p.avgPrice > 0 && p.type !== "Кэш",
    );
    // cash always contributes its fixed value
    const cashValue = positions
      .filter((p) => p.type === "Кэш")
      .reduce((s, p) => s + p.value, 0);

    if (tracked.length === 0) return [];

    const earliest = new Date(
      Math.min(...tracked.map((p) => new Date(p.purchaseDate).getTime())),
    );
    const totalDays = Math.round((END.getTime() - earliest.getTime()) / 86400000);
    const step = Math.max(1, Math.floor(totalDays / 80));

    const data: { date: string; value: number; invested: number }[] = [];

    for (let i = 0; i <= totalDays; i += step) {
      const cur = new Date(earliest);
      cur.setDate(cur.getDate() + i);

      let portfolioValue = 0;
      let investedValue = 0;

      tracked.forEach((p) => {
        const buyMs = new Date(p.purchaseDate).getTime();
        const dFromBuy = Math.round((cur.getTime() - buyMs) / 86400000);
        if (dFromBuy < 0) return; // not yet purchased

        const dTotal = Math.round((END.getTime() - buyMs) / 86400000);
        const prog = dTotal > 0 ? dFromBuy / dTotal : 1;
        const trend = p.avgPrice + (p.currentPrice - p.avgPrice) * prog;
        const amp = Math.abs(p.currentPrice - p.avgPrice) * 0.12 + p.avgPrice * 0.015;
        const noise =
          Math.sin(dFromBuy * 0.37 + p.id * 0.9) * amp +
          Math.sin(dFromBuy * 0.81 + p.id * 1.6) * amp * 0.35;
        const price = Math.max(p.avgPrice * 0.5, trend + noise);

        portfolioValue += p.qty * price;
        investedValue += p.qty * p.avgPrice;
      });

      data.push({
        date: cur.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }),
        value: Math.round(portfolioValue + cashValue),
        invested: Math.round(investedValue + cashValue),
      });
    }
    return data;
  }, [positions]);

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader title="ПОЗИЦИИ" subtitle="Детализация всех активов портфеля" showSnapshot />

      <div style={{ padding: isMobile ? "12px" : "16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Summary metrics — compact top bar, 8 cols × 2 rows */}
        {(() => {
          const metrics = [
            { label: "Позиций",         value: positions.length.toString(),                                                                  sub: `${nonCashCount} инстр.` },
            { label: "Стоимость",       value: `$${Math.round(total).toLocaleString("en-US")}`,                                              sub: "USD" },
            { label: "Вложено",         value: `$${Math.round(totalCost).toLocaleString("en-US")}`,                                          sub: "cost basis" },
            { label: "P&L",             value: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toLocaleString("en-US")}`,                            sub: `${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}%`,               color: totalPnl >= 0 ? "#22c55e" : "#ef4444" },
            { label: "За день",         value: `${dailyChange >= 0 ? "+" : ""}$${dailyChange.toLocaleString("en-US")}`,                      sub: `${dailyChangePct >= 0 ? "+" : ""}${dailyChangePct.toFixed(3)}%`,         color: dailyChange >= 0 ? "#22c55e" : "#ef4444" },
            { label: "Ср. доходность",  value: `${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(2)}%`,                                       sub: `по ${tradeable.length} позициям`,                                        color: avgReturn >= 0 ? "#22c55e" : "#ef4444" },
            { label: "Лучшая",          value: bestPos?.ticker ?? "–",                                                                       sub: bestPos ? `${bestPos.pnlPct >= 0 ? "+" : ""}${bestPos.pnlPct.toFixed(2)}%` : "", color: "#22c55e" },
            { label: "Худшая",          value: worstPos?.ticker ?? "–",                                                                      sub: worstPos ? `${worstPos.pnlPct.toFixed(2)}%` : "",                         color: "#ef4444" },
            { label: "Концентрация",    value: topPos ? `${topPos.share.toFixed(1)}%` : "–",                                                 sub: topPos ? topPos.ticker : "",                                              color: topPos && topPos.share > 30 ? "#f59e0b" : undefined },
            { label: "Прибыльных",      value: `${profitableCount}/${nonCashCount}`,                                                         sub: `${nonCashCount > 0 ? ((profitableCount / nonCashCount) * 100).toFixed(0) : 0}% в плюсе`, color: profitableCount > nonCashCount / 2 ? "#22c55e" : "#ef4444" },
            { label: "Типов активов",   value: uniqueTypes.toString(),                                                                       sub: [...new Set(positions.map(p => p.type))].join(" · ") },
            { label: "Бета",            value: portfolioBeta.toFixed(2),                                                                     sub: portfolioBeta < 0.8 ? "консерв." : portfolioBeta < 1.2 ? "умеренный" : "агрессив.", color: portfolioBeta < 0.8 ? "#22c55e" : portfolioBeta < 1.2 ? "#f59e0b" : "#ef4444" },
            { label: "Ср. владение",    value: avgHoldingDays > 0 ? `${avgHoldingDays} дн.` : "–",                                          sub: avgHoldingDays > 0 ? `${(avgHoldingDays / 30).toFixed(1)} мес.` : "нет дат" },
            { label: "Старейшая",       value: oldestPos?.ticker ?? "–",                                                                     sub: oldestDays > 0 ? `${oldestDays} дн.` : "нет даты",                       color: "var(--accent-light)" },
            { label: "Доля акций",      value: `${positions.filter(p => p.type === "Акция").reduce((s, p) => s + p.share, 0).toFixed(1)}%`,  sub: `${positions.filter(p => p.type === "Акция").length} позиций` },
            { label: "Кэш",             value: `${positions.filter(p => p.type === "Кэш").reduce((s, p) => s + p.share, 0).toFixed(1)}%`,   sub: `$${positions.filter(p => p.type === "Кэш").reduce((s, p) => s + p.value, 0).toLocaleString("en-US")}` },
          ];
          return (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(8, 1fr)", gap: 6 }}>
              {metrics.map((m) => (
                <div key={m.label} className="card" style={{ padding: "8px 10px" }}>
                  <div style={{ fontSize: 9, color: "var(--text-secondary)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: (m as any).color ?? "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.value}</div>
                  <div style={{ fontSize: 10, color: (m as any).color ?? "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.sub}</div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Tabs + Add button */}
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? 8 : 0 }}>
          <div style={{ display: "flex", gap: isMobile ? 4 : 8, flexWrap: "wrap" }}>
            {tabs.map((t) => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                padding: isMobile ? "6px 10px" : "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: isMobile ? 11 : 12, fontWeight: 600,
                background: activeTab === t ? "var(--accent)" : "var(--bg-card)",
                color: activeTab === t ? "white" : "var(--text-secondary)", transition: "all 0.15s",
              }}>{t}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setShowForm(!showForm); setShowCashForm(false); setFormError(""); }} style={{
              padding: isMobile ? "6px 12px" : "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: isMobile ? 11 : 12, fontWeight: 600,
              background: showForm ? "var(--bg-card)" : "var(--accent)", color: showForm ? "var(--text-secondary)" : "white",
            }}>
              {showForm ? "✕" : isMobile ? "+ Добавить" : "+ Добавить инструмент"}
            </button>
            <button onClick={() => { setShowCashForm(!showCashForm); setShowForm(false); setFormError(""); setCashCurrency("USD"); setCashRate("1"); }} style={{
              padding: isMobile ? "6px 12px" : "8px 20px", borderRadius: 8, border: `1px solid var(--border)`, cursor: "pointer", fontSize: isMobile ? 11 : 12, fontWeight: 600,
              background: showCashForm ? "var(--bg-card)" : "transparent", color: showCashForm ? "var(--text-secondary)" : "var(--text-secondary)",
            }}>
              {showCashForm ? "✕" : isMobile ? "💰 Кэш" : "💰 Добавить кэш"}
            </button>
          </div>
        </div>

        {/* Add form */}
        {/* ── Instrument form ── */}
        {showForm && (
          <div className="card" style={{ padding: 18 }}>
            <div className="card-title">Новый инструмент</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr 1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 5 }}>
                  Тикер *{searchLoading && <span style={{ marginLeft: 5, color: "var(--accent-light)" }}>…</span>}
                </div>
                <input
                  type="text" value={form.ticker} onChange={(e) => handleTickerInput(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                  onKeyDown={(e) => {
                    if (!dropdownOpen) return;
                    if (e.key === "ArrowDown") { e.preventDefault(); setDropdownIdx((i) => Math.min(i + 1, searchResults.length - 1)); }
                    if (e.key === "ArrowUp")   { e.preventDefault(); setDropdownIdx((i) => Math.max(i - 1, 0)); }
                    if (e.key === "Enter" && dropdownIdx >= 0) { e.preventDefault(); selectSearchResult(searchResults[dropdownIdx]); }
                    if (e.key === "Escape")    { setDropdownOpen(false); }
                  }}
                  placeholder="AAPL" autoComplete="off"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${dropdownOpen ? "var(--accent)" : "var(--border)"}`, background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12, boxSizing: "border-box" }}
                />
                {dropdownOpen && searchResults.length > 0 && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 500, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                    {searchResults.map((item, idx) => (
                      <div key={item.symbol} onMouseDown={() => selectSearchResult(item)}
                        style={{ padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, background: idx === dropdownIdx ? "rgba(124,58,237,0.12)" : "transparent", borderBottom: idx < searchResults.length - 1 ? "1px solid var(--border)" : "none" }}
                        onMouseEnter={() => setDropdownIdx(idx)}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: "var(--accent-light)", minWidth: 52 }}>{item.symbol}</span>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</span>
                        <span style={{ marginLeft: "auto", fontSize: 9, flexShrink: 0, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "rgba(124,58,237,0.15)", color: "var(--accent-light)" }}>{detectInstrumentType(item.type, item.symbol)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {[
                { label: "Название", key: "name", placeholder: "Apple Inc.", type: "text" },
                { label: "Кол-во *", key: "qty", placeholder: "10", type: "number" },
                { label: "Ср.цена * ($)", key: "avgPrice", placeholder: "150.00", type: "number" },
                { label: "Дата покупки", key: "purchaseDate", placeholder: "", type: "date" },
              ].map((f) => (
                <div key={f.key}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 5 }}>{f.label}</div>
                  <input type={f.type} value={(form as any)[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12, boxSizing: "border-box" }} />
                </div>
              ))}
              <button onClick={addPosition} style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "var(--accent)", color: "white", whiteSpace: "nowrap", alignSelf: "flex-end" }}>
                Добавить
              </button>
            </div>
            {formError && <div style={{ marginTop: 8, fontSize: 12, color: "#ef4444" }}>{formError}</div>}
          </div>
        )}

        {/* ── Cash form ── */}
        {showCashForm && (
          <div className="card" style={{ padding: 18 }}>
            <div className="card-title">Добавить кэш</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 5 }}>Валюта *</div>
                <select value={cashCurrency} onChange={e => {
                  const cur = CASH_CURRENCIES.find(c => c.code === e.target.value);
                  setCashCurrency(e.target.value);
                  setCashRate(String(cur?.defaultRate ?? 1));
                }}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}>
                  {CASH_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 5 }}>Сумма *</div>
                <input type="number" value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })}
                  placeholder="1000" min="0"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12, boxSizing: "border-box" }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 5 }}>
                  Курс к $ {cashCurrency !== "USD" && <span style={{ color: "var(--text-muted)" }}>(средняя цена)</span>}
                </div>
                <input type="number" value={cashRate} onChange={e => setCashRate(e.target.value)}
                  placeholder="1.08" min="0" step="0.0001" disabled={cashCurrency === "USD" || cashCurrency === "USDT"}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: (cashCurrency === "USD" || cashCurrency === "USDT") ? "var(--bg-card)" : "var(--bg-secondary)", color: (cashCurrency === "USD" || cashCurrency === "USDT") ? "var(--text-muted)" : "var(--text-primary)", fontSize: 12, boxSizing: "border-box" }} />
                {cashCurrency !== "USD" && cashCurrency !== "USDT" && (
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
                    ≈ {(Number(form.qty || 0) * Number(cashRate || 1)).toLocaleString("en-US", { maximumFractionDigits: 0 })} USD
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 5 }}>Дата</div>
                <input type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12, boxSizing: "border-box" }} />
              </div>
              <button onClick={addPosition} style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "var(--accent)", color: "white", whiteSpace: "nowrap", alignSelf: "flex-end" }}>
                Добавить
              </button>
            </div>
            {formError && <div style={{ marginTop: 8, fontSize: 12, color: "#ef4444" }}>{formError}</div>}
          </div>
        )}

        {/* Table + Portfolio structure */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 280px", gap: 12 }}>
          <div className="card" style={{ minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="card-title">Текущие позиции</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#22c55e" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "pulse 1.5s infinite" }} />
                  Live цены
                </span>
                <span style={{
                  fontSize: 10, padding: "2px 7px", borderRadius: 20, fontWeight: 600,
                  background: quoteStatus === "ok" ? "rgba(34,197,94,0.12)" : quoteStatus === "error" ? "rgba(239,68,68,0.12)" : "rgba(148,163,184,0.12)",
                  color: quoteStatus === "ok" ? "#22c55e" : quoteStatus === "error" ? "#ef4444" : "#94a3b8",
                }}>
                  {quoteStatus === "ok" ? "Finnhub ✓" : quoteStatus === "loading" ? "Обновление…" : quoteStatus === "error" ? "Ошибка API" : "Finnhub"}
                </span>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                    {["#", "Тикер", "Инструмент", "Тип", "Дата покупки", "Кол-во", "Ср.цена", "Тек.цена", "Стоимость", "Прибыль / Убыток", "Доля", ""].map((h) => (
                      <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.3s" }}>
                      <td style={{ padding: "7px 8px", color: "var(--text-secondary)" }}>{i + 1}</td>
                      <td style={{ padding: "7px 8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 24, height: 24, borderRadius: "50%", background: p.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "white", flexShrink: 0 }}>
                            {p.ticker.slice(0, 2)}
                          </div>
                          <span style={{ fontWeight: 700 }}>{p.ticker}</span>
                        </div>
                      </td>
                      <td
                        style={{ padding: "7px 8px", fontSize: 11, maxWidth: 160 }}
                        title="Двойной клик — переименовать"
                        onDoubleClick={() => { setEditingNameId(p.id); setEditingNameValue(p.name); }}
                      >
                        {editingNameId === p.id ? (
                          <input
                            autoFocus
                            value={editingNameValue}
                            onChange={(e) => setEditingNameValue(e.target.value)}
                            onBlur={() => commitNameEdit(p.id)}
                            onKeyDown={(e) => { if (e.key === "Enter") commitNameEdit(p.id); if (e.key === "Escape") setEditingNameId(null); }}
                            style={{ width: "100%", padding: "2px 6px", borderRadius: 5, border: "1px solid var(--accent)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 11, outline: "none" }}
                          />
                        ) : (
                          <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", cursor: "text" }}>
                            {p.name}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "7px 8px" }}>
                        <span className="badge badge-purple">{p.type}</span>
                      </td>
                      <td style={{ padding: "7px 8px", color: "var(--text-secondary)", fontSize: 11, whiteSpace: "nowrap" }}>
                        {p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–"}
                      </td>
                      <td style={{ padding: "7px 8px" }}>{p.qty > 0 ? p.qty.toFixed(2) : "–"}</td>
                      <td style={{ padding: "7px 8px" }}>{p.avgPrice > 0 ? p.avgPrice.toFixed(2) : "–"}</td>
                      <td style={{ padding: "7px 8px", fontWeight: 700, color: priceColor(p.id), transition: "color 0.5s" }}>
                        {p.currentPrice > 0 ? p.currentPrice.toFixed(2) : "–"}
                        {p.live && lastTick[p.id] === "up" && <span style={{ fontSize: 9, marginLeft: 2 }}>▲</span>}
                        {p.live && lastTick[p.id] === "down" && <span style={{ fontSize: 9, marginLeft: 2 }}>▼</span>}
                      </td>
                      <td style={{ padding: "7px 8px", fontWeight: 700 }}>{p.value.toLocaleString("en-US")}</td>
                      <td style={{ padding: "6px 8px" }}>
                        {p.pnl === 0 ? (
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>
                        ) : (() => {
                          const isPos = p.pnl > 0;
                          const color = isPos ? "#22c55e" : "#ef4444";
                          const bg    = isPos ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)";
                          const border = isPos ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)";
                          return (
                            <div style={{
                              display: "inline-flex", flexDirection: "column",
                              background: bg, border: `1px solid ${border}`,
                              borderRadius: 8, padding: "4px 9px", minWidth: 90,
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ fontSize: 11, color, fontWeight: 700 }}>
                                  {isPos ? "▲" : "▼"}
                                </span>
                                <span style={{ fontSize: 12, color, fontWeight: 700 }}>
                                  {isPos ? "+" : ""}{Math.round(p.pnl).toLocaleString("en-US")} $
                                </span>
                              </div>
                              <div style={{ fontSize: 10, color, opacity: 0.85, paddingLeft: 14 }}>
                                {isPos ? "+" : ""}{p.pnlPct.toFixed(2)}%
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ padding: "7px 8px" }}>{p.share.toFixed(2)}%</td>
                      <td style={{ padding: "7px 8px" }}>
                        <div style={{ display: "flex", gap: 2 }}>
                          {p.type !== "Кэш" && (
                          <button onClick={() => {
                              setTakeProfitTarget(p);
                              setTakeProfitPct(100);
                              setTakeProfitQtyStr(p.qty.toFixed(2));
                              setTakeProfitAmtStr(Math.round(p.qty * p.currentPrice).toString());
                            }} style={{
                              background: p.pnl >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.10)",
                              border: p.pnl >= 0 ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(239,68,68,0.3)",
                              cursor: "pointer", color: p.pnl >= 0 ? "#22c55e" : "#ef4444",
                              fontSize: 10, padding: "2px 6px",
                              borderRadius: 5, fontWeight: 700, whiteSpace: "nowrap",
                            }} title="Зафиксировать позицию">💰</button>
                          )}
                          <button onClick={() => openEdit(p)} style={{
                            background: "none", border: "none", cursor: "pointer", color: "var(--accent-light)", fontSize: 13, padding: "2px 5px",
                            borderRadius: 4, opacity: 0.7,
                          }} title="Редактировать">✎</button>
                          <button onClick={() => setDeleteConfirm(p)} style={{
                            background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 14, padding: "2px 5px",
                            borderRadius: 4, opacity: 0.6,
                          }} title="Удалить позицию">✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={13} style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}>Нет позиций в этой категории</td></tr>
                  )}
                  <tr style={{ fontWeight: 700, background: "var(--bg-secondary)" }}>
                    <td colSpan={8} style={{ padding: "8px", color: "var(--text-secondary)", fontSize: 12 }}>ИТОГО</td>
                    <td style={{ padding: "8px" }}>{Math.round(total).toLocaleString("en-US")}</td>
                    <td style={{ padding: "8px", color: totalPnl >= 0 ? "#22c55e" : "#ef4444" }}>
                      {totalPnl >= 0 ? "+" : ""}{totalPnl.toLocaleString("en-US")}
                    </td>
                    <td style={{ padding: "8px", color: totalPnlPct >= 0 ? "#22c55e" : "#ef4444" }}>
                      {totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%
                    </td>
                    <td style={{ padding: "8px" }}>100.00%</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="card">
              <div className="card-title">Структура портфеля</div>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={positions.map(p => ({ name: p.ticker, value: p.share }))} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={65}>
                    {positions.map((p) => <Cell key={p.id} fill={p.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }} formatter={(v: any) => [`${Number(v).toFixed(2)}%`]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, marginTop: 4, maxHeight: 120, overflowY: "auto" }}>
                {positions.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: p.color, display: "inline-block", flexShrink: 0 }} />
                    <span style={{ color: "var(--text-secondary)" }}>{p.ticker}</span>
                    <span style={{ marginLeft: "auto", fontWeight: 600 }}>{p.share.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-title">Топ по стоимости</div>
              {byValue.map((p, i) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12 }}>
                  <span style={{ color: "var(--text-muted)", width: 14 }}>{i + 1}</span>
                  <span style={{ fontWeight: 700, width: 50 }}>{p.ticker}</span>
                  <div className="progress-bar" style={{ flex: 1 }}>
                    <div className="progress-fill" style={{ width: `${(p.value / byValue[0].value) * 100}%`, background: p.color }} />
                  </div>
                  <span style={{ width: 55, textAlign: "right", fontSize: 11 }}>{p.value.toLocaleString("en-US")}</span>
                  <span style={{ width: 38, textAlign: "right", color: "var(--text-secondary)", fontSize: 11 }}>{p.share.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts row */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Portfolio value — period selector */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div className="card-title" style={{ margin: 0 }}>Динамика портфеля</div>
                <div style={{ display: "flex", gap: 4 }}>
                  {periodOptions.map((p) => (
                    <button key={p} className={`tab-btn ${period === p ? "active" : ""}`} onClick={() => setPeriod(p)} style={{ fontSize: 10, padding: "3px 6px" }}>{p}</button>
                  ))}
                </div>
              </div>
              {(() => {
                const periodDiff = chartData.length >= 2 ? chartData[chartData.length - 1].value - chartData[0].value : 0;
                const periodDiffPct = chartData.length >= 2 && chartData[0].value > 0 ? (periodDiff / chartData[0].value) * 100 : 0;
                return (
                  <div style={{ marginBottom: 6, display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 18, fontWeight: 700 }}>${(chartData[chartData.length - 1]?.value ?? totalForChart).toLocaleString("en-US")}</span>
                    {chartData.length >= 2 && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: periodDiff >= 0 ? "var(--green)" : "var(--red)" }}>
                        {periodDiff >= 0 ? "+" : ""}{periodDiff.toLocaleString("en-US")} ({periodDiff >= 0 ? "+" : ""}{periodDiffPct.toFixed(2)}%)
                      </span>
                    )}
                  </div>
                );
              })()}
              <div style={{ display: "flex", gap: 12, marginBottom: 6, fontSize: 10, color: "var(--text-secondary)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 14, height: 2, background: "var(--accent)", display: "inline-block", borderRadius: 1 }} />Стоимость
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 14, height: 2, background: "var(--yellow)", display: "inline-block", borderRadius: 1, opacity: 0.8 }} />Вложено
                </span>
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={chartData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradPeriod" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} width={32} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
                    formatter={(v: any, name: any) => [`$${Number(v).toLocaleString("en-US")}`, name === "value" ? "Стоимость" : "Вложено"]}
                  />
                  <Area type="monotone" dataKey="cost" stroke="var(--yellow)" strokeWidth={1.5} strokeDasharray="5 3" fill="none" dot={false} />
                  <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#gradPeriod)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* All-time chart */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>Динамика с начала отслеживания</div>
                <div style={{ display: "flex", gap: 12, fontSize: 10, color: "var(--text-secondary)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 14, height: 2, background: "var(--accent)", display: "inline-block", borderRadius: 1 }} />Стоимость
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 14, height: 2, background: "var(--yellow)", display: "inline-block", borderRadius: 1, opacity: 0.8 }} />Вложено
                  </span>
                </div>
              </div>
              {allChartData.length >= 2 && (() => {
                const first = allChartData[0].value;
                const last = allChartData[allChartData.length - 1].value;
                const diff = last - first;
                const pct = first > 0 ? (diff / first) * 100 : 0;
                return (
                  <div style={{ marginBottom: 6, display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>${last.toLocaleString("en-US")}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: diff >= 0 ? "var(--green)" : "var(--red)" }}>
                      {diff >= 0 ? "+" : ""}{diff.toLocaleString("en-US")} ({diff >= 0 ? "+" : ""}{pct.toFixed(2)}%)
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>всё время</span>
                  </div>
                );
              })()}
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={allChartData} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradAllTime" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} width={32} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 }}
                    formatter={(v: any, name: any) => [`$${Number(v).toLocaleString("en-US")}`, name === "value" ? "Стоимость" : "Вложено"]}
                  />
                  <Area type="monotone" dataKey="cost" stroke="var(--yellow)" strokeWidth={1.5} strokeDasharray="5 3" fill="none" dot={false} />
                  <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#gradAllTime)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="card-title" style={{ margin: 0 }}>Прибыль по позициям</div>
              <div style={{ display: "flex", gap: 4 }}>
                {(["USD", "%"] as const).map((m) => (
                  <button key={m} className={`tab-btn ${profitMode === m ? "active" : ""}`} onClick={() => setProfitMode(m)} style={{ fontSize: 11, padding: "4px 10px" }}>{m}</button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(180, positions.length * 22)}>
              <BarChart data={[...positions].sort((a, b) => b.pnlPct - a.pnlPct)} layout="vertical" barSize={10}>
                <XAxis type="number" tick={{ fontSize: 9, fill: "#555577" }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="ticker" tick={{ fontSize: 10, fill: "#aaaacc" }} tickLine={false} axisLine={false} width={45} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }}
                  formatter={(v: any) => [profitMode === "USD" ? `$${Number(v).toLocaleString("en-US")}` : `${Number(v).toFixed(2)}%`]}
                />
                <Bar dataKey={profitMode === "USD" ? "pnl" : "pnlPct"} radius={[0, 4, 4, 0]}>
                  {positions.map((p) => (
                    <Cell key={p.id} fill={(profitMode === "USD" ? p.pnl : p.pnlPct) >= 0 ? "#22c55e" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editTarget && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setEditTarget(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 14, padding: "26px 28px", width: 480,
              boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
              animation: "fadeIn 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%", background: editForm.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "white", flexShrink: 0,
              }}>
                {(editForm.ticker || "??").slice(0, 2)}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Редактировать позицию</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              {[
                { label: "Тикер", key: "ticker", type: "text" },
                { label: "Название", key: "name", type: "text" },
                { label: "Количество", key: "qty", type: "number" },
                { label: "Средняя цена ($)", key: "avgPrice", type: "number" },
                { label: "Текущая цена ($)", key: "currentPrice", type: "number" },
                { label: "Дата покупки", key: "purchaseDate", type: "date" },
              ].map((f) => (
                <div key={f.key}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 5 }}>{f.label}</div>
                  <input
                    type={f.type}
                    value={(editForm as any)[f.key]}
                    onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })}
                    style={{
                      width: "100%", padding: "8px 10px", borderRadius: 8,
                      border: "1px solid var(--border)", background: "var(--bg-secondary)",
                      color: "var(--text-primary)", fontSize: 12, boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8 }}>Тип</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {TYPES.map((t) => (
                  <button key={t} onClick={() => setEditForm({ ...editForm, type: t })} style={{
                    padding: "5px 12px", borderRadius: 20, border: "1px solid var(--border)", cursor: "pointer", fontSize: 11, fontWeight: 600,
                    background: editForm.type === t ? "var(--accent)" : "transparent",
                    color: editForm.type === t ? "white" : "var(--text-secondary)",
                  }}>{t}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setEditTarget(null)} style={{
                flex: 1, padding: "10px", borderRadius: 8, border: "1px solid var(--border)",
                background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
              }}>Отмена</button>
              <button onClick={saveEdit} style={{
                flex: 1, padding: "10px", borderRadius: 8, border: "none",
                background: "var(--accent)", color: "white", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
              }}>Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* Take profit modal */}
      {takeProfitTarget && (() => {
        const p = takeProfitTarget;
        const pct = Math.max(1, Math.min(100, takeProfitPct));
        const qtyToSell = p.qty * (pct / 100);
        const proceeds  = qtyToSell * p.currentPrice;
        const profitPart = proceeds - qtyToSell * p.avgPrice;

        const inputStyle: React.CSSProperties = {
          width: "100%", padding: "7px 10px", borderRadius: 8,
          border: "1px solid var(--border)", background: "var(--bg-secondary)",
          color: "var(--text-primary)", fontSize: 13, outline: "none",
          fontFamily: "inherit", boxSizing: "border-box",
        };

        function syncFromPct(newPct: number) {
          const p2 = pct === newPct ? p : p; // same ref
          const qty2 = p.qty * (newPct / 100);
          const amt2 = qty2 * p.currentPrice;
          setTakeProfitPct(newPct);
          setTakeProfitQtyStr(qty2.toFixed(2));
          setTakeProfitAmtStr(Math.round(amt2).toString());
        }

        function onQtyChange(val: string) {
          setTakeProfitQtyStr(val);
          const n = parseFloat(val);
          if (!isNaN(n) && n > 0 && n <= p.qty) {
            const newPct = Math.round((n / p.qty) * 100);
            setTakeProfitPct(Math.max(1, Math.min(100, newPct)));
            setTakeProfitAmtStr(Math.round(n * p.currentPrice).toString());
          }
        }

        function onAmtChange(val: string) {
          setTakeProfitAmtStr(val);
          const n = parseFloat(val);
          const maxAmt = p.qty * p.currentPrice;
          if (!isNaN(n) && n > 0 && n <= maxAmt) {
            const newPct = Math.round((n / maxAmt) * 100);
            setTakeProfitPct(Math.max(1, Math.min(100, newPct)));
            setTakeProfitQtyStr((p.qty * (newPct / 100)).toFixed(2));
          }
        }

        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setTakeProfitTarget(null)}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, minWidth: 380, maxWidth: 440 }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: p.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>
                  {p.ticker.slice(0, 2)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{p.ticker}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{p.name}</div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: p.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{p.pnl >= 0 ? "+" : ""}{p.pnl.toLocaleString("en-US")} $</div>
                  <div style={{ fontSize: 11, color: p.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(2)}%</div>
                </div>
              </div>

              {/* Slider */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Продать</span>
                  <span style={{ fontWeight: 700, color: p.pnl >= 0 ? "#22c55e" : "#ef4444" }}>{pct}% позиции</span>
                </div>
                <input type="range" min={1} max={100} value={pct}
                  onChange={e => syncFromPct(Number(e.target.value))}
                  style={{ width: "100%", accentColor: p.pnl >= 0 ? "#22c55e" : "#ef4444", cursor: "pointer" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                  <span>1%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
                </div>
              </div>

              {/* Manual inputs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>Кол-во акций</div>
                  <input
                    type="number" value={takeProfitQtyStr} step="0.01"
                    min={0.01} max={p.qty}
                    onChange={e => onQtyChange(e.target.value)}
                    style={inputStyle}
                    placeholder={qtyToSell.toFixed(2)}
                  />
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
                    Всего: {p.qty.toFixed(2)} шт.
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>Сумма (USD)</div>
                  <input
                    type="number" value={takeProfitAmtStr} step="1"
                    min={1} max={Math.round(p.qty * p.currentPrice)}
                    onChange={e => onAmtChange(e.target.value)}
                    style={inputStyle}
                    placeholder={Math.round(proceeds).toString()}
                  />
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
                    Тек. цена: {p.currentPrice.toFixed(2)} $
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div style={{ background: "var(--bg-secondary)", borderRadius: 10, padding: "12px 14px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 7 }}>
                {[
                  { label: "Продаётся акций",    value: `${qtyToSell.toFixed(2)} шт.` },
                  { label: "Выручка от продажи", value: `${Math.round(proceeds).toLocaleString("en-US")} $`, bold: true },
                  { label: profitPart >= 0 ? "Из них прибыль" : "Из них убыток", value: `${profitPart >= 0 ? "+" : ""}${Math.round(profitPart).toLocaleString("en-US")} $`, color: profitPart >= 0 ? "#22c55e" : "#ef4444" },
                  { label: "Переходит в Кэш",    value: `${Math.round(proceeds).toLocaleString("en-US")} $`, color: "var(--text-primary)", bold: true },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{row.label}</span>
                    <span style={{ fontWeight: row.bold ? 700 : 600, color: (row as any).color ?? "var(--text-primary)" }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setTakeProfitTarget(null)} style={{
                  flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid var(--border)",
                  background: "transparent", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
                }}>Отмена</button>
                <button onClick={confirmTakeProfit} style={{
                  flex: 2, padding: "10px 0", borderRadius: 10, border: "none",
                  background: p.pnl >= 0 ? "#22c55e" : "#ef4444", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>💰 Продать на {Math.round(proceeds).toLocaleString("en-US")} $</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setDeleteConfirm(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 14, padding: "28px 32px", width: 360,
              boxShadow: "0 8px 40px rgba(0,0,0,0.4)",
              animation: "fadeIn 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%", background: deleteConfirm.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "white", flexShrink: 0,
              }}>
                {deleteConfirm.ticker.slice(0, 2)}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{deleteConfirm.ticker}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{deleteConfirm.name}</div>
              </div>
            </div>

            <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 8 }}>
              Удалить эту позицию из портфеля?
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 20, padding: "10px 14px", background: "var(--bg-secondary)", borderRadius: 8, fontSize: 12, color: "var(--text-secondary)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Количество</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{deleteConfirm.qty > 0 ? deleteConfirm.qty.toFixed(2) : "–"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Стоимость</span>
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>${deleteConfirm.value.toLocaleString("en-US")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>P/L</span>
                <span style={{ fontWeight: 600, color: deleteConfirm.pnl >= 0 ? "#22c55e" : "#ef4444" }}>
                  {deleteConfirm.pnl >= 0 ? "+" : ""}{deleteConfirm.pnl.toLocaleString("en-US")} USD
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  flex: 1, padding: "10px", borderRadius: 8, border: "1px solid var(--border)",
                  background: "transparent", color: "var(--text-secondary)", cursor: "pointer",
                  fontSize: 13, fontWeight: 600,
                }}
              >
                Отмена
              </button>
              <button
                onClick={() => deletePosition(deleteConfirm.id)}
                style={{
                  flex: 1, padding: "10px", borderRadius: 8, border: "none",
                  background: "#ef4444", color: "white", cursor: "pointer",
                  fontSize: 13, fontWeight: 600,
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} } @keyframes fadeIn { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );
}
