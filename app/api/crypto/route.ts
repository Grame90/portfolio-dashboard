import { NextRequest, NextResponse } from "next/server";

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

export async function GET(req: NextRequest) {
  const tickersParam = req.nextUrl.searchParams.get("tickers") ?? "";
  if (!tickersParam) return NextResponse.json({});

  const tickers = tickersParam.split(",").filter(Boolean);
  const idMap: Record<string, string> = {}; // coingecko_id → ticker

  const ids: string[] = [];
  for (const t of tickers) {
    const upper = t.toUpperCase();
    const id = CG_IDS[upper];
    if (id) { ids.push(id); idMap[id] = upper; }
  }

  if (ids.length === 0) return NextResponse.json({});

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true&include_24h_vol=true`,
      { next: { revalidate: 30 } }
    );
    if (!res.ok) throw new Error("CoinGecko error");

    const data = await res.json();
    const result: Record<string, { current: number; previousClose: number }> = {};

    for (const [id, val] of Object.entries(data as Record<string, { usd: number; usd_24h_change: number }>)) {
      const ticker = idMap[id];
      if (!ticker) continue;
      const current = val.usd ?? 0;
      const changePct = val.usd_24h_change ?? 0;
      // derive previousClose from 24h change
      const previousClose = changePct !== 0 ? current / (1 + changePct / 100) : current;
      result[ticker] = { current, previousClose: Math.round(previousClose * 100) / 100 };
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({});
  }
}
