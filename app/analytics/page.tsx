"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import TabChart from "./TabChart";
import TabAnalytics from "./TabAnalytics";
import TabRisks from "./TabRisks";

type Tab = "chart" | "analytics" | "risks";

const TABS: { id: Tab; label: string }[] = [
  { id: "chart",     label: "Графики" },
  { id: "analytics", label: "Аналитика" },
  { id: "risks",     label: "Риски" },
];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("analytics");

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader title="АНАЛИТИКА" subtitle="Графики, глубокий анализ и управление рисками" />

      <div style={{
        display: "flex",
        padding: "0 24px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-secondary)",
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 20px",
              fontSize: 13,
              fontWeight: 600,
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === tab.id ? "var(--accent-light)" : "var(--text-secondary)",
              cursor: "pointer",
              transition: "color 0.15s",
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "chart"     && <TabChart />}
      {activeTab === "analytics" && <TabAnalytics />}
      {activeTab === "risks"     && <TabRisks />}
    </div>
  );
}
