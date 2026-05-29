"use client";

import { useState } from "react";
import { connections } from "@/lib/mockData";
import { useMobile } from "@/lib/useMobile";
import { statusBg, statusColor } from "../styles";

export function ConnectionsTab() {
  const isMobile = useMobile();
  const [connectionList, setConnectionList] = useState(connections);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({ ibkr: "", bybit: "" });
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12 }}>
        {connectionList.map((c) => (
          <div key={c.id} className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: c.color + "22", border: `2px solid ${c.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11, color: c.color }}>
                  {c.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{c.type}</div>
                </div>
              </div>
              <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: statusBg(c.status), color: statusColor(c.status) }}>
                {c.status}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 12 }}>{c.description}</div>
            {c.id !== "yahoo" && (
              <>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>API ключ</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <input
                    type={showKey[c.id] ? "text" : "password"}
                    placeholder="Введите API ключ..."
                    value={apiKeys[c.id] ?? ""}
                    onChange={(e) => setApiKeys((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 12 }}
                  />
                  <button onClick={() => setShowKey((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--text-secondary)", fontSize: 12 }}>
                    {showKey[c.id] ? "Скрыть" : "Показать"}
                  </button>
                </div>
              </>
            )}
            <button
              onClick={() => {
                const key = c.id === "yahoo" ? "yahoofinance" : apiKeys[c.id];
                if (!key || key.length < 10) { alert("Введите корректный API ключ (минимум 10 символов)"); return; }
                setConnectionList(prev => prev.map(x => x.id === c.id ? { ...x, status: x.status === "Активен" ? "Отключён" : "Активен" } : x));
              }}
              style={{ width: "100%", padding: 9, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: c.status === "Активен" ? "rgba(239,68,68,0.12)" : "var(--accent)", color: c.status === "Активен" ? "#ef4444" : "white" }}>
              {c.status === "Активен" ? "Отключить" : "Подключить"}
            </button>
          </div>
        ))}
      </div>
      <div className="card" style={{ padding: 16 }}>
        <div className="card-title">Как получить API ключи</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "var(--accent-light)" }}>Interactive Brokers</div>
            <ol style={{ color: "var(--text-secondary)", fontSize: 12, paddingLeft: 16, lineHeight: 2 }}>
              <li>Войдите в Client Portal IBKR</li><li>Перейдите в API → Web API</li>
              <li>Создайте новый API ключ</li><li>Скопируйте и вставьте выше</li>
            </ol>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#f59e0b" }}>Bybit</div>
            <ol style={{ color: "var(--text-secondary)", fontSize: 12, paddingLeft: 16, lineHeight: 2 }}>
              <li>Войдите в аккаунт Bybit</li><li>Профиль → API Management</li>
              <li>Create New Key (Read-only)</li><li>Скопируйте и вставьте выше</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
