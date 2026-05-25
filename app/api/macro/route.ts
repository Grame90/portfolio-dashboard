import { NextResponse } from "next/server";

const UA = "Mozilla/5.0 (compatible; portfolio-dashboard/1.0)";

// ── FRED CSV (no API key needed) ─────────────────────────────────────────────

async function fredCsv(id: string, months = 15): Promise<{ date: string; value: number }[]> {
  try {
    const from = new Date();
    from.setMonth(from.getMonth() - months);
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}&observation_start=${from.toISOString().slice(0, 10)}`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const text = await res.text();
    return text.trim().split("\n").slice(1)
      .map(line => { const [date, val] = line.split(","); return { date: date.trim(), value: parseFloat(val) }; })
      .filter(r => !isNaN(r.value));
  } catch {
    return [];
  }
}

// ── Yahoo Finance quote ───────────────────────────────────────────────────────

async function yahooPrice(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d`,
      { headers: { "User-Agent": UA }, next: { revalidate: 900 } },
    );
    if (!res.ok) return null;
    const d = await res.json();
    const price = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" && price > 0 ? price : null;
  } catch {
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type Impact = "Положительное" | "Нейтральное" | "Отрицательное";

function calcImpact(kind: string, value: number): Impact {
  if (kind === "fed")          return value < 3.5 ? "Положительное" : value < 5 ? "Нейтральное" : "Отрицательное";
  if (kind === "cpi")          return value < 3   ? "Положительное" : value < 5 ? "Нейтральное" : "Отрицательное";
  if (kind === "unemployment") return value < 4   ? "Положительное" : value < 5 ? "Нейтральное" : "Отрицательное";
  if (kind === "gdp")          return value >= 2.5 ? "Положительное" : value >= 1 ? "Нейтральное" : "Отрицательное";
  return "Нейтральное";
}

function trend(value: number, neutral: [number, number]): string {
  if (value < neutral[0]) return "↓";
  if (value > neutral[1]) return "↑";
  return "→";
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const [fedRes, cpiRes, unrateRes, gdpRes, sp500Res, goldRes] = await Promise.allSettled([
    fredCsv("FEDFUNDS", 3),                // monthly Fed funds rate
    fredCsv("CPIAUCSL", 15),               // CPI index — compute YoY from 13 months
    fredCsv("UNRATE", 3),                  // monthly unemployment rate
    fredCsv("A191RL1Q225SBEA", 6),         // Real GDP % change (quarterly, annualized)
    yahooPrice("^GSPC"),                    // S&P 500 index
    yahooPrice("GC=F"),                     // Gold futures
  ]);

  // Fed Rate
  const fedArr = fedRes.status === "fulfilled" ? fedRes.value : [];
  const fed    = fedArr.at(-1)?.value ?? null;

  // CPI YoY
  const cpiArr    = cpiRes.status === "fulfilled" ? cpiRes.value : [];
  const cpiLast   = cpiArr.at(-1)?.value ?? null;
  const cpiYearAgo = cpiArr.length >= 13 ? cpiArr[cpiArr.length - 13]?.value ?? null : null;
  const cpiYoY    = cpiLast && cpiYearAgo ? ((cpiLast - cpiYearAgo) / cpiYearAgo) * 100 : null;

  // Unemployment
  const unrateArr = unrateRes.status === "fulfilled" ? unrateRes.value : [];
  const unrate    = unrateArr.at(-1)?.value ?? null;

  // GDP
  const gdpArr = gdpRes.status === "fulfilled" ? gdpRes.value : [];
  const gdp    = gdpArr.at(-1)?.value ?? null;

  // S&P 500 + Gold
  const sp500 = sp500Res.status === "fulfilled" ? sp500Res.value : null;
  const gold  = goldRes.status === "fulfilled"  ? goldRes.value  : null;

  const factors = [
    {
      factor:   "Инфляция (CPI)",
      current:  cpiYoY !== null ? `${cpiYoY.toFixed(1)}%` : "—",
      forecast: cpiYoY !== null ? `${trend(cpiYoY, [2, 3])} ${cpiYoY > 3 ? "снижение к цели" : "у цели ФРС"}` : "—",
      impact:   cpiYoY !== null ? calcImpact("cpi", cpiYoY) : "Нейтральное" as Impact,
    },
    {
      factor:   "Ставка ФРС",
      current:  fed !== null ? `${fed.toFixed(2)}%` : "—",
      forecast: fed !== null ? `${trend(fed, [3, 4.5])} ${fed > 4 ? "возможное снижение" : fed < 3 ? "риск повышения" : "стабильно"}` : "—",
      impact:   fed !== null ? calcImpact("fed", fed) : "Нейтральное" as Impact,
    },
    {
      factor:   "ВВП (США)",
      current:  gdp !== null ? `${gdp.toFixed(1)}%` : "—",
      forecast: gdp !== null ? `${trend(gdp, [1.5, 3])} ${gdp >= 2 ? "умеренный рост" : "замедление"}` : "—",
      impact:   gdp !== null ? calcImpact("gdp", gdp) : "Нейтральное" as Impact,
    },
    {
      factor:   "Безработица",
      current:  unrate !== null ? `${unrate.toFixed(1)}%` : "—",
      forecast: unrate !== null ? `${trend(unrate, [3.5, 4.5])} ${unrate > 4.5 ? "рост" : "стабильно"}` : "—",
      impact:   unrate !== null ? calcImpact("unemployment", unrate) : "Нейтральное" as Impact,
    },
    {
      factor:   "S&P 500",
      current:  sp500 !== null ? sp500.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—",
      forecast: "—",
      impact:   "Положительное" as Impact,
    },
    {
      factor:   "Цена золота",
      current:  gold !== null ? `$${gold.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—",
      forecast: "—",
      impact:   "Положительное" as Impact,
    },
  ];

  return NextResponse.json(
    { factors, updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=600" } },
  );
}
