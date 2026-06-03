"use client";

import { useMarketIndicators } from "@/lib/useMarketIndicators";

// Fear & Greed pill for the page header — sits next to the "Стабильно" status
// and the КРИЗИС-АЛЕРТ badge. Reads the shared useMarketIndicators() hook
// (crypto Fear & Greed from alternative.me; no extra request).

const ZONES: { max: number; label: string; emoji: string }[] = [
  { max: 25, label: "Крайний страх", emoji: "😱" },
  { max: 45, label: "Страх", emoji: "😨" },
  { max: 55, label: "Нейтрально", emoji: "😐" },
  { max: 75, label: "Жадность", emoji: "🤑" },
  { max: 101, label: "Крайняя жадность", emoji: "🔥" },
];

export default function FearGreedBadge() {
  const { indicators } = useMarketIndicators();
  const fng = indicators.find((i) => i.key === "fng");
  if (!fng) return null;

  const value = Number(fng.value);
  if (!Number.isFinite(value)) return null;

  const zone = ZONES.find((z) => value < z.max) ?? ZONES[ZONES.length - 1];
  const c = fng.color;

  return (
    <div
      title={`Индекс страха и жадности (crypto): ${value} — ${zone.label}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "6px 12px", borderRadius: 999,
        background: `color-mix(in srgb, ${c} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${c} 45%, transparent)`,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 13, lineHeight: 1 }}>{zone.emoji}</span>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.05, alignItems: "flex-start" }}>
        <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.1em", color: "var(--text-muted)" }}>СТРАХ/ЖАДНОСТЬ</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: c }}>{value} · {zone.label}</span>
      </span>
    </div>
  );
}
