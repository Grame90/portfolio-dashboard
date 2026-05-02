"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { RefreshCw, FileDown, Settings, MoreHorizontal, CheckCircle, Upload, Info } from "lucide-react";
import { lastUpdated } from "@/lib/mockData";
import { useApp } from "@/lib/AppContext";
import { useMobile } from "@/lib/useMobile";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  showSnapshot?: boolean;
}

export default function PageHeader({ title, subtitle, showSnapshot = false }: PageHeaderProps) {
  const app = useApp();
  const isMobile = useMobile();
  const [lastSnap, setLastSnap] = useState(lastUpdated);
  const [toast, setToast] = useState<string | null>(null);
  const [toastColor, setToastColor] = useState("#22c55e");
  const [snapLoading, setSnapLoading] = useState(false);
  const [refreshSpin, setRefreshSpin] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function showToast(msg: string, color = "#22c55e") {
    setToast(msg);
    setToastColor(color);
    setTimeout(() => setToast(null), 3000);
  }

  function handleSnapshot() {
    if (snapLoading) return;
    setSnapLoading(true);
    setTimeout(() => {
      const now = new Date();
      const formatted =
        now.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }) +
        " " +
        now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      setLastSnap(formatted);
      setSnapLoading(false);
      showToast(`Портфель зафиксирован: ${formatted}`);

      const snap = {
        date: now.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }),
        time: now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
        capital: Math.round(app.portfolioTotal),
        cost: Math.round(app.totalCost),
        profit: Math.round(app.totalPnl),
        profitPct: app.totalPnlPct.toFixed(2) + "%",
        comment: "Фиксация портфеля",
      };
      try {
        const existing = JSON.parse(localStorage.getItem("snapshots-data") || "[]");
        existing.unshift(snap);
        localStorage.setItem("snapshots-data", JSON.stringify(existing.slice(0, 50)));
      } catch {}

      window.dispatchEvent(new CustomEvent("portfolio-snapshot", { detail: { time: now, snap } }));
    }, 800);
  }

  function handleRefresh() {
    if (refreshSpin) return;
    setRefreshSpin(true);
    app.refreshPositions();
    setTimeout(() => {
      setRefreshSpin(false);
      showToast("Данные обновлены");
    }, 700);
  }

  function handleSavePDF() {
    showToast("Подготовка PDF…", "#7c3aed");
    setTimeout(() => window.print(), 400);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const payload = JSON.parse(ev.target?.result as string);
        if (payload.positions) localStorage.setItem("positions-data", JSON.stringify(payload.positions));
        if (payload.settings) localStorage.setItem("dashboard-settings", JSON.stringify(payload.settings));
        if (payload.history) localStorage.setItem("portfolio-chart-history", JSON.stringify(payload.history));
        if (payload.dividends) localStorage.setItem("dividends-received", JSON.stringify(payload.dividends));
        if (payload.snapshots) localStorage.setItem("snapshots-data", JSON.stringify(payload.snapshots));
        if (payload.targetStructure) localStorage.setItem("target-structure", JSON.stringify(payload.targetStructure));
        app.refreshPositions();
        setMoreOpen(false);
        showToast("Данные импортированы успешно");
      } catch {
        showToast("Ошибка импорта файла", "#ef4444");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <>
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: "var(--bg-card)", border: `1px solid ${toastColor}`,
          borderRadius: 10, padding: "12px 18px",
          display: "flex", alignItems: "center", gap: 10,
          boxShadow: `0 4px 24px rgba(0,0,0,0.25)`,
          animation: "fadeIn 0.2s ease",
          maxWidth: 360,
        }}>
          <CheckCircle size={18} color={toastColor} />
          <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{toast}</span>
        </div>
      )}

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isMobile ? "12px 14px" : "16px 24px", borderBottom: "1px solid var(--border)",
        background: "var(--bg-secondary)", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 16 : 22, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h1>
          {!isMobile && <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{subtitle}</p>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12 }}>
          {!isMobile && (
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {showSnapshot ? `Последняя фиксация: ${lastSnap}` : `Последнее обновление: ${lastSnap}`}
            </span>
          )}

          {showSnapshot && !isMobile && (
            <button
              onClick={handleSnapshot}
              disabled={snapLoading}
              className="btn-primary"
              style={{ padding: "6px 14px", fontSize: 12, opacity: snapLoading ? 0.7 : 1, cursor: snapLoading ? "wait" : "pointer" }}
            >
              {snapLoading ? "ФИКСАЦИЯ..." : "ЗАФИКСИРОВАТЬ ПОРТФЕЛЬ"}
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center" }}
            title="Обновить данные"
          >
            <RefreshCw size={16} style={{ transition: "transform 0.7s", transform: refreshSpin ? "rotate(360deg)" : "rotate(0deg)" }} />
          </button>

          {/* Save PDF */}
          {!isMobile && (
            <button
              onClick={handleSavePDF}
              style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center" }}
              title="Сохранить в PDF"
            >
              <FileDown size={16} />
            </button>
          )}

          {/* Settings */}
          {!isMobile && (
            <Link href="/settings" style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center" }} title="Настройки">
              <Settings size={16} />
            </Link>
          )}

          {/* More dropdown */}
          <div ref={moreRef} style={{ position: "relative" }}>
            <button
              onClick={() => setMoreOpen(o => !o)}
              style={{ background: "none", border: "none", color: moreOpen ? "var(--accent-light)" : "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center" }}
              title="Ещё"
            >
              <MoreHorizontal size={16} />
            </button>
            {moreOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 100,
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "6px 0", minWidth: 190,
                boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
                animation: "fadeIn 0.15s ease",
              }}>
                <button
                  onClick={() => importRef.current?.click()}
                  style={{ width: "100%", background: "none", border: "none", padding: "9px 16px", textAlign: "left", cursor: "pointer", fontSize: 13, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 10 }}
                >
                  <Upload size={14} /> Импорт данных
                </button>
                <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />
                <div style={{ padding: "9px 16px", fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 10 }}>
                  <Info size={13} /> Портфельный трекер v1.0
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden file input for import */}
      <input ref={importRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleImportFile} />
    </>
  );
}
