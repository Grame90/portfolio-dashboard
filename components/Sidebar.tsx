"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Eye, List, BarChart2, History,
  AlertTriangle, Zap, Target, Settings, TrendingUp,
  Palette, FileText, MoreHorizontal, X,
} from "lucide-react";
import { useMobile } from "@/lib/useMobile";
import { useApp } from "@/lib/AppContext";
import { LogOut } from "lucide-react";

const navItems = [
  { href: "/portfolio",  icon: LayoutDashboard, label: "Портфель" },
  { href: "/overview",   icon: Eye,             label: "Обзор" },
  { href: "/positions",  icon: List,            label: "Позиции" },
  { href: "/analytics",  icon: BarChart2,       label: "Аналитика" },
  { href: "/history",    icon: History,         label: "История" },
  { href: "/risks",      icon: AlertTriangle,   label: "Риски" },
  { href: "/triggers",   icon: Zap,             label: "Триггеры" },
  { href: "/actions",    icon: Target,          label: "Действия" },
  { href: "/strategy",   icon: TrendingUp,      label: "Стратегия" },
  { href: "/report",     icon: FileText,        label: "Отчёт" },
  { href: "/settings",   icon: Settings,        label: "Настройки" },
];

// Items shown directly in bottom bar
const BOTTOM_NAV = ["/portfolio", "/positions", "/analytics", "/strategy", "/settings"];

const THEMES = [
  { id: "purple", label: "Фиолет", color: "#7c3aed" },
  { id: "blue",   label: "Синий",  color: "#1d6ef5" },
  { id: "green",  label: "Зелёный", color: "#16a34a" },
  { id: "amber",  label: "Янтарь", color: "#d97706" },
] as const;

type ColorId = (typeof THEMES)[number]["id"];
type ThemeId = ColorId | `light-${ColorId}`;

const LIGHT_BASE: Record<string, string> = {
  "--bg-primary": "#f0f2f8", "--bg-secondary": "#e5e8f4", "--bg-card": "#ffffff",
  "--bg-card-hover": "#f7f8fc", "--border": "#d0d4e8",
  "--text-primary": "#0d0d22", "--text-secondary": "#4a5070", "--text-muted": "#8890b0",
  "--green": "#16a34a", "--red": "#dc2626", "--yellow": "#b45309", "--blue": "#1d4ed8",
};

const THEME_VARS: Record<ThemeId, Record<string, string>> = {
  purple: {
    "--bg-primary": "#0a0a1a", "--bg-secondary": "#111128", "--bg-card": "#141430",
    "--bg-card-hover": "#1a1a38", "--border": "#1e1e45", "--accent": "#7c3aed",
    "--accent-light": "#9d6ef5", "--text-primary": "#ffffff", "--text-secondary": "#8888aa",
    "--text-muted": "#555577",
    "--green": "#22c55e", "--red": "#ef4444", "--yellow": "#f59e0b", "--blue": "#3b82f6",
  },
  blue: {
    "--bg-primary": "#04080f", "--bg-secondary": "#080f1c", "--bg-card": "#0c1628",
    "--bg-card-hover": "#101e35", "--border": "#162040", "--accent": "#1d6ef5",
    "--accent-light": "#5a96f8", "--text-primary": "#e8f0ff", "--text-secondary": "#7a90b8",
    "--text-muted": "#455570",
    "--green": "#22c55e", "--red": "#ef4444", "--yellow": "#f59e0b", "--blue": "#3b82f6",
  },
  green: {
    "--bg-primary": "#020d06", "--bg-secondary": "#04140a", "--bg-card": "#071a0e",
    "--bg-card-hover": "#0c2216", "--border": "#0f2d1b", "--accent": "#16a34a",
    "--accent-light": "#22c55e", "--text-primary": "#e8ffe8", "--text-secondary": "#6a9a78",
    "--text-muted": "#3a5a45",
    "--green": "#22c55e", "--red": "#ef4444", "--yellow": "#f59e0b", "--blue": "#3b82f6",
  },
  amber: {
    "--bg-primary": "#0a0800", "--bg-secondary": "#130f02", "--bg-card": "#1a1403",
    "--bg-card-hover": "#221b05", "--border": "#2d2408", "--accent": "#d97706",
    "--accent-light": "#f59e0b", "--text-primary": "#fff8e8", "--text-secondary": "#a08858",
    "--text-muted": "#605030",
    "--green": "#22c55e", "--red": "#ef4444", "--yellow": "#f59e0b", "--blue": "#3b82f6",
  },
  "light-purple": { ...LIGHT_BASE, "--accent": "#6d28d9", "--accent-light": "#7c3aed" },
  "light-blue":   { ...LIGHT_BASE, "--accent": "#1d4ed8", "--accent-light": "#2563eb" },
  "light-green":  { ...LIGHT_BASE, "--accent": "#15803d", "--accent-light": "#16a34a" },
  "light-amber":  { ...LIGHT_BASE, "--accent": "#b45309", "--accent-light": "#d97706" },
};

