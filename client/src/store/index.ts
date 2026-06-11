import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createChannelSlice, type ChannelSlice } from "./slices/channelSlice";
import { createUpgradesSlice, type UpgradesSlice } from "./slices/upgradesSlice";
import { createSkillsSlice, type SkillsSlice } from "./slices/skillsSlice";
import { createCatalogSlice, type CatalogSlice } from "./slices/catalogSlice";
import { createRunSlice, type RunSlice } from "./slices/runSlice";
import { createSocialSlice, type SocialSlice } from "./slices/socialSlice";
import { createUiSlice, type UiSlice } from "./slices/uiSlice";
import { createInboxSlice, type InboxSlice } from "./slices/inboxSlice";
import { createSpectateSlice, type SpectateSlice } from "./slices/spectateSlice";
import { createCloudSlice, type CloudSlice } from "./slices/cloudSlice";
import { SAVE_VERSION, migrate, toPersistedState, type PersistedState } from "./slices/meta";

// 3.2 adds InboxSlice; 4.2 adds SpectateSlice; 4.5 adds CloudSlice — all
// deviate from 03 §8's canonical FullState (same precedent as
// RunSlice/SocialSlice additions).
export type FullState =
  ChannelSlice & UpgradesSlice & SkillsSlice & CatalogSlice &
  RunSlice & SocialSlice & UiSlice & InboxSlice & SpectateSlice & CloudSlice;

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
      ...createInboxSlice(set, get, api),
      ...createSpectateSlice(set, get, api),
      ...createCloudSlice(set, get, api),
    }),
    {
      name: "clicktok-save",
      version: SAVE_VERSION,
      migrate,
      partialize: toPersistedState,
      onRehydrateStorage: () => (state) => {
        state?.recomputeStats();
      },
    },
  ),
);

// Dev-only: expose the store for debugging/driving state from the console
// (e.g. the browser preview, where rAF throttling freezes the game loops).
if (import.meta.env.DEV) {
  (window as unknown as { gameStore: typeof useGameStore }).gameStore = useGameStore;
}

export type { LeaderboardEntry } from "./slices/socialSlice";
export type { IdleReport } from "./slices/channelSlice";
