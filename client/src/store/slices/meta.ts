import type { Wallet } from "../../features/economy/types";
import type { VideoPost } from "../../features/channel/types";
import type { SkillId } from "../../features/skills/types";

export const SAVE_VERSION = 2;

// Persisted (partialize) — durable slices only:
//   handle, wallet, comments, tapPower, passiveFollowersPerSec, passiveCoinsPerSec,
//   multiplier, followerConversion, lastSeenAt, ownedUpgrades, skillLevels, videos
// Excluded: run* (ephemeral), social* (server-owned), ui* (session)
export type PersistedV2 = {
  version: 2;
  handle: string;
  wallet: Wallet;
  comments: number;
  tapPower: number;
  passiveFollowersPerSec: number;
  passiveCoinsPerSec: number;
  multiplier: number;
  followerConversion: number;
  lastSeenAt: number;
  ownedUpgrades: Record<string, boolean>;
  skillLevels: Record<SkillId, number>;
  videos: VideoPost[];
};

export type PersistedState = PersistedV2;

// v1 shape (pre-1.1): persisted a flat `upgrades: Upgrade[]` with `purchased`/`cost`.
type PersistedV1Upgrade = { id: string; purchased: boolean; cost: number };
type PersistedV1 = Omit<PersistedV2, "version" | "ownedUpgrades"> & {
  version: 1;
  upgrades: PersistedV1Upgrade[];
};

// v1 → v2 id remap for upgrades that have a roughly-equivalent replacement in
// the new catalog (`features/upgrades/catalog.ts`). Anything else purchased
// under v1 is refunded (its coin cost credited back) since it has no
// equivalent in the new gear/software catalog.
const V1_TO_V2_UPGRADE_MAP: Record<string, string> = {
  better_lighting: "ring_light",
  ring_light: "usb_mic",
};

export function migrate(persistedState: unknown, version: number): PersistedState {
  let state = persistedState as PersistedV1 | PersistedV2;

  if (version < 2) {
    const v1 = state as PersistedV1;
    const oldUpgrades = v1.upgrades ?? [];
    const ownedUpgrades: Record<string, boolean> = {};
    let refund = 0;

    for (const u of oldUpgrades) {
      if (!u.purchased) continue;
      const mapped = V1_TO_V2_UPGRADE_MAP[u.id];
      if (mapped) {
        ownedUpgrades[mapped] = true;
      } else {
        refund += u.cost;
      }
    }

    const { upgrades: _upgrades, ...rest } = v1;
    state = {
      ...rest,
      version: 2,
      ownedUpgrades,
      wallet: { ...v1.wallet, coins: v1.wallet.coins + refund },
    };
  }

  return state as PersistedState;
}