function applyThemeVars(id: ThemeId) {
  const vars = THEME_VARS[id];
  if (!vars) return;
  const el = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
}

export default function Sidebar() {
  const pathname = usePathname();
  const isMobile = useMobile();
  const { user, signOut } = useApp();
  const [theme, setTheme] = useState<ThemeId>("purple");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("dashboard-theme") ?? "purple";
    const saved = (raw === "light" ? "light-purple" : raw) as ThemeId;
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
    applyThemeVars(saved);

    function tick() {
      const now = new Date();
      const d = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
      const t = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      setUpdatedAt(`${d} ${t}`);
    }
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  function applyTheme(id: ThemeId) {
    setTheme(id);
    setPickerOpen(false);
    document.documentElement.setAttribute("data-theme", id);
    applyThemeVars(id);
    localStorage.setItem("dashboard-theme", id);
  }

  const isDark = !theme.startsWith("light-");
  const colorId: ColorId = isDark ? (theme as ColorId) : (theme.replace("light-", "") as ColorId);

  function toggleDarkLight() {
    applyTheme(isDark ? `light-${colorId}` : colorId);
  }

  const activeTheme = THEMES.find((t) => t.id === colorId) ?? THEMES[0];

  // ─── Mobile bottom nav ───────────────────────────────────────────────────
  if (isMobile) {
    const bottomItems = navItems.filter(item => BOTTOM_NAV.includes(item.href));

    return (
      <>
        {/* Full-screen menu overlay */}
        {menuOpen && (
          <div
            style={{
              position: "fixed", inset: 0, zIndex: 200,
              background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
            }}
            onClick={() => setMenuOpen(false)}
          >
            <div
              style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                background: "var(--bg-secondary)",
                borderTop: "1px solid var(--border)",
                borderRadius: "20px 20px 0 0",
                padding: "20px 16px 32px",
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Навигация</span>
                <button onClick={() => setMenuOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <X size={20} color="var(--text-secondary)" />
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
                {navItems.map(({ href, icon: Icon, label }) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href} href={href}
                      onClick={() => setMenuOpen(false)}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                        padding: "12px 8px", borderRadius: 12, textDecoration: "none",
                        background: active ? "rgba(124,58,237,0.15)" : "var(--bg-card)",
                        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                      }}
                    >
                      <Icon size={20} color={active ? "var(--accent-light)" : "var(--text-secondary)"} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: active ? "var(--accent-light)" : "var(--text-secondary)", textAlign: "center" }}>
                        {label}
                      </span>
                    </Link>
                  );
                })}
              </div>

              {/* Theme controls */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {THEMES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => applyTheme(isDark ? t.id : `light-${t.id}`)}
                      style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: t.color, border: colorId === t.id ? `3px solid var(--text-primary)` : "3px solid transparent",
                        cursor: "pointer",
                      }}
                    />

                  ))}
                </div>
                <button
                  onClick={toggleDarkLight}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                    borderRadius: 20, border: "1px solid var(--border)",
                    background: "var(--bg-card)", cursor: "pointer",
                    fontSize: 12, color: "var(--text-secondary)",
                  }}
                >
                  {isDark ? "🌙 Тёмная" : "☀️ Светлая"}
                </button>
              </div>

              {/* Account + logout */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                  {user?.email ?? ""}
                </div>
                <button
                  onClick={() => { setMenuOpen(false); signOut(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                    borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)",
                    background: "rgba(239,68,68,0.08)", cursor: "pointer",
                    fontSize: 12, fontWeight: 600, color: "#ef4444", whiteSpace: "nowrap",
                  }}
                >
                  <LogOut size={14} />
                  Выйти
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom navigation bar */}
        <nav style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
          height: 60,
          background: "var(--bg-secondary)",
          borderTop: "1px solid var(--border)",
          display: "flex", alignItems: "stretch",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}>
          {bottomItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href} href={href}
                style={{
                  flex: 1, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 3,
                  textDecoration: "none",
                  borderTop: active ? "2px solid var(--accent)" : "2px solid transparent",
                  background: active ? "rgba(124,58,237,0.08)" : "transparent",
                }}
              >
                <Icon size={20} color={active ? "var(--accent-light)" : "var(--text-muted)"} />
                <span style={{ fontSize: 10, fontWeight: 600, color: active ? "var(--accent-light)" : "var(--text-muted)" }}>
                  {label}
                </span>
              </Link>
            );
          })}
          {/* More button */}
          <button
            onClick={() => setMenuOpen(true)}
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 3,
              background: "none", border: "none", cursor: "pointer",
              borderTop: "2px solid transparent",
            }}
          >
            <MoreHorizontal size={20} color="var(--text-muted)" />
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)" }}>Ещё</span>
          </button>
        </nav>
      </>
    );
  }

  // ─── Desktop sidebar ─────────────────────────────────────────────────────
  return (
    <aside style={{
      width: 72, minHeight: "100vh",
      background: "var(--bg-secondary)", borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "16px 0", position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 50,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: "var(--accent)",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24,
      }}>
        <TrendingUp size={20} color="white" />
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, width: "100%" }}>
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} title={label} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 3, padding: "8px 4px", borderRadius: 8, margin: "0 6px",
              textDecoration: "none",
              background: active ? "rgba(124,58,237,0.2)" : "transparent",
              borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "all 0.15s",
            }}>
              <Icon size={18} color={active ? "var(--accent-light)" : "#555577"} />
              <span style={{ fontSize: 9, fontWeight: 600, color: active ? "var(--accent-light)" : "#555577", textAlign: "center", lineHeight: 1 }}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", padding: "12px 0", textAlign: "center", width: "100%", position: "relative" }}>
        <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 4 }}>{isDark ? "Тёмная" : "Светлая"}</div>
        <button onClick={toggleDarkLight} title={isDark ? "Светлая тема" : "Тёмная тема"} style={{
          width: 36, height: 18, borderRadius: 9,
          background: isDark ? "var(--accent)" : "#d0d4e8",
          margin: "0 auto", position: "relative", border: "none", cursor: "pointer",
          display: "block", transition: "background 0.2s",
        }}>
          <div style={{
            width: 12, height: 12, borderRadius: "50%", background: "white",
            position: "absolute", top: 3,
            left: isDark ? "calc(100% - 15px)" : 3,
            transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }} />
        </button>

        <div style={{ marginTop: 10, position: "relative" }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 4 }}>Дизайн</div>
          <button onClick={() => setPickerOpen(o => !o)} title="Сменить тему" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
            margin: "0 auto", background: "var(--bg-card)",
            border: "1px solid var(--border)", borderRadius: 8,
            padding: "5px 8px", cursor: "pointer",
          }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: activeTheme.color, flexShrink: 0 }} />
            <Palette size={11} color="var(--text-muted)" />
          </button>

          {pickerOpen && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
              transform: "translateX(-50%)",
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 10, padding: 8,
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
              zIndex: 100, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", minWidth: 120,
            }}>
              {THEMES.map(t => (
                <button key={t.id} onClick={() => applyTheme(isDark ? t.id : `light-${t.id}`)} title={t.label} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  padding: "6px 4px", borderRadius: 7,
                  border: colorId === t.id ? `1.5px solid ${t.color}` : "1.5px solid transparent",
                  background: colorId === t.id ? `${t.color}22` : "transparent",
                  cursor: "pointer",
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", background: t.color,
                    boxShadow: colorId === t.id ? `0 0 0 2px ${t.color}55` : "none",
                  }} />
                  <span style={{ fontSize: 8, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{t.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {updatedAt && (
          <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 8 }}>
            Обновлено<br />{updatedAt}
          </div>
        )}

        <button
          onClick={() => signOut()}
          title={`Выйти (${user?.email ?? ""})`}
          style={{
            marginTop: 10, width: 36, height: 36, borderRadius: 8,
            border: "1px solid rgba(239,68,68,0.25)",
            background: "rgba(239,68,68,0.07)",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <LogOut size={15} color="#ef4444" />
        </button>
      </div>
    </aside>
  );
}
