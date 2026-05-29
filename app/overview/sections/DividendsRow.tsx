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
  divExpanded: boolean;
  setDivExpanded: Dispatch<SetStateAction<boolean>>;
  onAddClick: () => void;
}

export function DividendsRow({
  isMobile,
  livePortfolioTotal,
  annualDivIncome,
  portfolioDivYield,
  ytdReceived,
  divPositions,
  receivedDividends,
  divExpanded,
  setDivExpanded,
  onAddClick,
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
        {receivedDividends.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>
            Нет записей о полученных выплатах.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(divExpanded ? receivedDividends : receivedDividends.slice(0, 5)).map(d => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                <div>
                  <span style={{ fontWeight: 700, color: "var(--accent-light)", marginRight: 6 }}>{d.ticker}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{d.date}</span>
                  {d.note && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{d.note}</div>}
                </div>
                <span style={{ fontWeight: 700, color: "#22c55e" }}>+${d.totalUSD.toFixed(2)}</span>
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
