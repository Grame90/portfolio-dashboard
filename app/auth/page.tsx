"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMobile } from "@/lib/useMobile";
import { useApp } from "@/lib/useApp";

export default function AuthPage() {
  const { signIn, signUp } = useApp();
  const isMobile = useMobile();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password.trim()) {
      setError("Заполните email и пароль");
      return;
    }
    if (password.length < 6) {
      setError("Пароль минимум 6 символов");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setLoading(true);
    const err = mode === "login"
      ? await signIn(email, password)
      : await signUp(email, password);
    setLoading(false);

    if (err) {
      if (err.includes("Invalid login")) setError("Неверный email или пароль");
      else if (err.includes("already registered")) setError("Email уже зарегистрирован");
      else if (err.includes("valid email")) setError("Введите корректный email");
      else setError(err);
      return;
    }

    if (mode === "register") {
      setSuccess("Аккаунт создан! Проверьте почту для подтверждения, затем войдите.");
      setMode("login");
    } else {
      router.push("/");
      router.refresh();
    }
  }

  const input: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    border: "1px solid #2a2a4a", background: "#0e0e28",
    color: "#ffffff", fontSize: 14, boxSizing: "border-box",
    outline: "none",
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(ellipse at 60% 30%, #1a0a3a 0%, #0a0a1a 60%)",
    }}>
      {/* Background glow */}
      <div style={{
        position: "fixed", top: "20%", left: "50%", transform: "translateX(-50%)",
        width: 600, height: 300, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        width: isMobile ? "calc(100vw - 32px)" : 400, padding: isMobile ? "28px 20px" : "40px 36px",
        background: "#111128", borderRadius: 20,
        border: "1px solid #1e1e45",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        position: "relative", zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, margin: "0 auto 14px",
          }}>
            📈
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", letterSpacing: "0.02em" }}>
            Portfolio Tracker
          </div>
          <div style={{ fontSize: 12, color: "#8888aa", marginTop: 4 }}>
            Управление инвестиционным портфелем
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", background: "#0a0a1a", borderRadius: 10, padding: 4, marginBottom: 28 }}>
          {(["login", "register"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(null); setSuccess(null); }} style={{
              flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, transition: "all 0.15s",
              background: mode === m ? "#7c3aed" : "transparent",
              color: mode === m ? "white" : "#8888aa",
            }}>
              {m === "login" ? "Войти" : "Регистрация"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: "#8888aa", marginBottom: 6, fontWeight: 600 }}>EMAIL</div>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" autoComplete="email"
              style={input}
            />
          </div>

          <div>
            <div style={{ fontSize: 11, color: "#8888aa", marginBottom: 6, fontWeight: 600 }}>ПАРОЛЬ</div>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete={mode === "login" ? "current-password" : "new-password"}
              style={input}
            />
          </div>

          {mode === "register" && (
            <div>
              <div style={{ fontSize: 11, color: "#8888aa", marginBottom: 6, fontWeight: 600 }}>ПОВТОРИТЕ ПАРОЛЬ</div>
              <input
                type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••" autoComplete="new-password"
                style={input}
              />
            </div>
          )}

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontSize: 13 }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e", fontSize: 13 }}>
              {success}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            padding: "12px", borderRadius: 10, border: "none", cursor: loading ? "wait" : "pointer",
            fontSize: 14, fontWeight: 700, marginTop: 4,
            background: loading ? "#4a2a8a" : "linear-gradient(135deg, #7c3aed, #5b21b6)",
            color: "white", opacity: loading ? 0.8 : 1,
            transition: "all 0.15s",
          }}>
            {loading ? "Загрузка…" : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 12, color: "#555577" }}>
          Данные защищены и хранятся в облаке
        </div>
      </div>
    </div>
  );
}
