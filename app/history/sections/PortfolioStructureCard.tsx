"use client";

import ApexChart from "@/components/ApexChart";
import type { DistributionSlice } from "../types";

interface PortfolioStructureCardProps {
  distribution: DistributionSlice[];
  liveTotal: number;
  hasPositions: boolean;
}

export function PortfolioStructureCard({ distribution, liveTotal, hasPositions }: PortfolioStructureCardProps) {
  return (
    <div className="card">
      <div className="card-title">Структура портфеля</div>
      {!hasPositions ? (
        <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 16, textAlign: "center" }}>Нет инструментов в портфеле</div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ApexChart
            type="donut"
            width={130}
            height={130}
            series={distribution.map(d => d.value)}
            options={{
              labels: distribution.map(d => d.name),
              colors: distribution.map(d => d.color),
              chart: { background: "transparent", animations: { enabled: true, speed: 400 } },
              stroke: { width: 2, colors: ["transparent"] },
              dataLabels: { enabled: false },
              legend: { show: false },
              plotOptions: { pie: { donut: { size: "62%", labels: { show: true, total: { show: true, label: "USD", fontSize: "9px", color: "#888", formatter: () => `${Math.round(liveTotal / 1000)}K` }, value: { show: false } } } } },
              tooltip: { theme: "dark", y: { formatter: (v: number) => `$${Number(v).toLocaleString("en-US")}` } },
              theme: { mode: "dark" },
            }}
          />
          <div style={{ flex: 1 }}>
            {distribution.map(item => (
              <div key={item.name} style={{ fontSize: 11, marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, display: "inline-block", flexShrink: 0 }} />
                  <span style={{ color: "var(--text-secondary)" }}>{item.name}</span>
                  <span style={{ marginLeft: "auto", fontWeight: 600 }}>{item.pct}</span>
                </div>
                <div style={{ color: "var(--text-muted)", paddingLeft: 10 }}>{item.value.toLocaleString("en-US")}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
