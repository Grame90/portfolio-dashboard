import { NextResponse } from "next/server";
export async function GET() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 1800 } });
    if (!res.ok) throw new Error("rates error");
    const data = await res.json();
    const rates = data.rates ?? {};
    return NextResponse.json({ EUR: rates.EUR ?? 0.92, TRY: rates.TRY ?? 32.5, RUB: rates.RUB ?? 93.2 });
  } catch {
    return NextResponse.json({ EUR: 0.92, TRY: 32.5, RUB: 93.2 });
  }
}
