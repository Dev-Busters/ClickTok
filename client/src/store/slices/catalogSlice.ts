import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import type { VideoPost } from "../../features/channel/types";

export type CatalogSlice = {
  videos: VideoPost[];
  addVideo: (v: VideoPost) => void;
  catalogYieldPerSec: () => { coins: number; followers: number };
};

// Stub: catalog feature is deferred (see roadmap 1.5). Kept for FullState shape.
export const createCatalogSlice: StateCreator<FullState, [], [], CatalogSlice> = (set, get) => ({
  videos: [],
  addVideo: (v) => set({ videos: [...get().videos, v] }),
  catalogYieldPerSec: () => ({ coins: 0, followers: 0 }),
});
