"use client";

import { TABS } from "../constants";

interface ActionsTabsBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenEditor: () => void;
  onRefresh: () => void;
}

export function ActionsTabsBar({ activeTab, onTabChange, onOpenEditor, onRefresh }: ActionsTabsBarProps) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {TABS.map((t) => (
        <button
          key={t}
          onClick={() => onTabChange(t)}
          style={{
            padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
            background: activeTab === t ? "var(--accent)" : "var(--bg-card)",
            color: activeTab === t ? "white" : "var(--text-secondary)",
            transition: "all 0.15s",
          }}
        >
          {t}
        </button>
      ))}
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button
          onClick={onOpenEditor}
          style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid var(--accent)",
            cursor: "pointer", fontSize: 12, fontWeight: 600,
            background: "rgba(124,58,237,0.1)", color: "var(--accent)",
          }}
        >✎ Редактировать инструменты</button>
        <button
          onClick={onRefresh}
          style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)",
            cursor: "pointer", fontSize: 12, fontWeight: 600,
            background: "transparent", color: "var(--text-secondary)",
          }}
        >↻ Обновить список</button>
      </div>
    </div>
  );
}
