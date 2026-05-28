// Server-side proxy for publicly-viewable Google Sheets CSV export.
//
// Why we need this: docs.google.com doesn't send CORS headers on the CSV
// export endpoint, so client-side fetches fail with "Failed to fetch".
// We fetch from the server (no CORS) and pass the CSV back to the browser.

import { NextRequest, NextResponse } from "next/server";

const SHEET_ID_RE = /^[a-zA-Z0-9_-]{20,}$/;

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const gid = req.nextUrl.searchParams.get("gid") ?? "";
  if (!SHEET_ID_RE.test(id)) {
    return NextResponse.json({ error: "Bad sheet id" }, { status: 400 });
  }
  const url = new URL(
    `https://docs.google.com/spreadsheets/d/${id}/export`,
  );
  url.searchParams.set("format", "csv");
  if (gid) url.searchParams.set("gid", gid);

  try {
    const res = await fetch(url.toString(), {
      // Follow Google's redirect to the actual CSV
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            res.status === 404
              ? "Лист не найден"
              : "Лист не публичный — открой «Anyone with link can view»",
          status: res.status,
        },
        { status: res.status },
      );
    }
    const csv = await res.text();
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch failed" },
      { status: 502 },
    );
  }
}
