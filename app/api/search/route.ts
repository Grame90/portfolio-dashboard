import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.FINNHUB_API_KEY!;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const type = req.nextUrl.searchParams.get("type") ?? "stock"; // "stock" | "crypto"
  if (!q || q.length < 1) return NextResponse.json([]);

  if (type === "crypto") {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`,
        { next: { revalidate: 60 } }
      );
      if (!res.ok) throw new Error("CoinGecko error");
      const data = await res.json();

      const results = (data.coins ?? [])
        .slice(0, 8)
        .map((c: { symbol: string; name: string; market_cap_rank: number }) => ({
          symbol: c.symbol.toUpperCase(),
          description: c.name,
          type: "Крипто",
          rank: c.market_cap_rank,
        }))
        .sort((a: { rank: number }, b: { rank: number }) => (a.rank ?? 9999) - (b.rank ?? 9999));

      return NextResponse.json(results);
    } catch {
      return NextResponse.json([]);
    }
  }

  // Default: Finnhub stock search
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${API_KEY}`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) throw new Error("Finnhub error");
    const data = await res.json();

    const results = (data.result ?? [])
      .filter((item: { type: string; symbol: string }) =>
        ["Common Stock", "ETP", "ETF"].includes(item.type) &&
        !item.symbol.includes(".")
      )
      .slice(0, 8)
      .map((item: { symbol: string; description: string; type: string }) => ({
        symbol: item.symbol,
        description: item.description,
        type: item.type,
      }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
