"use client";

import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

type AssetEntry = { name: string; value: number; color: string };
type StressScenario = {
  scenario: string;
  lossPct: number;
  lossUsd: number;
  probability: string;
};
type FactorEntry = { factor: string; value: number };

type RiskSectionProps = {
  isMobile: boolean;
  liveAssetDist: AssetEntry[];
  liveVar1d: number;
  liveVar10d: number;
  liveEs: number;
  liveVol30d: string;
  liveConcentration: number;
  liveStressScenarios: StressScenario[];
  liveFactorExposure: FactorEntry[];
};

// Row 3: asset-types pie + risk analysis card + stress test table + factor bar
export default function RiskSection({
  isMobile,
  liveAssetDist,
  liveVar1d,
  liveVar10d,
  liveEs,
  liveVol30d,
  liveConcentration,
  liveStressScenarios,
  liveFactorExposure,
}: RiskSectionProps) {
  const riskMetrics = [
    { label: "VaR (1д, 95%)", value: `${liveVar1d}%`, level: liveVar1d < 2 ? "Низкий" : "Умеренный", color: liveVar1d < 2 ? "#22c55e" : "#f59e0b" },
    { label: "VaR (10д, 95%)", value: `${liveVar10d}%`, level: liveVar10d < 7 ? "Умеренный" : "Высокий", color: liveVar10d < 7 ? "#f59e0b" : "#ef4444" },
    { label: "Exp. Shortfall", value: `${liveEs}%`, level: liveEs < 3 ? "Низкий" : "Умеренный", color: liveEs < 3 ? "#22c55e" : "#f59e0b" },
    { label: "Волатильность", value: `${liveVol30d}%`, level: "Умеренный", color: "#f59e0b" },
    { label: "Концентрация", value: `${liveConcentration}%`, level: liveConcentration > 60 ? "Высокий" : "Умеренный", color: liveConcentration > 60 ? "#ef4444" : "#f59e0b" },
    { label: "Леверидж", value: "1.00x", level: "Низкий", color: "#22c55e" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 12 }}>
      <div className="card">
        <div className="card-title">Распределение по типам активов</div>
        <ResponsiveContainer width="100%" height={130}>
          <PieChart>
            <Pie data={liveAssetDist} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55}>
              {liveAssetDist.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }} formatter={(v: any) => [`${v}%`]} />
          </PieChart>
        </ResponsiveContainer>
        {liveAssetDist.map((e) => (
          <div key={e.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: e.color, display: "inline-block" }} />
              <span style={{ color: "var(--text-secondary)" }}>{e.name}</span>
            </span>
            <span style={{ fontWeight: 600 }}>{e.value}%</span>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Анализ риска</div>
        {riskMetrics.map((m) => (
          <div key={m.label} style={{ marginBottom: 8, fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
              <span style={{ color: "var(--text-secondary)", fontSize: isMobile ? 10 : 12 }}>{m.label}</span>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontWeight: 700, color: m.color, fontSize: isMobile ? 11 : 12 }}>{m.value}</span>
                <span style={{ fontSize: 9, color: m.color, marginLeft: 4 }}>{m.level}</span>
              </div>
            </div>
            <div className="progress-bar" style={{ width: "100%" }}>
              <div className="progress-fill" style={{ width: `${Math.abs(parseFloat(m.value)) * 5}%`, background: m.color }} />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Сценарный анализ (стресс-тест)</div>
        <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "4px 6px", textAlign: "left" }}>Сценарий</th>
              <th style={{ padding: "4px 6px", textAlign: "right" }}>Изменение</th>
              <th style={{ padding: "4px 6px", textAlign: "right" }}>Убыток</th>
            </tr>
          </thead>
          <tbody>
            {liveStressScenarios.map((s) => (
              <tr key={s.scenario} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "6px", color: "var(--text-secondary)", fontSize: 10 }}>{s.scenario.split("(")[0].trim()}</td>
                <td style={{ padding: "6px", textAlign: "right", color: s.lossPct >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                  {s.lossPct >= 0 ? "+" : ""}{s.lossPct.toFixed(1)}%
                </td>
                <td style={{ padding: "6px", textAlign: "right", color: s.lossUsd >= 0 ? "#22c55e" : "#ef4444" }}>
                  {s.lossUsd >= 0 ? "+" : ""}{(s.lossUsd / 1000).toFixed(0)}K
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Факторный анализ (Exposure)</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={liveFactorExposure} layout="vertical" barSize={10}>
            <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 9, fill: "#555577" }} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="factor" tick={{ fontSize: 9, fill: "#aaaacc" }} tickLine={false} axisLine={false} width={100} />
            <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }} />
            <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 10, fill: "#aaaacc" }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
