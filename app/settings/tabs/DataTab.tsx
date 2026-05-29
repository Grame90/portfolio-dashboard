"use client";

import { useRef, type ChangeEvent } from "react";
import Link from "next/link";
import { useApp } from "@/lib/useApp";
import { BACKUP_KEYS, RESET_ALL_KEYS, importBackupPayload } from "@/lib/portfolioBackup";
import { usePortfolioStore } from "@/lib/store/usePortfolioStore";
import { STORAGE_INFO } from "../constants";
import { useFlash } from "../useFlash";

export function DataTab() {
  const app = useApp();
  const importRef = useRef<HTMLInputElement>(null);
  const { saved, setSaved } = useFlash();

  function handleExport() {
    try {
      const payload: Record<string, unknown> = { exportedAt: new Date().toISOString() };
      BACKUP_KEYS.forEach((key) => {
        try { payload[key] = JSON.parse(localStorage.getItem(key) || "null"); } catch {}
      });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portfolio_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSaved("Бэкап скачан ✓");
      setTimeout(() => setSaved(null), 2500);
    } catch { setSaved("Ошибка экспорта ✗"); }
  }

  function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const payload = JSON.parse(ev.target?.result as string);
        const positions = importBackupPayload(payload);
        if (positions.length > 0) app.setPositions(positions);
        app.refreshPositions();
        setSaved(`Данные импортированы: ${positions.length} позиций ✓`);
        setTimeout(() => setSaved(null), 3000);
      } catch { setSaved("Ошибка импорта ✗"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleClearAll() {
    if (!window.confirm("Удалить все данные? Это сотрёт позиции, кэш, снапшоты, импорт, настройки, цели и историю — везде, во всех вкладках. Действие необратимо.")) return;

    RESET_ALL_KEYS.forEach((key) => {
      try { localStorage.removeItem(key); } catch {}
    });

    usePortfolioStore.getState().clearPositions();

    try {
      await fetch("/api/shared-data", { method: "DELETE" });
    } catch {}

    setSaved("Данные удалены — страница перезагрузится");
    setTimeout(() => { window.location.reload(); }, 800);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div className="card" style={{ padding: 20 }}>
        <div className="card-title">Резервное копирование</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Экспорт данных</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
              Скачайте полный бэкап портфеля: позиции, история, дивиденды, настройки.
            </div>
            <button onClick={handleExport} style={{ padding: "9px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "white" }}>
              Скачать бэкап (.json)
            </button>
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Импорт данных</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
              Восстановите портфель из ранее сохранённого бэкап-файла.
            </div>
            <button onClick={() => importRef.current?.click()} style={{ padding: "9px 20px", borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "transparent", color: "var(--text-primary)" }}>
              Загрузить файл (.json)
            </button>
            <input ref={importRef} type="file" accept=".json" style={{ display: "none" }} onChange={handleImport} />
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Импорт отчёта брокера</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
              Распознать сделки из PDF/текста отчёта брокера (IBKR, Midas, T-Invest и др.).
            </div>
            <Link href="/import" style={{ display: "inline-block", padding: "9px 20px", borderRadius: 8, border: "1px solid var(--accent)", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "transparent", color: "var(--accent)", textDecoration: "none" }}>
              Открыть импорт отчёта →
            </Link>
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Скан из фото</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
              Распознать позиции по скриншоту/фото портфеля из приложения брокера.
            </div>
            <Link href="/scan" style={{ display: "inline-block", padding: "9px 20px", borderRadius: 8, border: "1px solid var(--accent)", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "transparent", color: "var(--accent)", textDecoration: "none" }}>
              Открыть скан из фото →
            </Link>
          </div>
          {saved && <div style={{ fontSize: 12, color: saved.includes("✗") ? "#ef4444" : "#22c55e" }}>{saved}</div>}
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="card-title">Хранилище данных</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 20 }}>
          {STORAGE_INFO.map(({ key, label }) => {
            const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
            const size = raw ? (new Blob([raw]).size / 1024).toFixed(1) : null;
            const count = (() => {
              try { const d = JSON.parse(raw || "null"); return Array.isArray(d) ? d.length : (d ? 1 : 0); } catch { return 0; }
            })();
            return (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: size ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {size ? `${count > 0 ? `${count} зап. · ` : ""}${size} КБ` : "пусто"}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ padding: "14px 16px", borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#ef4444", marginBottom: 4 }}>Удалить все данные</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
            Полностью очищает все сохранённые данные портфеля. Необратимо.
          </div>
          <button onClick={handleClearAll} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #ef4444", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "transparent", color: "#ef4444" }}>
            Очистить данные
          </button>
        </div>
      </div>
    </div>
  );
}
