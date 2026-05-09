import { create } from "zustand";
import { StoredPosition } from "../types";

export const LS_POSITIONS = "positions-data";

interface PortfolioState {
  positions: StoredPosition[];
  setPositions: (positions: StoredPosition[]) => void;
  refreshPositions: () => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  positions: [],
  setPositions: (positions) => {
    set({ positions });
    try {
      localStorage.setItem(LS_POSITIONS, JSON.stringify(positions));
    } catch {}
  },
  refreshPositions: () => {
    try {
      const r = localStorage.getItem(LS_POSITIONS);
      if (r) {
        const parsed = JSON.parse(r);
        if (parsed && typeof parsed === "object" && parsed.state && Array.isArray(parsed.state.positions)) {
          set({ positions: parsed.state.positions });
          localStorage.setItem(LS_POSITIONS, JSON.stringify(parsed.state.positions));
        } else if (Array.isArray(parsed)) {
          set({ positions: parsed });
        }
      }
    } catch {}
  },
}));