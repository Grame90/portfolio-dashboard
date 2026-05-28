import { NextResponse } from "next/server";

// Returns FX rates as "X per 1 USD" for fiat (EUR, TRY, RUB) and
// "USD per 1 BTC" for BTC (so it reads naturally as a BTC price).
//
// Cached server-side for 30 minutes via Next's `revalidate` option.
//
// Shape:
//   { EUR: 0.92, TRY: 32.5, RUB: 93.2, BTC: 67000 }
//
// Legacy consumers reading only EUR/TRY/RUB continue to work.
export async function GET() {
  const FALLBACK = { EUR: 0.92, TRY: 32.5, RUB: 93.2, BTC: 60000 };

  try {
    const [fiatRes, btcRes] = await Promise.allSettled([
      fetch("https://open.er-api.com/v6/latest/USD", {
        next: { revalidate: 1800 },
      }),
      fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
        { next: { revalidate: 1800 } },
      ),
    ]);

    let EUR = FALLBACK.EUR;
    let TRY = FALLBACK.TRY;
    let RUB = FALLBACK.RUB;
    let BTC = FALLBACK.BTC;

    if (fiatRes.status === "fulfilled" && fiatRes.value.ok) {
      const data = await fiatRes.value.json();
      const rates = data.rates ?? {};
      EUR = rates.EUR ?? EUR;
      TRY = rates.TRY ?? TRY;
      RUB = rates.RUB ?? RUB;
    }
    if (btcRes.status === "fulfilled" && btcRes.value.ok) {
      const data = await btcRes.value.json();
      const price = data?.bitcoin?.usd;
      if (typeof price === "number" && price > 0) BTC = price;
    }

    return NextResponse.json({ EUR, TRY, RUB, BTC });
  } catch {
    return NextResponse.json(FALLBACK);
  }
}
