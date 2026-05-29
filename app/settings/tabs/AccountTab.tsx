"use client";

import { inputStyle } from "../styles";
import { useFlash } from "../useFlash";

export function AccountTab() {
  const { saved, flash } = useFlash();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div className="card" style={{ padding: 20 }}>
        <div className="card-title">Профиль</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { label: "Имя", value: "Ramil Guliyev" },
            { label: "Email", value: "gramevlog12345@gmail.com" },
            { label: "Телефон", value: "+90 (555) 000-0000" },
            { label: "Часовой пояс", value: "Europe/Istanbul (UTC+3)" },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>{f.label}</div>
              <input defaultValue={f.value} style={inputStyle} />
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => flash()} style={{ padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "white" }}>
              Сохранить профиль
            </button>
            {saved && <span style={{ fontSize: 12, color: "#22c55e" }}>{saved}</span>}
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: 20 }}>
        <div className="card-title">Безопасность</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {["Текущий пароль", "Новый пароль", "Подтверждение пароля"].map(lbl => (
            <div key={lbl}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>{lbl}</div>
              <input type="password" placeholder="••••••••" style={inputStyle} />
            </div>
          ))}
          <button onClick={() => flash()} style={{ padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "var(--accent)", color: "white" }}>
            Изменить пароль
          </button>
          <div style={{ padding: 12, borderRadius: 8, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#22c55e", marginBottom: 4 }}>Двухфакторная аутентификация</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Защитите аккаунт с помощью 2FA</div>
            <button style={{ marginTop: 8, padding: "6px 14px", borderRadius: 6, border: "1px solid #22c55e", cursor: "pointer", fontSize: 11, fontWeight: 600, background: "transparent", color: "#22c55e" }}>
              Включить 2FA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
