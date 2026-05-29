"use client";

import type { Dispatch, SetStateAction } from "react";
import type { ReceivedDividend } from "../types";

export interface DividendPosition {
  id: number;
  ticker: string;
  yieldPct: number;
  annual: number;
  quarterly: number;
}

interface DividendsRowProps {
  isMobile: boolean;
  livePortfolioTotal: number;
  annualDivIncome: number;
  portfolioDivYield: number;
  ytdReceived: number;
  divPositions: DividendPosition[];
  receivedDividends: ReceivedDividend[];
  pendingDividends: ReceivedDividend[];
  divExpanded: boolean;
  setDivExpanded: Dispatch<SetStateAction<boolean>>;
  onAddClick: () => void;
  onEditClick: (d: ReceivedDividend) => void;
  onDeleteClick: (id: string) => void;
  onConfirmPending: (d: ReceivedDividend) => void;
}

export function DividendsRow({
  isMobile,
  livePortfolioTotal,
  annualDivIncome,
  portfolioDivYield,
  ytdReceived,
  divPositions,
  receivedDividends,
  pendingDividends,
  divExpanded,
  setDivExpanded,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onConfirmPending,
}: DividendsRowProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
      <div className="card">
        <div className="card-title">Дивидендный доход</div>
        {livePortfolioTotal <= 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Нет позиций в портфеле</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Годовой (оценка)</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#22c55e" }}>${Math.round(annualDivIncome).toLocaleString("en-US")}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>~${Math.round(annualDivIncome / 12).toLocaleString("en-US")}/мес</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Доходность</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "#22c55e" }}>{portfolioDivYield.toFixed(2)}%</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Получено YTD: ${Math.round(ytdReceived).toLocaleString("en-US")}</div>
              </div>
            </div>
            {annualDivIncome === 0 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Позиции в портфеле не платят дивиденды</div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <div className="card-title">Дивиденды по позициям</div>
        {divPositions.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>Нет дивидендных позиций</div>
        ) : (
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "4px 6px", textAlign: "left", fontWeight: 600 }}>Тикер</th>
                <th style={{ padding: "4px 6px", textAlign: "right", fontWeight: 600 }}>Доходн.</th>
                <th style={{ padding: "4px 6px", textAlign: "right", fontWeight: 600 }}>Год</th>
                <th style={{ padding: "4px 6px", textAlign: "right", fontWeight: 600 }}>Квартал</th>
              </tr>
            </thead>
            <tbody>
              {divPositions.slice(0, 6).map(p => (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "5px 6px", fontWeight: 700, color: "var(--accent-light)" }}>{p.ticker}</td>
                  <td style={{ padding: "5px 6px", textAlign: "right", color: "#22c55e", fontWeight: 600 }}>{p.yieldPct.toFixed(2)}%</td>
                  <td style={{ padding: "5px 6px", textAlign: "right" }}>${Math.round(p.annual).toLocaleString("en-US")}</td>
                  <td style={{ padding: "5px 6px", textAlign: "right", color: "var(--text-secondary)" }}>${Math.round(p.quarterly).toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="card-title" style={{ margin: 0 }}>История выплат</div>
          <button
            onClick={onAddClick}
            style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", background: "var(--bg-secondary)", color: "var(--text-secondary)", fontWeight: 600 }}
          >+ Записать</button>
        </div>
        {pendingDividends.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Ожидают зачисления
            </div>
            {pendingDividends.map(d => (
              <div
                key={d.id}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 10px", borderRadius: 8, fontSize: 12, gap: 8,
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.25)",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div>
                    <span style={{ fontWeight: 700, color: "var(--accent-light)", marginRight: 6 }}>{d.ticker}</span>
                    {d.broker && (
                      <span style={{
                        fontSize: 9, marginRight: 6, padding: "1px 6px", borderRadius: 4,
                        background: "rgba(124,58,237,0.12)", color: "var(--accent-light)", fontWeight: 600,
                      }}>{d.broker}</span>
                    )}
                    <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{d.note}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {d.shares.toFixed(2)} × ${d.amountPerShare.toFixed(4)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontWeight: 700, color: "#f59e0b" }}>~${d.totalUSD.toFixed(2)}</span>
                  <button
                    onClick={() => onConfirmPending(d)}
                    title={d.broker ? `Зачислить на счёт ${d.broker}` : "Подтвердить получение"}
                    style={{
                      padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                      background: "#22c55e", color: "white", fontWeight: 700, fontSize: 11,
                      whiteSpace: "nowrap",
                    }}
                  >✓ Зачислить</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {receivedDividends.length === 0 ? (
          pendingDividends.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>
              Нет записей о полученных выплатах.
            </div>
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(divExpanded ? receivedDividends : receivedDividends.slice(0, 5)).map(d => (
              <div
                key={d.id}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12,
                  gap: 8,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div>
                    <span style={{ fontWeight: 700, color: "var(--accent-light)", marginRight: 6 }}>{d.ticker}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{d.date}</span>
                    {d.broker && (
                      <span style={{
                        fontSize: 9, marginLeft: 6, padding: "1px 6px", borderRadius: 4,
                        background: "rgba(124,58,237,0.12)", color: "var(--accent-light)", fontWeight: 600,
                      }}>{d.broker}</span>
                    )}
                    {d.source === "auto" && (
                      <span
                        title="Автоматически сгенерировано по покупке"
                        style={{
                          fontSize: 9, marginLeft: 6, padding: "1px 6px", borderRadius: 4,
                          background: "rgba(148,163,184,0.18)", color: "var(--text-muted)", fontWeight: 600,
                        }}
                      >авто</span>
                    )}
                  </div>
                  {d.note && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{d.note}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <span style={{ fontWeight: 700, color: "#22c55e" }}>+${d.totalUSD.toFixed(2)}</span>
                  <button
                    onClick={() => onEditClick(d)}
                    title="Редактировать"
                    style={{
                      background: "none", border: "none", cursor: "pointer", padding: "2px 4px",
                      color: "var(--accent-light)", fontSize: 12, lineHeight: 1, opacity: 0.7,
                    }}
                  >✎</button>
                  <button
                    onClick={() => onDeleteClick(d.id)}
                    title="Удалить"
                    style={{
                      background: "none", border: "none", cursor: "pointer", padding: "2px 4px",
                      color: "#ef4444", fontSize: 13, lineHeight: 1, opacity: 0.6,
                    }}
                  >✕</button>
                </div>
              </div>
            ))}
            {receivedDividends.length > 5 && (
              <button
                onClick={() => setDivExpanded(o => !o)}
                style={{ background: "none", border: "none", fontSize: 11, color: "var(--accent-light)", textAlign: "center", cursor: "pointer", fontWeight: 600, padding: "4px 0" }}
              >
                {divExpanded ? "Свернуть ▲" : `Ещё ${receivedDividends.length - 5} записей ▼`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
