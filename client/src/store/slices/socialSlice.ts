import type { StateCreator } from "zustand";
import type { FullState } from "../index";

export type LeaderboardEntry = { id: string; handle: string; followers: number; rank: number };

export type SocialSlice = {
  trendTopic: string | null;
  leaderboard: LeaderboardEntry[];
  setTrend: (topic: string) => void;
  setLeaderboard: (entries: LeaderboardEntry[]) => void;
};

export const createSocialSlice: StateCreator<FullState, [], [], SocialSlice> = (set) => ({
  trendTopic: null,
  leaderboard: [],

  setTrend: (topic) => set({ trendTopic: topic }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
});
