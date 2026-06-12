import type { Wallet } from "../../features/economy/types";
import type { VideoPost } from "../../features/channel/types";
import type { SkillId } from "../../features/skills/types";
import type { InboxNotification } from "../../features/inbox/types";
import type { ElementId } from "../../features/elements/types";
import type { FullState } from "../index";

export const SAVE_VERSION = 4;

// Persisted (partialize) — durable slices only:
//   handle, wallet, comments, tapPower, passiveFollowersPerSec, passiveCoinsPerSec,
//   multiplier, followerConversion, lastSeenAt, ownedUpgrades, skillLevels, videos
// Excluded: run* (ephemeral), social* (server-owned), ui* (session)
// 3.2 adds inbox state (notifications, lastDailyClaimAt, milestonesReached) —
// see PersistedV3 below; this is durable history, not session/ephemeral.
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
  boonMultiplier: number;
  lastSeenAt: number;
  ownedUpgrades: Record<string, boolean>;
  skillLevels: Record<SkillId, number>;
  videos: VideoPost[];
};

// 3.2: adds inbox state — notification log, daily-claim timestamp, and the
// set of follower milestones already notified.
export type PersistedV3 = Omit<PersistedV2, "version"> & {
  version: 3;
  notifications: InboxNotification[];
  lastDailyClaimAt: number | null;
  milestonesReached: number[];
};

// 7.3: adds the element framework's unlocked-elements set.
export type PersistedV4 = Omit<PersistedV3, "version"> & {
  version: 4;
  ownedElements: Partial<Record<ElementId, boolean>>;
};

export type PersistedState = PersistedV4;

// Single source of truth for "what gets saved" — used by the localStorage
// `persist` middleware's `partialize` AND by the cloud sync push (4.5), so
// the two persistence targets never drift apart.
export function toPersistedState(state: FullState): PersistedState {
  return {
    version: SAVE_VERSION,
    handle: state.handle,
    wallet: state.wallet,
    comments: state.comments,
    tapPower: state.tapPower,
    passiveFollowersPerSec: state.passiveFollowersPerSec,
    passiveCoinsPerSec: state.passiveCoinsPerSec,
    multiplier: state.multiplier,
    followerConversion: state.followerConversion,
    boonMultiplier: state.boonMultiplier,
    lastSeenAt: Date.now(),
    ownedUpgrades: state.ownedUpgrades,
    skillLevels: state.skillLevels,
    videos: state.videos,
    notifications: state.notifications,
    lastDailyClaimAt: state.lastDailyClaimAt,
    milestonesReached: state.milestonesReached,
    ownedElements: state.ownedElements,
  };
}

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
  let state = persistedState as PersistedV1 | PersistedV2 | PersistedV3 | PersistedV4;

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
      // v1 saves predate the "Algorithm Favor" boon (2.7) — default to no bonus.
      boonMultiplier: v1.boonMultiplier ?? 1,
    };
  }

  if (version < 3) {
    const v2 = state as PersistedV2;
    state = {
      ...v2,
      version: 3,
      // v2 saves predate the Inbox (3.2) — start with an empty notification
      // log, no daily claim yet, and no milestones notified yet.
      notifications: [],
      lastDailyClaimAt: null,
      milestonesReached: [],
    };
  }

  if (version < 4) {
    const v3 = state as PersistedV3;
    state = {
      ...v3,
      version: 4,
      // v3 saves predate the element framework (7.3) — nothing unlocked yet.
      ownedElements: {},
    };
  }

  return state as PersistedState;
}
