"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import { DailyAlertBadge } from "@/components/DailyAlert";
import { useMobile } from "@/lib/useMobile";
import { useMarketStatus, formatEtTime } from "@/lib/marketStatus";
import { usePortfolioHistory } from "@/lib/usePortfolioHistory";
import { useApp } from "@/lib/useApp";
import type { StoredPosition } from "@/lib/types";
import { Select, SelectItem } from "@/components/ui/Select";
import { Tooltip as UITooltip } from "@/components/ui/Tooltip";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  TYPE_TABS as tabs,
  PERIOD_OPTIONS as periodOptions,
  CHART_DATA_MAP as chartDataMap,
  COLORS,
  TYPES,
  CASH_CURRENCIES,
  TICKER_BETA,
  TODAY_MS,
  EMPTY_FORM as emptyForm,
  BROKERS,
} from "./constants";
import type { Position, PositionForm } from "./types";
import {
  autoColor,
  brokerColor,
  recompute,
  persistPositions,
  loadPositions,
  fmtDate,
  chartCutoff,
  detectInstrumentType,
} from "./utils";
import { EditPositionDialog } from "./dialogs/EditPositionDialog";
import { TakeProfitDialog } from "./dialogs/TakeProfitDialog";
import { DeleteConfirmDialog } from "./dialogs/DeleteConfirmDialog";
import { AddInstrumentForm, type SearchResult } from "./forms/AddInstrumentForm";
import { AddCashForm } from "./forms/AddCashForm";
import { PositionsTable } from "./sections/PositionsTable";
import { PortfolioStructure } from "./sections/PortfolioStructure";
import { ChartsRow } from "./sections/ChartsRow";

