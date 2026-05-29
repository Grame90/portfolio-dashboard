"use client";

import { BarChart, Bar, YAxis, ResponsiveContainer } from "recharts";

interface MiniBarChartProps {
  data: { date: string; value: number }[];
  positive?: boolean;
}

export function MiniBarChart({ data, positive = true }: MiniBarChartProps) {
  const slice = data.slice(-20);
  const min = Math.min(...slice.map(d => d.value));
  const normalized = slice.map(d => ({ ...d, value: d.value - min }));
  const color = positive ? "#7c3aed" : "#ef4444";
  return (
    <ResponsiveContainer width="100%" height={40}>
      <BarChart data={normalized} barSize={3}>
        <YAxis domain={[0, "auto"]} hide />
        <Bar dataKey="value" fill={color} radius={[1, 1, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
