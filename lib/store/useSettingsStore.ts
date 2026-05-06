import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Settings } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  portfolioName: "Основной портфель",
  targetAmount: 400000,
  monthlyContribution: 1500,
  investmentHorizon: 10,
  targetIncome: 60000,
  riskLevel: "Средний",
  maxDrawdown: 20,
  maxPositionSize: 25,
  minCash: 5,
  stopLoss: 15,
  rebalancePeriod: "Квартально",
  currency: "USD",
};

interface SettingsState {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  setSettings: (settings: Settings) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      updateSettings: (patch) =>
        set((state) => ({
          settings: { ...state.settings, ...patch },
        })),
      setSettings: (settings) => set({ settings }),
    }),
    {
      name: 'dashboard-settings', // same key as LS_SETTINGS
      storage: createJSONStorage(() => localStorage),
    }
  )
);
