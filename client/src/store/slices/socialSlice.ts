import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import { generateTrends, type TrendInfo } from "../../features/social/trends";
import type { AlgorithmState, LiveStreamSummary } from "../../party/types";

export type LeaderboardEntry = { id: string; handle: string; followers: number; rank: number };

export type SocialSlice = {
  activeTrend: string | null;
  trendsAvailable: TrendInfo[];
  leaderboard: LeaderboardEntry[];
  setActiveTrend: (topic: string) => void;
  setLeaderboard: (entries: LeaderboardEntry[]) => void;
  setTrends: (trends: TrendInfo[]) => void;
  // Phase 4:
  liveDirectory: LiveStreamSummary[];
  algorithm: AlgorithmState | null;
  setLiveDirectory: (streams: LiveStreamSummary[]) => void;
  setAlgorithm: (a: AlgorithmState) => void;
};

const INITIAL_TRENDS = generateTrends();

export const createSocialSlice: StateCreator<FullState, [], [], SocialSlice> = (set) => ({
  activeTrend: INITIAL_TRENDS[0]?.topic ?? "trending",
  trendsAvailable: INITIAL_TRENDS,
  leaderboard: [],
  liveDirectory: [],
  algorithm: null,

  setActiveTrend: (topic) => set({ activeTrend: topic }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  setTrends: (trendsAvailable) => set({ trendsAvailable }),
  setLiveDirectory: (liveDirectory) => set({ liveDirectory }),
  setAlgorithm: (algorithm) => set({ algorithm }),
});
