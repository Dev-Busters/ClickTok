import type { Wallet } from "../../features/economy/types";
import type { VideoPost } from "../../features/channel/types";
import type { SkillId } from "../../features/skills/types";
import type { Upgrade } from "./upgradesSlice";

export const SAVE_VERSION = 1;

// Persisted (partialize) — durable slices only:
//   handle, wallet, comments, tapPower, passiveFollowersPerSec, multiplier,
//   lastSeenAt, upgrades, skillLevels, videos
// Excluded: run* (ephemeral), social* (server-owned), ui* (session)
export type PersistedV1 = {
  version: 1;
  handle: string;
  wallet: Wallet;
  comments: number;
  tapPower: number;
  passiveFollowersPerSec: number;
  multiplier: number;
  lastSeenAt: number;
  upgrades: Upgrade[];
  skillLevels: Record<SkillId, number>;
  videos: VideoPost[];
};

export type PersistedState = PersistedV1;

// SAVE_VERSION 1 is the initial persisted shape — nothing to migrate yet.
// On any future breaking shape change: bump SAVE_VERSION and add
// `if (version < N) { ... }` steps here before returning.
export function migrate(persistedState: unknown, _version: number): PersistedState {
  return persistedState as PersistedState;
}
