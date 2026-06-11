import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import { generateTrends, type TrendInfo } from "../../features/social/trends";

export type LeaderboardEntry = { id: string; handle: string; followers: number; rank: number };

export type SocialSlice = {
  activeTrend: string | null;
  trendsAvailable: TrendInfo[];
  leaderboard: LeaderboardEntry[];
  setActiveTrend: (topic: string) => void;
  setLeaderboard: (entries: LeaderboardEntry[]) => void;
  setTrends: (trends: TrendInfo[]) => void;
};

const INITIAL_TRENDS = generateTrends();

export const createSocialSlice: StateCreator<FullState, [], [], SocialSlice> = (set) => ({
  activeTrend: INITIAL_TRENDS[0]?.topic ?? "trending",
  trendsAvailable: INITIAL_TRENDS,
  leaderboard: [],

  setActiveTrend: (topic) => set({ activeTrend: topic }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  setTrends: (trendsAvailable) => set({ trendsAvailable }),
});
