"use client";

import {
  BarChart, Bar, CartesianGrid,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import type { ReceivedDividend } from "@/app/overview/page";

type DivPosition = {
  id: string | number;
  ticker: string;
  yieldPct: number;
  annual: number;
  monthly: number;
  quarterly: number;
  val: number;
  qty: number;
};
type MonthlyDivPoint = { month: string; projected: number; received: number };

type DividendsSectionProps = {
  isMobile: boolean;
  annualDivIncome: number;
  portfolioDivYield: number;
  monthlyDivChart: MonthlyDivPoint[];
  divPositions: DivPosition[];
  receivedDividends: ReceivedDividend[];
};

// Row 4: monthly dividend bar chart + summary card + per-position table
export default function DividendsSection({
  isMobile,
  annualDivIncome,
  portfolioDivYield,
  monthlyDivChart,
  divPositions,
  receivedDividends,
}: DividendsSectionProps) {
  const currentYear = new Date().getFullYear().toString();
  const receivedYtd = Math.round(
    receivedDividends
      .filter((d) => d.date.startsWith(currentYear))
      .reduce((s, d) => s + d.totalUSD, 0)
  ).toLocaleString("en-US");

  const summary = [
    { label: "Годовой доход (оценка)", value: `$${Math.round(annualDivIncome).toLocaleString("en-US")}`, color: "#22c55e" },
    { label: "Доходность портфеля", value: `${portfolioDivYield.toFixed(2)}%`, color: "#22c55e" },
    { label: "Ежемесячно", value: `~$${Math.round(annualDivIncome / 12).toLocaleString("en-US")}` },
    { label: "Квартально", value: `~$${Math.round(annualDivIncome / 4).toLocaleString("en-US")}` },
    { label: "Дивидендных позиций", value: `${divPositions.length}` },
    { label: "Получено YTD", value: `$${receivedYtd}`, color: "#22c55e" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr 0.8fr 1fr", gap: 12 }}>
      {/* Monthly bar chart */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div className="card-title" style={{ margin: 0 }}>Дивидендный доход по месяцам</div>
          <div style={{ display: "flex", gap: 12, fontSize: 10, color: "var(--text-secondary)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--accent)", display: "inline-block" }} />Прогноз
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: "#22c55e", display: "inline-block" }} />Получено
            </span>
          </div>
        </div>
        {annualDivIncome === 0 ? (
          <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12 }}>
            Нет дивидендных позиций в портфеле
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyDivChart} barSize={10} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} width={36} />
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", fontSize: 11 }} formatter={(v: any) => [`$${Number(v).toLocaleString("en-US")}`]} />
              <Bar dataKey="projected" fill="var(--accent)" fillOpacity={0.5} radius={[3, 3, 0, 0]} name="Прогноз" />
              <Bar dataKey="received" fill="#22c55e" radius={[3, 3, 0, 0]} name="Получено" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary */}
      <div className="card">
        <div className="card-title">Дивидендная доходность</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {summary.map((item) => (
            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
              <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
              <span style={{ fontWeight: 700, color: (item as any).color ?? "var(--text-primary)" }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-position table */}
      <div className="card">
        <div className="card-title">Дивиденды по позициям</div>
        {divPositions.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>Нет дивидендных позиций</div>
        ) : (
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                {["Тикер", "Доходн.", "Год", "Квартал"].map((h) => (
                  <th key={h} style={{ padding: "4px 6px", textAlign: h === "Тикер" ? "left" : "right", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {divPositions.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "6px", fontWeight: 700, color: "var(--accent-light)" }}>{p.ticker}</td>
                  <td style={{ padding: "6px", textAlign: "right", color: "#22c55e", fontWeight: 600 }}>{p.yieldPct.toFixed(2)}%</td>
                  <td style={{ padding: "6px", textAlign: "right" }}>${Math.round(p.annual).toLocaleString("en-US")}</td>
                  <td style={{ padding: "6px", textAlign: "right", color: "var(--text-secondary)" }}>${Math.round(p.quarterly).toLocaleString("en-US")}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, background: "var(--bg-secondary)" }}>
                <td colSpan={2} style={{ padding: "6px", color: "var(--text-secondary)", fontSize: 10 }}>ИТОГО</td>
                <td style={{ padding: "6px", textAlign: "right" }}>${Math.round(annualDivIncome).toLocaleString("en-US")}</td>
                <td style={{ padding: "6px", textAlign: "right", color: "var(--text-secondary)" }}>${Math.round(annualDivIncome / 4).toLocaleString("en-US")}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
