import { create } from 'zustand';
import { LiveQuote } from '../types';

interface QuotesState {
  liveQuotes: Record<string, LiveQuote>;
  realQuotes: Record<string, LiveQuote>; // last SWR-fetched prices, used as simulation anchor
  quoteStatus: "idle" | "loading" | "ok" | "error";
  setQuotes: (quotes: Record<string, LiveQuote>) => void;
  setQuoteStatus: (status: "idle" | "loading" | "ok" | "error") => void;
  updateQuotes: (patch: Record<string, LiveQuote>) => void;
}

export const useQuotesStore = create<QuotesState>((set) => ({
  liveQuotes: {},
  realQuotes: {},
  quoteStatus: "idle",
  setQuotes: (quotes) => set({ liveQuotes: quotes, realQuotes: quotes }),
  setQuoteStatus: (status) => set({ quoteStatus: status }),
  updateQuotes: (patch) => set((state) => ({ liveQuotes: { ...state.liveQuotes, ...patch } })),
}));
