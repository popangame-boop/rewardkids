import { create } from "zustand";
import { Reward, Mission, Punishment } from "@/types/supabase";

interface RewardState {
  childBalances: Record<string, number>;
  rewards: Reward[] | null;
  missions: Mission[] | null;
  predefinedPunishments: Punishment[] | null;

  setBalance: (childId: string, balance: number) => void;
  setRewards: (rewards: Reward[]) => void;
  setMissions: (missions: Mission[]) => void;
  setPredefinedPunishments: (punishments: Punishment[]) => void;
  deductBalance: (childId: string, points: number) => void;
  addBalance: (childId: string, points: number) => void;
}

export const useAppStore = create<RewardState>((set) => ({
  childBalances: {},
  rewards: null,
  missions: null,
  predefinedPunishments: null,

  setBalance: (childId, balance) =>
    set((state) => ({
      childBalances: { ...state.childBalances, [childId]: balance },
    })),

  setRewards: (rewards) => set({ rewards }),

  setMissions: (missions) => set({ missions }),

  setPredefinedPunishments: (predefinedPunishments) => set({ predefinedPunishments }),

  deductBalance: (childId, points) =>
    set((state) => {
      const current = state.childBalances[childId] ?? 0;
      return {
        childBalances: {
          ...state.childBalances,
          [childId]: Math.max(0, current - points),
        },
      };
    }),

  addBalance: (childId, points) =>
    set((state) => {
      const current = state.childBalances[childId] ?? 0;
      return {
        childBalances: {
          ...state.childBalances,
          [childId]: current + points,
        },
      };
    }),
}));
