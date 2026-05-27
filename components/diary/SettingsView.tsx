"use client";

// Diary "Настройки" tab.
//
// Three sections:
//   1. Стратегия — base date, initial invested, annual rate, days-per-year.
//                  Plus the "Действия и триггеры" block (manual snapshot,
//                  historical backfill, FX refresh, Excel import).
//   2. Брокеры   — list + open broker manager modal.
//   3. Обслуживание — reset / clear / diagnostics.

import { Camera, Trash2 } from "lucide-react";
import type { ImportDiagnostics } from "@/lib/diary/import";
import type { DiaryBroker, StrategyConfig } from "@/lib/diary/types";

export type SettingsViewProps = {
  cfg: StrategyConfig;
  onChangeConfig: (next: StrategyConfig) => void;
  brokers: DiaryBroker[];
  onOpenBrokerModal: () => void;
  onClear: () => void;
  diag: ImportDiagnostics | null;
  onSnapshot: () => void;
  onBackfill: () => void;
  backfilling: boolean;
  onRefreshFx: () => void;
  refreshingFx: boolean;
  onImport: () => void;
  onFileChange: (f: File) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  entriesCount: number;
};

export default function SettingsView(props: SettingsViewProps) {
  const {
    cfg,
    onChangeConfig,
    brokers,
    onOpenBrokerModal,
    onClear,
    diag,
    onSnapshot,
    onBackfill,
    backfilling,
    onRefreshFx,
    refreshingFx,
    onImport,
    onFileChange,
    fileRef,
    entriesCount,
  } = props;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
      {/* Стратегия */}
      <section style={card}>
        <h3 style={sectionTitle}>Стратегия</h3>
        <p style={subline}>
          База расчётов плана и доходности. План считается от «Стартовой суммы»
          по годовой ставке.
        </p>
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <Row label="Дата старта">
            <input
              type="date"
              value={cfg.startDate}
              onChange={(e) => onChangeConfig({ ...cfg, startDate: e.target.value })}
              style={inputStyle}
            />
          </Row>
          <Row label="Стартовая сумма (USD)">
            <input
              type="number"
              value={cfg.initialInvested}
              onChange={(e) => onChangeConfig({ ...cfg, initialInvested: Number(e.target.value) })}
              style={inputStyle}
            />
          </Row>
          <Row label="Годовая ставка">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="number"
                step="0.01"
                value={cfg.annualRate * 100}
                onChange={(e) => onChangeConfig({ ...cfg, annualRate: Number(e.target.value) / 100 })}
                style={inputStyle}
              />
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>%</span>
            </div>
          </Row>
          <Row label="Дней в году">
            <input
              type="number"
              value={cfg.calendarDaysPerYear}
              onChange={(e) => onChangeConfig({ ...cfg, calendarDaysPerYear: Number(e.target.value) })}
              style={inputStyle}
            />
          </Row>
        </div>

        <div style={actionsBlock}>
          <div style={blockTitle}>Действия и триггеры</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button onClick={onSnapshot} style={btnPrimary}>
              <Camera size={13} /> Снять снимок сейчас
            </button>
            <button onClick={onBackfill} style={btnSecondary} disabled={backfilling}>
              {backfilling ? "Считаю…" : "Авто-снапшоты из истории"}
            </button>
            <button onClick={onRefreshFx} style={btnSecondary} disabled={refreshingFx}>
              {refreshingFx ? "Тяну курсы…" : "Подтянуть курсы FX"}
            </button>
            <button onClick={onImport} style={btnSecondary}>Импорт Excel / CSV</button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,.numbers,.csv,.tsv,.txt"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFileChange(f);
                e.target.value = "";
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Записей: {entriesCount}
          </div>
        </div>
      </section>

      {/* Брокеры */}
      <section style={card}>
        <h3 style={sectionTitle}>Брокеры ({brokers.length})</h3>
        <p style={subline}>
          Каждый брокер = колонка в журнале. Авто-снапшот собирает балансы из{" "}
          <code style={code}>/positions</code> по маппингу.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: "12px 0", display: "flex", flexDirection: "column", gap: 6 }}>
          {brokers.map((b) => (
            <li key={b.id} style={brokerRow}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{b.label}</span>
              <span style={ccyTag}>{b.currency}</span>
              {b.isCrypto && <span style={cryptoTag}>крипта</span>}
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
                {b.positionBrokers.length > 0 ? `${b.positionBrokers.length} имён` : "не настроен"}
              </span>
            </li>
          ))}
          {brokers.length === 0 && (
            <li style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Пока пусто. Открой управление и добавь.
            </li>
          )}
        </ul>
        <button onClick={onOpenBrokerModal} style={btnPrimary}>Управление брокерами</button>
      </section>

      {/* Обслуживание */}
      <section style={{ ...card, gridColumn: "1 / -1" }}>
        <h3 style={sectionTitle}>Обслуживание</h3>
        <p style={subline}>
          Полный сброс удалит все записи, события и брокеров, вернув их к
          дефолтам. Портфель из <code style={code}>/positions</code> не трогается.
        </p>
        <button onClick={onClear} style={btnDanger}>
          <Trash2 size={13} /> Сбросить весь дневник
        </button>

        {diag && (
          <div style={{ marginTop: 18 }}>
            <div style={blockTitle}>Диагностика последнего импорта</div>
            <pre style={diagBox}>
              {JSON.stringify(
                {
                  detected: diag.detected,
                  counts: diag.counts,
                },
                null,
                2,
              )}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 10, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 18,
};
const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  color: "var(--text-muted)",
  marginBottom: 8,
};
const subline: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "var(--text-muted)",
  lineHeight: 1.5,
};
const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "var(--bg-secondary)",
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "inherit",
  width: "100%",
};
const code: React.CSSProperties = {
  padding: "1px 5px",
  borderRadius: 4,
  background: "var(--bg-secondary)",
  color: "var(--text-primary)",
  fontSize: 11,
  fontFamily: "ui-monospace, monospace",
};
const blockTitle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  fontWeight: 700,
};
const actionsBlock: React.CSSProperties = {
  marginTop: 18,
  paddingTop: 14,
  borderTop: "1px solid var(--border)",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};
const brokerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 8,
  background: "var(--bg-secondary)",
};
const ccyTag: React.CSSProperties = {
  fontSize: 10,
  padding: "1px 6px",
  borderRadius: 4,
  background: "var(--bg-card)",
  color: "var(--text-muted)",
  fontWeight: 700,
};
const cryptoTag: React.CSSProperties = {
  fontSize: 10,
  padding: "1px 6px",
  borderRadius: 4,
  background: "rgba(249, 115, 22, 0.15)",
  color: "#f97316",
  fontWeight: 700,
};
const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 14px",
  borderRadius: 8,
  border: "1px solid var(--accent, #3b82f6)",
  background: "var(--accent, #3b82f6)",
  color: "white",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
const btnDanger: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 14px",
  borderRadius: 8,
  border: "1px solid #ef4444",
  background: "transparent",
  color: "#ef4444",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};
const diagBox: React.CSSProperties = {
  margin: 0,
  padding: 10,
  borderRadius: 8,
  background: "var(--bg-secondary)",
  fontSize: 11,
  fontFamily: "ui-monospace, monospace",
  color: "var(--text-muted)",
  overflow: "auto",
  maxHeight: 200,
};
