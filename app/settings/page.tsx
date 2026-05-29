"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useMobile } from "@/lib/useMobile";
import { SETTINGS_TABS } from "./constants";
import { ConnectionsTab } from "./tabs/ConnectionsTab";
import { NotificationsTab } from "./tabs/NotificationsTab";
import { RiskProfileTab } from "./tabs/RiskProfileTab";
import { PortfolioTab } from "./tabs/PortfolioTab";
import { DataTab } from "./tabs/DataTab";
import { AccountTab } from "./tabs/AccountTab";

type Tab = (typeof SETTINGS_TABS)[number];

export default function SettingsPage() {
  const isMobile = useMobile();
  const [activeTab, setActiveTab] = useState<Tab>("ПОДКЛЮЧЕНИЯ");

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader title="НАСТРОЙКИ" subtitle="Управление подключениями, уведомлениями и параметрами" />

      <div style={{ padding: isMobile ? "12px" : "16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {SETTINGS_TABS.map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, transition: "all 0.15s",
              background: activeTab === t ? "var(--accent)" : "var(--bg-card)",
              color: activeTab === t ? "white" : "var(--text-secondary)",
            }}>{t}</button>
          ))}
        </div>

        {activeTab === "ПОДКЛЮЧЕНИЯ" && <ConnectionsTab />}
        {activeTab === "УВЕДОМЛЕНИЯ" && <NotificationsTab />}
        {activeTab === "РИСК-ПРОФИЛЬ" && <RiskProfileTab />}
        {activeTab === "ПОРТФЕЛЬ" && <PortfolioTab />}
        {activeTab === "ДАННЫЕ" && <DataTab />}
        {activeTab === "АККАУНТ" && <AccountTab />}
      </div>
    </div>
  );
}
