// Shared portfolio data — single dataset for ALL users.
//
// Everyone who is logged in reads and writes the SAME row in `user_data`
// (keyed by a fixed SHARED_ID). We use the Supabase SERVICE ROLE key here,
// server-side only, so it bypasses per-user RLS. The key never reaches the
// browser. Middleware still gates this route behind auth.
//
// SHARED_ID = the original owner's user_id, so the existing portfolio becomes
// the shared dataset.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SHARED_ID = "e15a6730-6262-4921-b429-a66455c85dd7";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Columns we sync (mirror useAuthStore payload).
const SYNC_COLUMNS = [
  "positions",
  "settings",
  "portfolio_chart_history",
  "dividends_received",
  "snapshots_data",
  "target_structure",
  "dashboard_notifications",
] as const;

export async function GET() {
  const db = admin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const { data, error } = await db
    .from("user_data")
    .select("*")
    .eq("user_id", SHARED_ID)
    .single();
  // PGRST116 = no row yet; treat as empty.
  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? null });
}

export async function POST(req: NextRequest) {
  const db = admin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const row: Record<string, unknown> = {
    user_id: SHARED_ID,
    updated_at: new Date().toISOString(),
  };
  for (const col of SYNC_COLUMNS) {
    if (col in body) row[col] = body[col];
  }

  const { error } = await db.from("user_data").upsert(row, { onConflict: "user_id" });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Clear the shared dataset (used by Settings → "Reset all data").
export async function DELETE() {
  const db = admin();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const { error } = await db.from("user_data").delete().eq("user_id", SHARED_ID);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
