import { create } from "zustand";
import { createChannelSlice, type ChannelSlice } from "./slices/channelSlice";
import { createUpgradesSlice, type UpgradesSlice } from "./slices/upgradesSlice";
import { createSkillsSlice, type SkillsSlice } from "./slices/skillsSlice";
import { createCatalogSlice, type CatalogSlice } from "./slices/catalogSlice";
import { createRunSlice, type RunSlice } from "./slices/runSlice";
import { createSocialSlice, type SocialSlice } from "./slices/socialSlice";
import { createUiSlice, type UiSlice } from "./slices/uiSlice";

export type FullState =
  ChannelSlice & UpgradesSlice & SkillsSlice & CatalogSlice &
  RunSlice & SocialSlice & UiSlice;

export const useGameStore = create<FullState>()((set, get, api) => ({
  ...createChannelSlice(set, get, api),
  ...createUpgradesSlice(set, get, api),
  ...createSkillsSlice(set, get, api),
  ...createCatalogSlice(set, get, api),
  ...createRunSlice(set, get, api),
  ...createSocialSlice(set, get, api),
  ...createUiSlice(set, get, api),
}));

export type { UpgradeId, Upgrade } from "./slices/upgradesSlice";
export type { LeaderboardEntry } from "./slices/socialSlice";
