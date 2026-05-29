import type { CSSProperties } from "react";

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-secondary)",
  color: "var(--text-primary)",
  fontSize: 13,
  boxSizing: "border-box",
};

export const selectStyle: CSSProperties = { ...inputStyle };

export const statusColor = (s: string): string =>
  s === "Активен" ? "#22c55e" : "#ef4444";

export const statusBg = (s: string): string =>
  s === "Активен" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";
