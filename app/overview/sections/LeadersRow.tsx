"use client";

import { GaugeMeter } from "../components/GaugeMeter";

export interface Leader {
  id: number;
  ticker: string;
  dayChg: number;
  color: string;
}

export interface AssetSlice {
  name: string;
  value: number;
  color: string;
}

interface LeadersRowProps {
  quotesLoaded: boolean;
  growthLeaders: Leader[];
  declineLeaders: Leader[];
  assetDist: AssetSlice[];
  livePortfolioTotal: number;
  liveRiskScore: number;
}

const RISK_LEGEND = [
  { range: "0 – 25",   label: "Низкий",     color: "#22c55e" },
  { range: "25 – 50",  label: "Умеренный",  color: "#f59e0b" },
  { range: "50 – 75",  label: "Средний",    color: "#f97316" },
  { range: "75 – 100", label: "Высокий",    color: "#ef4444" },
];

function riskAdvice(score: number): { text: string; color: string } {
  if (score < 25) return { text: "Портфель консервативный. Можно рассмотреть добавление роста-активов для повышения доходности.", color: "#22c55e" };
  if (score < 50) return { text: "Умеренный риск — оптимальный баланс. Придерживайтесь текущей стратегии.", color: "#f59e0b" };
  if (score < 75) return { text: "Средний риск. Контролируйте волатильность, возможна частичная фиксация прибыли.", color: "#f97316" };
  return { text: "Высокий риск! Рекомендуется снизить долю волатильных активов и зафиксировать часть прибыли.", color: "#ef4444" };
}

export function LeadersRow({
  quotesLoaded,
  growthLeaders,
  declineLeaders,
  assetDist,
  livePortfolioTotal,
  liveRiskScore,
}: LeadersRowProps) {
  const advice = riskAdvice(liveRiskScore);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 12 }}>
      <div className="card">
        <div className="card-title">Лидеры роста сегодня</div>
        {!quotesLoaded ? (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Загрузка котировок…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {growthLeaders.filter(l => l.dayChg > 0).length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Нет позиций в плюсе</div>
            )}
            {growthLeaders.filter(l => l.dayChg > 0).map((l) => (
              <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: l.color }} />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{l.ticker}</span>
                </div>
                <span className="positive" style={{ fontSize: 13, fontWeight: 600 }}>+{l.dayChg.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Лидеры падения сегодня</div>
        {!quotesLoaded ? (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>Загрузка котировок…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {declineLeaders.filter(l => l.dayChg < 0).length === 0 && (
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Нет позиций в минусе</div>
            )}
            {declineLeaders.filter(l => l.dayChg < 0).map((l) => (
              <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: l.color }} />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{l.ticker}</span>
                </div>
                <span className="negative" style={{ fontSize: 13, fontWeight: 600 }}>{l.dayChg.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Распределение по классам</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {assetDist.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Нет позиций</div>
          ) : assetDist.map((s) => (
            <div key={s.name}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: "var(--text-secondary)" }}>{s.name}</span>
                <span style={{ fontWeight: 600 }}>{s.value}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${s.value}%`, background: s.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div className="card-title">Уровень риска портфеля</div>
        {livePortfolioTotal <= 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 120, gap: 6, color: "var(--text-muted)" }}>
            <div style={{ fontSize: 11, opacity: 0.6 }}>Нет позиций в портфеле</div>
          </div>
        ) : (
          <>
            <GaugeMeter value={liveRiskScore} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, width: "100%", marginTop: 8, fontSize: 11 }}>
              {RISK_LEGEND.map((item) => (
                <div key={item.range} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, display: "inline-block" }} />
                  <span style={{ color: "var(--text-secondary)" }}>{item.range}</span>
                  <span style={{ color: item.color }}>{item.label}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, padding: "8px 10px", background: `${advice.color}15`, borderRadius: 8, border: `1px solid ${advice.color}30`, width: "100%" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: advice.color, marginBottom: 3 }}>РЕКОМЕНДАЦИЯ</div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.4 }}>{advice.text}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
