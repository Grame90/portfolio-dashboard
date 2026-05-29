"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import { actionItems, completedActions } from "@/lib/mockData";
import { useApp } from "@/lib/useApp";

import { HISTORY_PERIOD_DAYS, PAGE_SIZE } from "./constants";
import type { TargetRow, SortField } from "./types";
import { buildActionList, loadTargetStructure, parseDMY, saveTargetStructure } from "./utils";
import { EditInstrumentsDialog } from "./dialogs/EditInstrumentsDialog";
import { SummaryCards } from "./sections/SummaryCards";
import { ActionsTabsBar } from "./sections/ActionsTabsBar";
import { ActionCards } from "./sections/ActionCards";
import { DeviationPanel } from "./sections/DeviationPanel";
import { HistoryView } from "./sections/HistoryView";

export default function ActionsPage() {
  const app = useApp();
  const [activeTab, setActiveTab] = useState("ВСЕ ДЕЙСТВИЯ");
  const [stagedActionList, setStagedActionList] = useState<typeof actionItems>([]);
  const [executed, setExecuted] = useState<number[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const initialized = useRef(false);

  // Target structure (persisted in localStorage)
  const [targetRows, setTargetRows] = useState<TargetRow[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editRows, setEditRows] = useState<TargetRow[]>([]);

  useEffect(() => {
    setTargetRows(loadTargetStructure());
  }, []);

  // Build action list once when live data is ready; never auto-regenerate
  useEffect(() => {
    if (initialized.current) return;
    if (!app.portfolioTotal || !app.positions.length || !targetRows.length) return;
    setStagedActionList(buildActionList(app.positions, app.liveQuotes, app.portfolioTotal, targetRows, actionItems));
    initialized.current = true;
  }, [app.portfolioTotal, app.positions, app.liveQuotes, targetRows]);

  function refreshActionList(rows?: TargetRow[]) {
    const structure = rows ?? targetRows;
    initialized.current = false;
    setExecuted([]);
    setDismissed([]);
    setStagedActionList(buildActionList(app.positions, app.liveQuotes, app.portfolioTotal, structure, actionItems));
    initialized.current = true;
  }

  function openEditor() {
    setEditRows(targetRows.map(r => ({ ...r })));
    setEditOpen(true);
  }

  function saveEditor() {
    const cleaned = editRows.filter(r => r.ticker.trim() !== "");
    saveTargetStructure(cleaned);
    setTargetRows(cleaned);
    setEditOpen(false);
    refreshActionList(cleaned);
  }

  function addEditRow() {
    setEditRows(prev => [...prev, { ticker: "", target: 0 }]);
  }

  function removeEditRow(i: number) {
    setEditRows(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateEditRow(i: number, field: keyof TargetRow, value: string) {
    setEditRows(prev =>
      prev.map((r, idx) =>
        idx === i ? { ...r, [field]: field === "target" ? parseFloat(value) || 0 : value } : r,
      ),
    );
  }

  // History filters
  const [histSearch, setHistSearch] = useState("");
  const [histType, setHistType] = useState("Все");
  const [histPeriod, setHistPeriod] = useState("Всё");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [histPage, setHistPage] = useState(1);

  function executeAction(id: number) {
    const a = stagedActionList.find(item => item.id === id);
    if (a) {
      const isBuy = a.action.startsWith("Докупить");
      const ticker = a.ticker === "КЭШ" ? null : a.ticker;
      if (ticker && a.amount > 0) {
        try {
          const stored = localStorage.getItem("positions-data");
          const positions: any[] = stored ? JSON.parse(stored) : [];
          const idx = positions.findIndex((p: any) => p.ticker === ticker);
          if (idx >= 0) {
            const currentPrice = app.liveQuotes[ticker]?.current || positions[idx].avgPrice || 1;
            const qtyChange = a.amount / currentPrice;
            if (isBuy) {
              const oldTotal = positions[idx].qty * positions[idx].avgPrice;
              const newQty = positions[idx].qty + qtyChange;
              positions[idx].avgPrice = (oldTotal + a.amount) / newQty;
              positions[idx].qty = newQty;
            } else {
              positions[idx].qty = Math.max(0, positions[idx].qty - qtyChange);
            }
            localStorage.setItem("positions-data", JSON.stringify(positions));
            window.dispatchEvent(new CustomEvent("positions-updated"));
          }
        } catch {}
      }
    }
    setExecuted(prev => [...prev, id]);
  }

  function dismissAction(id: number) {
    setDismissed(prev => [...prev, id]);
  }

  const liveActionList = stagedActionList;

  const visibleActions = liveActionList.filter((a) => {
    if (dismissed.includes(a.id)) return false;
    if (activeTab === "ПРИОРИТЕТНЫЕ") return (a.priority === "Высокий" || a.priority === "Критический") && !executed.includes(a.id);
    if (activeTab === "ЗАПЛАНИРОВАННЫЕ") return a.status === "Запланировано" && !executed.includes(a.id);
    if (activeTab === "ИСТОРИЯ") return false;
    return true;
  });

  const highCount    = liveActionList.filter((a) => !executed.includes(a.id) && (a.priority === "Высокий" || a.priority === "Критический")).length;
  const pendingCount = visibleActions.filter((a) => !executed.includes(a.id)).length;
  const doneCount    = executed.length + completedActions.length;

  const liveDeviationData = useMemo(() => {
    if (!app.portfolioTotal || !app.positions.length) return [];
    const nonCash = app.positions.filter(p => p.type !== "Кэш");
    const eqTarget = nonCash.length > 0 ? 100 / app.positions.length : 0;
    return app.positions.map(p => {
      const val = p.qty * (app.liveQuotes[p.ticker]?.current || p.avgPrice);
      const liveShare = (val / app.portfolioTotal) * 100;
      const savedTarget = targetRows.find(r => r.ticker === p.ticker || (r.ticker === "КЭШ(USD)" && p.type === "Кэш"));
      const target = savedTarget ? savedTarget.target : (p.type === "Кэш" ? liveShare : eqTarget);
      return { ticker: p.ticker, deviation: parseFloat((liveShare - target).toFixed(2)) };
    });
  }, [app.portfolioTotal, app.positions, app.liveQuotes, targetRows]);

  const maxDeviation = liveDeviationData.length > 0
    ? Math.max(...liveDeviationData.map(d => Math.abs(d.deviation)))
    : 0;

  const liveRecommendations = useMemo(() => {
    if (!app.positions.length) return [];
    const recs: { action: string; reason: string; priority: string }[] = [];
    const assetTypes = new Set(app.positions.filter(p => p.type !== "Кэш").map(p => p.type));
    if (assetTypes.size < 3) {
      recs.push({
        action: "Диверсифицировать портфель",
        reason: `Только ${assetTypes.size} класс(а) активов — добавьте ETF, облигации или другие инструменты`,
        priority: "Средний",
      });
    }
    app.positions.forEach(p => {
      const price = app.liveQuotes[p.ticker]?.current || p.avgPrice;
      const pnlPct = ((price - p.avgPrice) / p.avgPrice) * 100;
      if (pnlPct < -15) {
        recs.push({ action: `Пересмотреть позицию ${p.ticker}`, reason: `Просадка ${pnlPct.toFixed(1)}% — оцените целесообразность удержания`, priority: "Высокий" });
      } else if (pnlPct > 25) {
        recs.push({ action: `Зафиксировать часть прибыли ${p.ticker}`, reason: `Рост +${pnlPct.toFixed(1)}% — рассмотрите частичную продажу`, priority: "Средний" });
      }
    });
    liveDeviationData.filter(d => Math.abs(d.deviation) > 5).forEach(d => {
      recs.push({
        action: d.deviation > 0 ? `Сократить ${d.ticker}` : `Докупить ${d.ticker}`,
        reason: `Отклонение от целевой доли ${d.deviation > 0 ? "+" : ""}${d.deviation.toFixed(1)}%`,
        priority: Math.abs(d.deviation) > 10 ? "Высокий" : "Средний",
      });
    });
    return recs.slice(0, 5);
  }, [app.positions, app.liveQuotes, liveDeviationData]);

  // ── History data ─────────────────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    const now = new Date("2024-05-21").getTime();
    const days = HISTORY_PERIOD_DAYS[histPeriod] ?? 99999;
    const cutoff = now - days * 86400000;

    return [...completedActions]
      .filter((a) => {
        if (histType !== "Все" && a.type !== histType) return false;
        if (histSearch
            && !a.ticker.toLowerCase().includes(histSearch.toLowerCase())
            && !a.name.toLowerCase().includes(histSearch.toLowerCase())) return false;
        if (parseDMY(a.date) < cutoff) return false;
        return true;
      })
      .sort((a, b) => {
        let va: any;
        let vb: any;
        if (sortField === "date")        { va = parseDMY(a.date); vb = parseDMY(b.date); }
        else if (sortField === "type")   { va = a.type;   vb = b.type; }
        else if (sortField === "ticker") { va = a.ticker; vb = b.ticker; }
        else                             { va = (a as any)[sortField] ?? 0; vb = (b as any)[sortField] ?? 0; }
        if (va < vb) return sortAsc ? -1 : 1;
        if (va > vb) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [histSearch, histType, histPeriod, sortField, sortAsc]);

  const totalPages = Math.ceil(filteredHistory.length / PAGE_SIZE);
  const pagedHistory = filteredHistory.slice((histPage - 1) * PAGE_SIZE, histPage * PAGE_SIZE);

  const histStats = useMemo(() => {
    const all = completedActions;
    return {
      totalOps:    all.length,
      bought:      all.filter(a => a.type === "Покупка").reduce((s, a) => s + a.amount, 0),
      sold:        all.filter(a => a.type === "Продажа").reduce((s, a) => s + a.amount, 0),
      realizedPnl: all.reduce((s, a) => s + (a.pnl ?? 0), 0),
      totalComm:   all.reduce((s, a) => s + (a.commission ?? 0), 0),
      bestDeal:    all.filter(a => a.pnl > 0).sort((a, b) => b.pnl - a.pnl)[0],
    };
  }, []);

  const cumulativePnl = useMemo(() => {
    const sorted = [...completedActions].sort((a, b) => parseDMY(a.date) - parseDMY(b.date));
    let cum = 0;
    return sorted.map((a) => {
      cum += a.pnl ?? 0;
      return { date: a.date.slice(0, 5), cum };
    });
  }, []);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
    setHistPage(1);
  }

  function exportHistory() {
    const csv = [
      ["Дата", "Время", "Тип", "Тикер", "Инструмент", "Кол-во", "Цена", "Сумма", "Комиссия", "P&L", "Брокер", "Заметка"],
      ...filteredHistory.map(a => [a.date, a.time, a.type, a.ticker, a.name, a.qty, a.price, a.amount, a.commission, a.pnl, a.broker, a.note]),
    ].map(r => r.join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = `history_${Date.now()}.csv`;
    el.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader title="ДЕЙСТВИЯ" subtitle="Рекомендуемые торговые операции и план ребалансировки" showSnapshot />

      <div style={{ padding: "16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        <SummaryCards
          pendingCount={pendingCount}
          highCount={highCount}
          doneCount={doneCount}
          maxDeviation={maxDeviation}
        />

        <ActionsTabsBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOpenEditor={openEditor}
          onRefresh={() => refreshActionList()}
        />

        <EditInstrumentsDialog
          open={editOpen}
          rows={editRows}
          onAddRow={addEditRow}
          onRemoveRow={removeEditRow}
          onUpdateRow={updateEditRow}
          onClose={() => setEditOpen(false)}
          onSave={saveEditor}
        />

        {activeTab !== "ИСТОРИЯ" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12 }}>
            <ActionCards
              actions={visibleActions}
              executed={executed}
              onExecute={executeAction}
              onDismiss={dismissAction}
            />
            <DeviationPanel
              deviationData={liveDeviationData}
              recommendations={liveRecommendations}
              hasPositions={app.positions.length > 0}
            />
          </div>
        ) : (
          <HistoryView
            filteredHistory={filteredHistory}
            pagedHistory={pagedHistory}
            cumulativePnl={cumulativePnl}
            stats={histStats}
            histSearch={histSearch}
            setHistSearch={setHistSearch}
            histType={histType}
            setHistType={setHistType}
            histPeriod={histPeriod}
            setHistPeriod={setHistPeriod}
            sortField={sortField}
            sortAsc={sortAsc}
            onSort={toggleSort}
            histPage={histPage}
            setHistPage={setHistPage}
            totalPages={totalPages}
            onExportCsv={exportHistory}
          />
        )}
      </div>
    </div>
  );
}