export default function PositionsPage() {
  const isMobile = useMobile();
  const app = useApp();
  const positions = app.positions;
  const setPositions = (updater: ((prev: Position[]) => Position[]) | Position[]) => {
    const next = typeof updater === "function" ? updater(app.positions) : updater;
    app.setPositions(next.map((p: any) => ({
      id: p.id, ticker: p.ticker, name: p.name, type: p.type, qty: p.qty,
      avgPrice: p.avgPrice, color: p.color, purchaseDate: p.purchaseDate, action: p.action, broker: p.broker
    })));
  };
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [activeTab, setActiveTab] = useState("ВСЕ ПОЗИЦИИ");

  // Ticker search autocomplete
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownIdx, setDropdownIdx] = useState(-1);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [period, setPeriod] = useState("1М");
  const [activeBroker, setActiveBroker] = useState("");
  const [sortKey, setSortKey] = useState<keyof Position | "">("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
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
  const [editForm, setEditForm] = useState<PositionForm>(emptyForm);
  const [quoteStatus, setQuoteStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [lastPriceT, setLastPriceT] = useState<number>(0);
  const market = useMarketStatus();

  // Fetch real quotes — stocks via Finnhub, crypto via CoinGecko
  const fetchQuotes = useCallback(async (current: Position[]) => {
    const stockPositions = current.filter((p) => p.live && p.type !== "Крипто");
    const cryptoPositions = current.filter((p) => p.live && p.type === "Крипто");
    if (stockPositions.length === 0 && cryptoPositions.length === 0) return;

    setQuoteStatus("loading");
    try {
      const allData: Record<string, { current: number; previousClose: number; t?: number }> = {};

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

      // Pick the most recent Finnhub timestamp across all quotes
      const maxT = Object.values(allData).reduce((m, q) => Math.max(m, (q as any).t ?? 0), 0);
      if (maxT > 0) setLastPriceT(maxT);

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

  

  // Local simulation between real fetches — tick every 3 seconds
  

  const total = positions.reduce((s, p) => s + p.value, 0);
  const totalCost = positions.reduce((s, p) => s + p.qty * p.avgPrice, 0);
  const totalPnl = Math.round(total - totalCost);
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const uniqueBrokers = useMemo(() => {
    const s = new Set(positions.map(p => p.broker || "").filter(Boolean));
    return [...s].sort();
  }, [positions]);

  const filtered = positions.filter((p) => {
    if (activeTab === "АКЦИИ") return p.type === "Акция" && (!activeBroker || (p.broker || "") === activeBroker);
    if (activeTab === "ETF") return p.type === "ETF" && (!activeBroker || (p.broker || "") === activeBroker);
    if (activeTab === "КЭШ") return p.type === "Кэш" && (!activeBroker || (p.broker || "") === activeBroker);
    if (activeTab === "СЫРЬЁ") return p.type === "Сырьё" && (!activeBroker || (p.broker || "") === activeBroker);
    if (activeTab === "КРИПТО") return p.type === "Крипто" && (!activeBroker || (p.broker || "") === activeBroker);
    return !activeBroker || (p.broker || "") === activeBroker;
  });

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey as keyof Position];
      const bv = b[sortKey as keyof Position];
      if (typeof av === "number" && typeof bv === "number")
        return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc"
        ? String(av ?? "").localeCompare(String(bv ?? ""))
        : String(bv ?? "").localeCompare(String(av ?? ""));
    });
  }, [filtered, sortKey, sortDir]);

  function handleSort(key: keyof Position) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

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

  const { mergedTimeline } = usePortfolioHistory(
    positions as unknown as StoredPosition[],
    chartHistory,
    totalForChart,
    costForChart,
  );

  const chartData = useMemo(() => {
    if (totalForChart <= 0) return [];
    const cutoff = chartCutoff(period);
    const today = new Date().toISOString().slice(0, 10);
    const filtered = mergedTimeline.filter(p => p.date >= cutoff);
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
  }, [mergedTimeline, period, totalForChart]);

  const allChartData = useMemo(() => {
    if (totalForChart <= 0) return [];
    const today = new Date().toISOString().slice(0, 10);
    const pts = mergedTimeline.map(p => ({ date: fmtDate(p.date), value: p.value, cost: p.cost }));
    if (mergedTimeline[mergedTimeline.length - 1]?.date !== today)
      pts.push({ date: fmtDate(today), value: Math.round(totalForChart), cost: Math.round(costForChart) });
    // Need at least 2 points — synthesize a start point 30 days back at cost basis
    if (pts.length < 2) {
      const startIso = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      pts.unshift({ date: fmtDate(startIso), value: Math.round(costForChart), cost: Math.round(costForChart) });
    }
    return pts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergedTimeline, totalForChart]);

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
      const next = prev.filter((p) => p.id !== id);
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

      const result = next;
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
            broker: form.broker.trim(),
          }];
        }
        const result = next;
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
      broker: form.broker.trim(),
    };
    setPositions((prev) => {
      const next = [...prev, newPos];
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
      broker: p.broker ?? "",
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
            broker: (editForm as any).broker?.trim() ?? p.broker ?? "",
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
      const next = prev.map((p) => p.id === id ? { ...p, name } : p);
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

  function selectSearchResult(item: SearchResult) {
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
      <PageHeader title="ПОЗИЦИИ" subtitle="Детализация всех активов портфеля" showSnapshot titleBadge={<DailyAlertBadge />} />

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

        {/* Broker filter bar */}
        {uniqueBrokers.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", marginRight: 2 }}>Брокер:</span>
            <button onClick={() => setActiveBroker("")} style={{
              padding: "4px 12px", borderRadius: 20, border: `1px solid ${!activeBroker ? "var(--accent)" : "var(--border)"}`, cursor: "pointer", fontSize: 11, fontWeight: 600,
              background: !activeBroker ? "rgba(124,58,237,0.15)" : "transparent",
              color: !activeBroker ? "var(--accent-light)" : "var(--text-secondary)", transition: "all 0.15s",
            }}>Все</button>
            {uniqueBrokers.map(b => (
              <button key={b} onClick={() => setActiveBroker(b === activeBroker ? "" : b)} style={{
                padding: "4px 12px", borderRadius: 20, border: `1px solid ${activeBroker === b ? brokerColor(b) : "var(--border)"}`, cursor: "pointer", fontSize: 11, fontWeight: 600,
                background: activeBroker === b ? `${brokerColor(b)}22` : "transparent",
                color: activeBroker === b ? brokerColor(b) : "var(--text-secondary)", transition: "all 0.15s",
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: brokerColor(b), display: "inline-block", marginRight: 5 }} />
                {b}
              </button>
            ))}
          </div>
        )}

        {showForm && (
          <AddInstrumentForm
            isMobile={isMobile}
            form={form}
            formError={formError}
            onChange={setForm}
            onAdd={addPosition}
            searchResults={searchResults}
            searchLoading={searchLoading}
            dropdownOpen={dropdownOpen}
            dropdownIdx={dropdownIdx}
            onDropdownOpenChange={setDropdownOpen}
            onDropdownIdxChange={setDropdownIdx}
            onTickerInput={handleTickerInput}
            onSelectResult={selectSearchResult}
          />
        )}

        {showCashForm && (
          <AddCashForm
            isMobile={isMobile}
            form={form}
            formError={formError}
            cashCurrency={cashCurrency}
            cashRate={cashRate}
            onChange={setForm}
            onCashCurrencyChange={setCashCurrency}
            onCashRateChange={setCashRate}
            onAdd={addPosition}
          />
        )}

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 280px", gap: 12 }}>
          <PositionsTable
            positions={positions}
            sorted={sorted}
            filteredCount={filtered.length}
            total={total}
            totalPnl={totalPnl}
            totalPnlPct={totalPnlPct}
            market={market}
            lastPriceT={lastPriceT}
            quoteStatus={quoteStatus}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            lastTick={lastTick}
            priceColor={priceColor}
            editingNameId={editingNameId}
            editingNameValue={editingNameValue}
            onStartEditName={(id, name) => { setEditingNameId(id); setEditingNameValue(name); }}
            onChangeEditName={setEditingNameValue}
            onCommitEditName={commitNameEdit}
            onCancelEditName={() => setEditingNameId(null)}
            onOpenEdit={openEdit}
            onAskDelete={setDeleteConfirm}
            onAskTakeProfit={(p) => {
              setTakeProfitTarget(p);
              setTakeProfitPct(100);
              setTakeProfitQtyStr(p.qty.toFixed(2));
              setTakeProfitAmtStr(Math.round(p.qty * p.currentPrice).toString());
            }}
          />
          <PortfolioStructure positions={positions} byValue={byValue} />
        </div>

        <ChartsRow
          isMobile={isMobile}
          positions={positions}
          chartData={chartData}
          allChartData={allChartData}
          totalForChart={totalForChart}
          period={period}
          onPeriodChange={setPeriod}
          profitMode={profitMode}
          onProfitModeChange={setProfitMode}
        />
      </div>

      <EditPositionDialog
        open={!!editTarget}
        form={editForm}
        onChange={setEditForm}
        onClose={() => setEditTarget(null)}
        onSave={saveEdit}
      />

      <TakeProfitDialog
        target={takeProfitTarget}
        pct={takeProfitPct}
        qtyStr={takeProfitQtyStr}
        amtStr={takeProfitAmtStr}
        onPctChange={setTakeProfitPct}
        onQtyStrChange={setTakeProfitQtyStr}
        onAmtStrChange={setTakeProfitAmtStr}
        onClose={() => setTakeProfitTarget(null)}
        onConfirm={confirmTakeProfit}
      />

      <DeleteConfirmDialog
        target={deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={deletePosition}
      />

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} } @keyframes fadeIn { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );
}
