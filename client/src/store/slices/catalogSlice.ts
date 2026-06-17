import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import type { VideoPost } from "../../features/channel/types";
import { BALANCE } from "../../features/economy/balance";

export type CatalogSlice = {
  videos: VideoPost[];
  addVideo: (v: VideoPost) => void;
  catalogYieldPerSec: (nowMs?: number) => { coins: number; followers: number };
};

// 15.1 (11 §A): catalog is now live.
// Each post ramps to its peak then decays (04 §3); cap at the 50 newest.
export const createCatalogSlice: StateCreator<FullState, [], [], CatalogSlice> = (set, get) => ({
  videos: [],
  addVideo: (v) => {
    const existing = get().videos;
    // Cap at 50 newest (spec: "50 newest to bound loop cost").
    const updated = [...existing, v].slice(-50);
    set({ videos: updated });
  },
  catalogYieldPerSec: (nowMs) => {
    const { videos } = get();
    if (videos.length === 0) return { coins: 0, followers: 0 };
    const nowSec = (nowMs ?? Date.now()) / 1000;
    const peak6 = BALANCE.catalog.catalogPeakAtSec * 6;
    let coins = 0;
    // Iterate the 50 newest (addVideo already enforces the cap).
    for (const v of videos) {
      const age = nowSec - v.createdAt / 1000;
      if (age <= 0) continue;
      const peak = v.peakAtSec;
      const factor = age <= peak
        ? age / peak
        : Math.max(0.1, 1 - (age - peak) / peak6);
      coins += v.coinsPerSec * factor;
    }
    return { coins, followers: 0 };
  },
});
