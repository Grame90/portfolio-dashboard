"use client";
import { useState, useEffect } from "react";

export type MarketState = "open" | "pre" | "post" | "closed";

export interface MarketStatus {
  state: MarketState;
  label: string;
  color: string;
  etTime: string;    // current ET time as "HH:MM"
  localTime: string; // current local time as "HH:MM"
  nextLabel: string; // e.g. "Пре-маркет в 12:00"
}

function etToLocal(etHour: number, etMin: number): string {
  // Convert a future ET wall-clock time to the local clock time string
  const now = new Date();
  const candidate = new Date(now);
  // Find what UTC offset ET currently has by comparing ET midnight to UTC midnight
  const etMidnight = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(now.toDateString()));
  void etMidnight; // just need the offset calculation below
  // Build a Date for today at the given ET time
  const etStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const [m, d, y] = etStr.split("/");
  // Create an ISO string for that ET time and parse it
  const isoET = `${y}-${m}-${d}T${String(etHour).padStart(2,"0")}:${String(etMin).padStart(2,"0")}:00`;
  // Convert ET → UTC by subtracting ET offset
  const tempDate = new Date(isoET + " ET"); // won't parse reliably; use offset approach
  void tempDate;
  // Reliable: take now's UTC ms, adjust so that ET time = etHour:etMin
  const nowET = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(candidate);
  const curETH = parseInt(nowET.find(p => p.type === "hour")?.value ?? "0", 10);
  const curETM = parseInt(nowET.find(p => p.type === "minute")?.value ?? "0", 10);
  const diffMin = (etHour * 60 + etMin) - (curETH * 60 + curETM);
  const target = new Date(candidate.getTime() + diffMin * 60000);
  const lp = new Intl.DateTimeFormat("default", { hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(target);
  const lh = lp.find(p => p.type === "hour")?.value ?? "00";
  const lm = lp.find(p => p.type === "minute")?.value ?? "00";
  return `${lh}:${lm}`;
}

function compute(): MarketStatus {
  const now = new Date();

  const etParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekday = etParts.find((p) => p.type === "weekday")?.value ?? "";
  const hour    = parseInt(etParts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
  const minute  = parseInt(etParts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const etTime  = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  const localParts = new Intl.DateTimeFormat("default", { hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const localH  = localParts.find(p => p.type === "hour")?.value ?? "00";
  const localM  = localParts.find(p => p.type === "minute")?.value ?? "00";
  const localTime = `${localH}:${localM}`;

  const total      = hour * 60 + minute;
  const isWeekend  = weekday === "Sat" || weekday === "Sun";

  const PRE   = 4 * 60;       // 04:00 ET
  const OPEN  = 9 * 60 + 30;  // 09:30 ET
  const CLOSE = 16 * 60;      // 16:00 ET
  const POST  = 20 * 60;      // 20:00 ET

  if (isWeekend) {
    return { state: "closed", label: "Закрыт (вых.)", color: "#ef4444", etTime, localTime, nextLabel: "" };
  }

  if (total >= OPEN && total < CLOSE) {
    return { state: "open",   label: "Открыт",      color: "#22c55e", etTime, localTime,
      nextLabel: `Закрытие в ${etToLocal(16, 0)}` };
  }
  if (total >= PRE && total < OPEN) {
    return { state: "pre",    label: "Пре-маркет",  color: "#f59e0b", etTime, localTime,
      nextLabel: `Открытие в ${etToLocal(9, 30)}` };
  }
  if (total >= CLOSE && total < POST) {
    return { state: "post",   label: "Постмаркет",  color: "#f59e0b", etTime, localTime,
      nextLabel: `Закрытие в ${etToLocal(20, 0)}` };
  }
  // Closed — show when pre-market starts
  const nextLocal = total < PRE ? etToLocal(4, 0) : etToLocal(4, 0); // next day handled by approximation
  return { state: "closed", label: "Закрыт", color: "#ef4444", etTime, localTime,
    nextLabel: `Пре-маркет в ${nextLocal}` };
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
