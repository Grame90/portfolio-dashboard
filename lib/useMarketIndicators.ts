import useSWR from "swr";

// Single shared source for /api/market-indicators. Both the indicators strip
// and the header crisis badge call this hook — SWR dedupes them into ONE
// request and one cached value (no duplicate fetches, no cross-component drift).

export interface MarketIndicator {
  key: string;
  label: string;
  value: string;
  sub?: string;
  color: string;
  approx?: boolean;
}

export interface MarketCrisis {
  level: "calm" | "elevated" | "high" | "crisis";
  label: string;
  color: string;
  score: number;
  signals: string[];
}

interface Payload {
  indicators: MarketIndicator[];
  crisis: MarketCrisis | null;
}

const LS_CACHE = "market-indicators-cache";
const REFRESH_MS = 15 * 60 * 1000;

function readCache(): Payload | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(LS_CACHE);
    return raw ? (JSON.parse(raw) as Payload) : undefined;
  } catch {
    return undefined;
  }
}

const fetcher = async (url: string): Promise<Payload> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const payload: Payload = {
    indicators: Array.isArray(data.indicators) ? data.indicators : [],
    crisis: data.crisis ?? null,
  };
  // Persist so a reload paints instantly from cache before revalidation.
  try { localStorage.setItem(LS_CACHE, JSON.stringify(payload)); } catch {}
  return payload;
};

export function useMarketIndicators() {
  const { data, error, isLoading } = useSWR<Payload>("/api/market-indicators", fetcher, {
    refreshInterval: REFRESH_MS,
    revalidateOnFocus: false,
    fallbackData: readCache(),
  });
  return {
    indicators: data?.indicators ?? [],
    crisis: data?.crisis ?? null,
    error,
    isLoading,
  };
}
