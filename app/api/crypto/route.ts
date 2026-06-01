import { NextRequest, NextResponse } from "next/server";

// Crypto quotes: CoinGecko is the PRIMARY source (free, no key). CoinMarketCap
// is a FALLBACK used only for tickers CoinGecko fails to return — CMC costs API
// credits per call (~10k/mo on the free plan), so we never hit it on the happy path.

type Quote = { current: number; previousClose: number };

// CoinGecko ID mapping for common crypto tickers
const CG_IDS: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin",
  XRP: "ripple", ADA: "cardano", AVAX: "avalanche-2", DOT: "polkadot",
  MATIC: "matic-network", LINK: "chainlink", UNI: "uniswap", ATOM: "cosmos",
  LTC: "litecoin", BCH: "bitcoin-cash", DOGE: "dogecoin", SHIB: "shiba-inu",
  TRX: "tron", TON: "the-open-network", APT: "aptos", ARB: "arbitrum",
  OP: "optimism", SUI: "sui", INJ: "injective-protocol", SEI: "sei-network",
  FTM: "fantom", NEAR: "near", ALGO: "algorand", ICP: "internet-computer",
  FIL: "filecoin", HBAR: "hedera-hashgraph", VET: "vechain", ETC: "ethereum-classic",
  AAVE: "aave", MKR: "maker", SNX: "synthetix-network-token", CRV: "curve-dao-token",
  LDO: "lido-dao", GRT: "the-graph", ENS: "ethereum-name-service",
  SAND: "the-sandbox", MANA: "decentraland", AXS: "axie-infinity",
  WLD: "worldcoin-wld", JUP: "jupiter-exchange-solana", PYTH: "pyth-network",
  PEPE: "pepe", FLOKI: "floki", WIF: "dogwifcoin", BONK: "bonk",
  XMR: "monero", ZEC: "zcash", DASH: "dash", XLM: "stellar",
  EOS: "eos", IOTA: "iota", NEO: "neo", WAVES: "waves",
  EGLD: "elrond-erd-2", THETA: "theta-token", XTZ: "tezos",
};

// Derive yesterday's close from current price + 24h % change.
function derivePrevClose(current: number, changePct: number): number {
  const prev = changePct !== 0 ? current / (1 + changePct / 100) : current;
  return parseFloat(prev.toPrecision(6));
}

// PRIMARY: CoinGecko simple/price. Returns { TICKER: {current, previousClose} }.
async function fetchCoinGecko(tickers: string[]): Promise<Record<string, Quote>> {
  const idMap: Record<string, string> = {}; // coingecko_id → ticker
  const ids: string[] = [];
  for (const t of tickers) {
    const id = CG_IDS[t];
    if (id) { ids.push(id); idMap[id] = t; }
  }
  if (ids.length === 0) return {};

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true&include_24h_vol=true`,
      { next: { revalidate: 30 } },
    );
    if (!res.ok) return {};
    const data = await res.json() as Record<string, { usd?: number; usd_24h_change?: number }>;

    const out: Record<string, Quote> = {};
    for (const [id, val] of Object.entries(data)) {
      const ticker = idMap[id];
      if (!ticker || typeof val.usd !== "number" || val.usd <= 0) continue;
      out[ticker] = { current: val.usd, previousClose: derivePrevClose(val.usd, val.usd_24h_change ?? 0) };
    }
    return out;
  } catch {
    return {};
  }
}

// FALLBACK: CoinMarketCap quotes/latest (uses symbols directly, costs credits).
async function fetchCMC(symbols: string[]): Promise<Record<string, Quote>> {
  const key = process.env.COINMARKETCAP_API_KEY;
  if (!key || symbols.length === 0) return {};

  try {
    const res = await fetch(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbols.join(",")}&convert=USD`,
      {
        headers: { "X-CMC_PRO_API_KEY": key, Accept: "application/json" },
        // Cache 5 min to minimise credit usage even when the fallback is active.
        // Worst case (CoinGecko down 24/7): 288 calls/day ≈ 8.6k credits/mo — under the 10k free cap.
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) return {};
    const json = await res.json() as { data?: Record<string, { quote?: { USD?: { price?: number; percent_change_24h?: number } } }> };

    const out: Record<string, Quote> = {};
    for (const sym of symbols) {
      const q = json.data?.[sym]?.quote?.USD;
      if (!q || typeof q.price !== "number" || q.price <= 0) continue;
      out[sym] = { current: q.price, previousClose: derivePrevClose(q.price, q.percent_change_24h ?? 0) };
    }
    return out;
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  const tickersParam = req.nextUrl.searchParams.get("tickers") ?? "";
  if (!tickersParam) return NextResponse.json({});

  const tickers = tickersParam
    .split(",")
    .map(t => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 50);
  if (tickers.length === 0) return NextResponse.json({});

  // 1) CoinGecko first (free).
  const result = await fetchCoinGecko(tickers);

  // 2) CMC fallback only for tickers CoinGecko didn't return (saves credits).
  const missing = tickers.filter(t => !(t in result));
  if (missing.length > 0) {
    const cmc = await fetchCMC(missing);
    Object.assign(result, cmc);
  }

  return NextResponse.json(result);
}
