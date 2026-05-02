"use client";
import { useState, useEffect } from "react";

export type MarketState = "open" | "pre" | "post" | "closed";

export interface MarketStatus {
  state: MarketState;
  label: string;
  color: string;
  etTime: string; // current ET time as "HH:MM"
}

function compute(): MarketStatus {
  const now = new Date();

  // Get current time components in ET (handles EST/EDT automatically)
  const etParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekday = etParts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = parseInt(etParts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(etParts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const etTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  const total = hour * 60 + minute;
  const isWeekend = weekday === "Sat" || weekday === "Sun";

  if (isWeekend) {
    return { state: "closed", label: "Закрыт (вых.)", color: "#ef4444", etTime };
  }

  const PRE   = 4 * 60;       // 04:00 ET
  const OPEN  = 9 * 60 + 30;  // 09:30 ET
  const CLOSE = 16 * 60;      // 16:00 ET
  const POST  = 20 * 60;      // 20:00 ET

  if (total >= OPEN && total < CLOSE) {
    return { state: "open",   label: "Открыт",     color: "#22c55e", etTime };
  }
  if (total >= PRE && total < OPEN) {
    return { state: "pre",    label: "Пре-маркет",  color: "#f59e0b", etTime };
  }
  if (total >= CLOSE && total < POST) {
    return { state: "post",   label: "Постмаркет",  color: "#f59e0b", etTime };
  }
  return   { state: "closed", label: "Закрыт",      color: "#ef4444", etTime };
}

export function useMarketStatus(): MarketStatus {
  const [status, setStatus] = useState<MarketStatus>(compute);

  useEffect(() => {
    // refresh every 30 s — cheap, keeps ET clock accurate
    const id = setInterval(() => setStatus(compute()), 30_000);
    return () => clearInterval(id);
  }, []);

  return status;
}

/** Format a Unix timestamp (seconds) as "HH:MM ET" in Eastern Time */
export function formatEtTime(unixSec: number): string {
  if (!unixSec) return "";
  const d = new Date(unixSec * 1000);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d) + " ET";
}
