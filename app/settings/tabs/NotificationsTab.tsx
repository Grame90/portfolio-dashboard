"use client";

import { useState, useEffect } from "react";
import { DEFAULT_NOTIFICATIONS, LS_NOTIFICATIONS, type NotificationItem } from "../constants";
import { useFlash } from "../useFlash";

export function NotificationsTab() {
  const { saved, flash } = useFlash();
  const [notifications, setNotifications] = useState<NotificationItem[]>(DEFAULT_NOTIFICATIONS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_NOTIFICATIONS);
      if (raw) {
        const stored: { id: string; enabled: boolean }[] = JSON.parse(raw);
        setNotifications(prev => prev.map(n => {
          const found = stored.find(s => s.id === n.id);
          return found ? { ...n, enabled: found.enabled } : n;
        }));
      }
    } catch {}
  }, []);

  function toggleNotification(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, enabled: !n.enabled } : n));
  }

  function saveNotifications() {
    try {
      localStorage.setItem(LS_NOTIFICATIONS, JSON.stringify(notifications.map(n => ({ id: n.id, enabled: n.enabled }))));
    } catch {}
    flash();
  }

  return (
    <div className="card" style={{ padding: 20, maxWidth: 680 }}>
      <div className="card-title">Настройки уведомлений</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {notifications.map((n, i) => (
          <div key={n.id} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 0", borderBottom: i < notifications.length - 1 ? "1px solid var(--border)" : "none",
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{n.label}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{n.description}</div>
            </div>
            <div onClick={() => toggleNotification(n.id)} style={{
              width: 44, height: 24, borderRadius: 12, cursor: "pointer", flexShrink: 0,
              background: n.enabled ? "var(--accent)" : "var(--bg-secondary)",
              border: "1px solid var(--border)", position: "relative", transition: "background 0.2s",
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%", background: "white",
                position: "absolute", top: 2, left: n.enabled ? 22 : 2,
                transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
        <button onClick={saveNotifications} style={{ padding: "10px 28px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "white" }}>
          Сохранить
        </button>
        {saved && <span style={{ fontSize: 12, color: "#22c55e" }}>{saved}</span>}
      </div>
    </div>
  );
}
