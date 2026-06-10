import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createChannelSlice, type ChannelSlice } from "./slices/channelSlice";
import { createUpgradesSlice, type UpgradesSlice } from "./slices/upgradesSlice";
import { createSkillsSlice, type SkillsSlice } from "./slices/skillsSlice";
import { createCatalogSlice, type CatalogSlice } from "./slices/catalogSlice";
import { createRunSlice, type RunSlice } from "./slices/runSlice";
import { createSocialSlice, type SocialSlice } from "./slices/socialSlice";
import { createUiSlice, type UiSlice } from "./slices/uiSlice";
import { SAVE_VERSION, migrate, type PersistedState } from "./slices/meta";

export type FullState =
  ChannelSlice & UpgradesSlice & SkillsSlice & CatalogSlice &
  RunSlice & SocialSlice & UiSlice;

export const useGameStore = create<FullState>()(
  persist<FullState, [], [], PersistedState>(
    (set, get, api) => ({
      ...createChannelSlice(set, get, api),
      ...createUpgradesSlice(set, get, api),
      ...createSkillsSlice(set, get, api),
      ...createCatalogSlice(set, get, api),
      ...createRunSlice(set, get, api),
      ...createSocialSlice(set, get, api),
      ...createUiSlice(set, get, api),
    }),
    {
      name: "clicktok-save",
      version: SAVE_VERSION,
      migrate,
      partialize: (state) => ({
        version: SAVE_VERSION,
        handle: state.handle,
        wallet: state.wallet,
        comments: state.comments,
        tapPower: state.tapPower,
        passiveFollowersPerSec: state.passiveFollowersPerSec,
        multiplier: state.multiplier,
        lastSeenAt: Date.now(),
        upgrades: state.upgrades,
        skillLevels: state.skillLevels,
        videos: state.videos,
      }),
    },
  ),
);

export type { UpgradeId, Upgrade } from "./slices/upgradesSlice";
export type { LeaderboardEntry } from "./slices/socialSlice";
