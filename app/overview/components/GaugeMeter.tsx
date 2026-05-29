"use client";

interface GaugeMeterProps {
  value: number;
  max?: number;
}

const ARC_DEFS = [
  { start: -180, end: -60, color: "#22c55e" },
  { start: -60, end: 60, color: "#f59e0b" },
  { start: 60, end: 180, color: "#ef4444" },
];

const toRad = (deg: number) => (deg * Math.PI) / 180;

function describeArc(cx: number, cy: number, startDeg: number, endDeg: number, radius: number): string {
  const s = toRad(startDeg);
  const e = toRad(endDeg);
  const x1 = cx + radius * Math.cos(s);
  const y1 = cy + radius * Math.sin(s);
  const x2 = cx + radius * Math.cos(e);
  const y2 = cy + radius * Math.sin(e);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
}

export function GaugeMeter({ value, max = 100 }: GaugeMeterProps) {
  const pct = value / max;
  const angle = pct * 180 - 90;
  const r = 60;
  const cx = 80;
  const cy = 80;
  const needleX = cx + r * Math.cos(toRad(angle - 90));
  const needleY = cy + r * Math.sin(toRad(angle - 90));

  return (
    <svg width={160} height={100} viewBox="0 0 160 100">
      {ARC_DEFS.map((arc, i) => (
        <path
          key={i}
          d={describeArc(cx, cy, arc.start, arc.end, 55)}
          fill="none"
          stroke={arc.color}
          strokeWidth={12}
          strokeLinecap="round"
        />
      ))}
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} style={{ stroke: "var(--text-primary)" }} strokeWidth={2} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={4} style={{ fill: "var(--text-primary)" }} />
      <text x={cx} y={cy + 18} textAnchor="middle" style={{ fill: "var(--text-primary)" }} fontSize={20} fontWeight={700}>{value}</text>
      <text x={cx} y={cy + 30} textAnchor="middle" style={{ fill: "var(--text-muted)" }} fontSize={9}>из 100</text>
    </svg>
  );
}
