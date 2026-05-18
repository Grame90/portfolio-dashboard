import { create } from "zustand";
import { StoredPosition } from "../types";

export const LS_POSITIONS = "positions-data";
export const LS_POSITIONS_BACKUP = "positions-data-backup";
export const LS_POSITIONS_UPDATED_AT = "positions-data-updated-at";

function readStoredPositions(): StoredPosition[] {
  try {
    const r = localStorage.getItem(LS_POSITIONS);
    if (!r) return [];
    const parsed = JSON.parse(r);
    if (parsed && typeof parsed === "object" && parsed.state && Array.isArray(parsed.state.positions)) {
      return parsed.state.positions;
    }
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizePosition(p: StoredPosition): StoredPosition {
  return {
    id: p.id,
    ticker: p.ticker,
    name: p.name,
    type: p.type,
    qty: p.qty,
    avgPrice: p.avgPrice,
    color: p.color,
    purchaseDate: p.purchaseDate,
    action: p.action,
    broker: p.broker,
  };
}

function persistPositions(positions: StoredPosition[]) {
  const previous = readStoredPositions();
  const normalized = positions.map(normalizePosition);
  const previousNormalized = previous.map(normalizePosition);

  if (JSON.stringify(normalized) === JSON.stringify(previousNormalized)) {
    return previousNormalized;
  }

  if (previous.length > 0) {
    localStorage.setItem(LS_POSITIONS_BACKUP, JSON.stringify(previous));
  }

  if (positions.length === 0 && previous.length > 0) {
    console.warn("[Portfolio] Refused to overwrite saved positions with an empty list.");
    return previous;
  }

  localStorage.setItem(LS_POSITIONS, JSON.stringify(normalized));
  localStorage.setItem(LS_POSITIONS_UPDATED_AT, new Date().toISOString());
  window.dispatchEvent(new CustomEvent("positions-updated"));
  return normalized;
}

interface PortfolioState {
  positions: StoredPosition[];
  setPositions: (positions: StoredPosition[]) => void;
  clearPositions: () => void;
  refreshPositions: () => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
  positions: [],
  setPositions: (positions) => {
    try {
      set({ positions: persistPositions(positions) });
    } catch {
      set({ positions });
    }
  },
  clearPositions: () => {
    set({ positions: [] });
    try {
      const previous = readStoredPositions();
      if (previous.length > 0) localStorage.setItem(LS_POSITIONS_BACKUP, JSON.stringify(previous));
      localStorage.removeItem(LS_POSITIONS);
      localStorage.setItem(LS_POSITIONS_UPDATED_AT, new Date().toISOString());
      window.dispatchEvent(new CustomEvent("positions-updated"));
    } catch {}
  },
  refreshPositions: () => {
    try {
      const positions = readStoredPositions();
      if (positions.length > 0) {
        const normalized = positions.map(normalizePosition);
        set({ positions: normalized });
        localStorage.setItem(LS_POSITIONS, JSON.stringify(normalized));
        if (!localStorage.getItem(LS_POSITIONS_UPDATED_AT)) {
          localStorage.setItem(LS_POSITIONS_UPDATED_AT, new Date().toISOString());
        }
      }
    } catch {}
  },
}));
