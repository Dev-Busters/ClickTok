import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import { generateTrends, type TrendInfo } from "../../features/social/trends";
import type { AlgorithmState, LiveStreamSummary } from "../../party/types";

export type LeaderboardEntry = { id: string; handle: string; followers: number; rank: number };

export type SocialSlice = {
  activeTrend: string | null;
  trendsAvailable: TrendInfo[];
  leaderboard: LeaderboardEntry[];
  trendLeaderboard: LeaderboardEntry[]; // (4.5b) per-trend view of `activeTrend`
  setActiveTrend: (topic: string) => void;
  setLeaderboard: (entries: LeaderboardEntry[]) => void;
  setTrendLeaderboard: (entries: LeaderboardEntry[]) => void;
  setTrends: (trends: TrendInfo[]) => void;
  // Phase 4:
  liveDirectory: LiveStreamSummary[];
  algorithm: AlgorithmState;
  setLiveDirectory: (streams: LiveStreamSummary[]) => void;
  setAlgorithm: (a: AlgorithmState) => void;
};

const INITIAL_TRENDS = generateTrends();

// 4.4: solo/offline default — STARVED, ×1.00 (useLobby falls back to this
// when the lobby socket is down).
export const STARVED_ALGORITHM: AlgorithmState = { meter: 0, tier: "STARVED" };

export const createSocialSlice: StateCreator<FullState, [], [], SocialSlice> = (set, get) => ({
  activeTrend: INITIAL_TRENDS[0]?.topic ?? "trending",
  trendsAvailable: INITIAL_TRENDS,
  leaderboard: [],
  trendLeaderboard: [],
  liveDirectory: [],
  algorithm: STARVED_ALGORITHM,

  setActiveTrend: (topic) => set({ activeTrend: topic }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),
  setTrendLeaderboard: (trendLeaderboard) => set({ trendLeaderboard }),
  setTrends: (trendsAvailable) => set({ trendsAvailable }),
  setLiveDirectory: (liveDirectory) => set({ liveDirectory }),
  // Tier feeds recomputeStats()'s `multiplier` (04 §12.5), so a tier change
  // must trigger a recompute, like applyBoon does for boonMultiplier.
  setAlgorithm: (algorithm) => {
    const tierChanged = get().algorithm.tier !== algorithm.tier;
    set({ algorithm });
    if (tierChanged) get().recomputeStats();
  },
});
