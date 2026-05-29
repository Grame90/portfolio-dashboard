import { useMemo } from "react";
import { useApp } from "@/lib/useApp";
import { LEVEL_ORDER } from "./utils";
import type { AlertLevel, Indicator, Recommendation } from "./types";

interface RiskMetrics {
  level: AlertLevel;
  indicators: Indicator[];
  alertCount: number;
  recommendations: Recommendation[];
  summary: string;
  // Raw numbers — convenient for the simple "AlertCard" rendering
  dailyPct: number;
  totalPnlPct: number;
  top3pct: number;
  cashPct: number;
  cryptoPct: number;
  redCount: number;
  positionCount: number;
}

/**
 * Computes all portfolio risk indicators in one place.
 * Returns both `indicators` (full state, used by Badge popover) and
 * convenience fields (used by AlertCard's simpler rendering).
 */
export function usePortfolioRisk(): RiskMetrics {
  const app = useApp();

  return useMemo(() => {
    const total = app.portfolioTotal;
    const positions = app.positions;
    const liveQuotes = app.liveQuotes;

    if (!total || !positions.length) {
      return {
        level: "green" as AlertLevel,
        indicators: [],
        alertCount: 0,
        recommendations: [],
        summary: "Нет данных",
        dailyPct: 0,
        totalPnlPct: 0,
        top3pct: 0,
        cashPct: 100,
        cryptoPct: 0,
        redCount: 0,
        positionCount: 0,
      };
    }

    const dailyPct = app.dailyChangePct;
    const totalPnlPct = app.totalPnlPct;

    const posVals = positions
      .map(p => ({ ticker: p.ticker, val: p.qty * (liveQuotes[p.ticker]?.current ?? p.avgPrice) }))
      .sort((a, b) => b.val - a.val);
    const top3pct = total > 0
      ? posVals.slice(0, 3).reduce((s, p) => s + p.val, 0) / total * 100
      : 0;

    const cashVal = positions
      .filter(p => p.type === "Кэш")
      .reduce((s, p) => s + p.qty * (liveQuotes[p.ticker]?.current ?? p.avgPrice), 0);
    const cashPct = total > 0 ? cashVal / total * 100 : 100;

    const cryptoPct = total > 0
      ? positions.filter(p => p.type === "Крипто")
          .reduce((s, p) => s + p.qty * (liveQuotes[p.ticker]?.current ?? p.avgPrice), 0) / total * 100
      : 0;

    const redCount = positions.filter(p => {
      const q = liveQuotes[p.ticker];
      return q ? q.current < (q.previousClose ?? q.current) : false;
    }).length;

    const ind: Indicator[] = [];

    // 1. Daily change
    {
      let lv: AlertLevel = "green";
      let note = "норма (>−2%)";
      if (dailyPct <= -4) { lv = "red"; note = "крит. падение (≤−4%)"; }
      else if (dailyPct <= -2) { lv = "yellow"; note = "снижение (≤−2%)"; }
      else if (dailyPct >= 3) { note = "сильный рост"; }
      ind.push({
        id: "daily",
        label: "Дневное изменение",
        value: `${dailyPct >= 0 ? "+" : ""}${dailyPct.toFixed(2)}%`,
        level: lv,
        note,
      });
    }

    // 2. Total P&L
    {
      let lv: AlertLevel = "green";
      let note = "норма (>−10%)";
      if (totalPnlPct <= -20) { lv = "red"; note = "крит. просадка (≤−20%)"; }
      else if (totalPnlPct <= -10) { lv = "yellow"; note = "просадка (≤−10%)"; }
      ind.push({
        id: "totalPnl",
        label: "Общий P&L",
        value: `${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(1)}%`,
        level: lv,
        note,
      });
    }

    // 3. Concentration of top-3
    {
      let lv: AlertLevel = "green";
      let note = "норма (<65%)";
      if (top3pct >= 80) { lv = "red"; note = "крит. (≥80%)"; }
      else if (top3pct >= 65) { lv = "yellow"; note = "выше нормы (≥65%)"; }
      ind.push({ id: "concentration", label: "Концентрация топ-3", value: `${top3pct.toFixed(1)}%`, level: lv, note });
    }

    // 4. Cash buffer
    {
      let lv: AlertLevel = "green";
      let note = "норма (≥5%)";
      if (cashPct < 2) { lv = "red"; note = "опасно мало (<2%)"; }
      else if (cashPct < 5) { lv = "yellow"; note = "ниже нормы (<5%)"; }
      ind.push({ id: "cash", label: "Кэш-буфер", value: `${cashPct.toFixed(1)}%`, level: lv, note });
    }

    // 5. Crypto exposure
    {
      let lv: AlertLevel = "green";
      let note = "норма (<30%)";
      if (cryptoPct >= 50) { lv = "red"; note = "крит. (≥50%)"; }
      else if (cryptoPct >= 30) { lv = "yellow"; note = "повышенная (≥30%)"; }
      ind.push({ id: "crypto", label: "Доля крипто", value: `${cryptoPct.toFixed(1)}%`, level: lv, note });
    }

    // 6. Red positions today
    {
      const ratio = positions.length > 0 ? redCount / positions.length : 0;
      let lv: AlertLevel = "green";
      let note = "норма";
      if (ratio >= 0.7 && redCount > 3) { lv = "yellow"; note = "≥70% в минусе"; }
      ind.push({ id: "redPositions", label: "Позиции в минусе", value: `${redCount} / ${positions.length}`, level: lv, note });
    }

    const overallLevel: AlertLevel = ind.reduce<AlertLevel>(
      (max, i) => LEVEL_ORDER[i.level] > LEVEL_ORDER[max] ? i.level : max,
      "green",
    );

    const alertCount = ind.filter(i => i.level !== "green").length;

    const recs: Recommendation[] = [];
    if (overallLevel === "red") {
      recs.push({ text: "Не открывать новых позиций — рынок в стрессе" });
      recs.push({ text: "Проверить Stop-Loss по убыточным позициям" });
      if (cashPct < 5) recs.push({ text: "Рассмотреть продажу части активов для пополнения кэша" });
    } else if (overallLevel === "yellow") {
      recs.push({ text: "Соблюдать осторожность при докупке" });
      if (cashPct < 5) recs.push({ text: "Наращивать кэш-позицию до 5%+" });
      if (top3pct >= 65) recs.push({ text: "Рассмотреть диверсификацию крупнейших позиций" });
    } else {
      recs.push({ text: "Портфель в норме — плановый мониторинг" });
      if (dailyPct >= 2) recs.push({ text: "Фиксируй часть прибыли если позиция перекуплена" });
    }

    const summary =
      overallLevel === "red" ? "Повышенный риск — требуются действия" :
      overallLevel === "yellow" ? "Умеренный риск — держи руку на пульсе" :
      "Портфель стабилен";

    return {
      level: overallLevel,
      indicators: ind,
      alertCount,
      recommendations: recs,
      summary,
      dailyPct,
      totalPnlPct,
      top3pct,
      cashPct,
      cryptoPct,
      redCount,
      positionCount: positions.length,
    };
  }, [app.portfolioTotal, app.positions, app.liveQuotes, app.dailyChangePct, app.totalPnlPct]);
}
