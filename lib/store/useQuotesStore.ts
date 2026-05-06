import { create } from 'zustand';
import { LiveQuote } from '../types';

interface QuotesState {
  liveQuotes: Record<string, LiveQuote>;
  quoteStatus: "idle" | "loading" | "ok" | "error";
  setQuotes: (quotes: Record<string, LiveQuote>) => void;
  setQuoteStatus: (status: "idle" | "loading" | "ok" | "error") => void;
  updateQuotes: (patch: Record<string, LiveQuote>) => void;
}

export const useQuotesStore = create<QuotesState>((set) => ({
  liveQuotes: {},
  quoteStatus: "idle",
  setQuotes: (quotes) => set({ liveQuotes: quotes }),
  setQuoteStatus: (status) => set({ quoteStatus: status }),
  updateQuotes: (patch) => set((state) => ({ liveQuotes: { ...state.liveQuotes, ...patch } })),
}));
