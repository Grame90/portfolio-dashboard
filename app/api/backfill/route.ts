import { NextRequest, NextResponse } from "next/server";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY!;
const FMP_KEY = process.env.FMP_API_KEY!;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function POST(req: NextRequest) {
  const { positions } = await req.json();
  if (!positions?.length) return NextResponse.json({ chartHistory: [], dividendHistory: [] });

  const stocks = positions.filter((p: any) => p.type !== "Кэш" && p.type !== "Крипто");

  // Find earliest purchase date across all positions
  const purchaseDates = positions.map((p: any) => p.purchaseDate).filter(Boolean).sort();
  const startDate = purchaseDates[0] || new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const fromTs = Math.floor(new Date(startDate).getTime() / 1000);
  const toTs = Math.floor(Date.now() / 1000);
  const todayStr = new Date().toISOString().slice(0, 10);

  // Fetch historical daily prices for each stock/ETF in parallel (batched)
  const priceByDateByTicker: Record<string, Record<string, number>> = {};

  const fetchPrice = async (ticker: string) => {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${fromTs}&to=${toTs}&token=${FINNHUB_KEY}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.s !== "ok" || !data.c?.length) return;
      data.c.forEach((close: number, i: number) => {
        const date = new Date(data.t[i] * 1000).toISOString().slice(0, 10);
        if (!priceByDateByTicker[date]) priceByDateByTicker[date] = {};
        priceByDateByTicker[date][ticker] = close;
      });
    } catch {}
  };

  // Batch in groups of 5 to avoid rate limits
  for (let i = 0; i < stocks.length; i += 5) {
    await Promise.all(stocks.slice(i, i + 5).map((p: any) => fetchPrice(p.ticker)));
    if (i + 5 < stocks.length) await sleep(500);
  }

  // Build daily portfolio values
  const allDates = Object.keys(priceByDateByTicker).sort();
  const chartHistory = allDates
    .map(date => {
      let value = 0, cost = 0;
      for (const p of positions) {
        if (p.purchaseDate && p.purchaseDate > date) continue;
        if (p.type === "Кэш") {
          value += p.qty * p.avgPrice;
          cost += p.qty * p.avgPrice;
        } else if (p.type === "Крипто") {
          value += p.qty * p.avgPrice;
          cost += p.qty * p.avgPrice;
        } else {
          const price = priceByDateByTicker[date]?.[p.ticker] ?? p.avgPrice;
          value += p.qty * price;
          cost += p.qty * p.avgPrice;
        }
      }
      return { date, value: Math.round(value), cost: Math.round(cost) };
    })
    .filter(p => p.value > 0);

  // Fetch dividend history via FMP
  const dividendHistory: Array<{
    id: string; ticker: string; amountPerShare: number;
    shares: number; totalUSD: number; date: string; note: string;
  }> = [];

  for (const p of stocks) {
    try {
      const from = p.purchaseDate || startDate;
      const res = await fetch(
        `https://financialmodelingprep.com/api/v3/historical-price-full/stock_dividend/${p.ticker}?apikey=${FMP_KEY}&from=${from}&to=${todayStr}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.historical?.length) continue;
      for (const div of data.historical) {
        const amount = div.adjDividend || div.dividend || 0;
        if (amount <= 0) continue;
        dividendHistory.push({
          id: `${p.ticker}-${div.date}`,
          ticker: p.ticker,
          amountPerShare: parseFloat(amount.toFixed(4)),
          shares: p.qty,
          totalUSD: parseFloat((amount * p.qty).toFixed(2)),
          date: div.date,
          note: "Исторические данные",
        });
      }
    } catch {}
  }

  dividendHistory.sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json({ chartHistory, dividendHistory });
}
