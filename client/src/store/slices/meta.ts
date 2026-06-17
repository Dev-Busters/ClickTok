import type { Wallet } from "../../features/economy/types";
import type { VideoPost } from "../../features/channel/types";
import type { SkillId } from "../../features/skills/types";
import type { InboxNotification } from "../../features/inbox/types";
import type { ElementId } from "../../features/elements/types";
import type { FullState } from "../index";

export const SAVE_VERSION = 12;

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

// 9.1: adds repeatable upgrade levels + TEB first-press teach flag.
export type PersistedV5 = Omit<PersistedV4, "version"> & {
  version: 5;
  upgradeLevels: Record<string, number>;
  tebTeachSeen: boolean;
};

// 9.2: replaces milestonesReached (number[]) with metricsReached (string[]);
//      adds lifetime counters viewsTotal, coinsEarned, streams.
export type PersistedV6 = Omit<PersistedV5, "version" | "milestonesReached"> & {
  version: 6;
  metricsReached: string[];
  viewsTotal: number;
  coinsEarned: number;
  streams: number;
};

// 10.2: adds the set of Studio pillars that have already triggered an
//        "affordable upgrade" notification (dedup key, never fires twice per pillar).
export type PersistedV7 = Omit<PersistedV6, "version"> & {
  version: 7;
  affordableNotifiedPillars: string[];
};

// 11.2: the GO LIVE / "posting" metric was raised from 100 → 200 followers
// (07 §B3) — rename its id in metricsReached so saves that already crossed
// the old gate keep the unlock.
export type PersistedV8 = Omit<PersistedV7, "version"> & {
  version: 8;
};

// 11.3: per-element first-time teach-caption seen flags (07 §C0).
export type PersistedV9 = Omit<PersistedV8, "version"> & {
  version: 9;
  elementsTeachSeen: Partial<Record<string, boolean>>;
};

// 12.2 (08 §B): metric ids changed — metricsReached is re-derived from persisted stats
// without granting rewards; no new fields added.
export type PersistedV10 = Omit<PersistedV9, "version"> & {
  version: 10;
};

// 12.3 (08 §C3): adds the one-time mod-perk teach caption seen flag.
export type PersistedV11 = Omit<PersistedV10, "version"> & {
  version: 11;
  modTeachSeen: boolean;
};

// 15.1 (11 §A): catalog is now live — videos[] already existed in the shape since v2
// (the stub always persisted an empty array); this bump marks catalog as active so
// any future migration can distinguish pre- and post-catalog saves.
export type PersistedV12 = Omit<PersistedV11, "version"> & {
  version: 12;
};

export type PersistedState = PersistedV12;

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
    upgradeLevels: state.upgradeLevels,
    skillLevels: state.skillLevels,
    videos: state.videos,
    notifications: state.notifications,
    lastDailyClaimAt: state.lastDailyClaimAt,
    metricsReached: state.metricsReached,
    ownedElements: state.ownedElements,
    tebTeachSeen: state.tebTeachSeen,
    viewsTotal: state.viewsTotal,
    coinsEarned: state.coinsEarned,
    streams: state.streams,
    affordableNotifiedPillars: state.affordableNotifiedPillars,
    elementsTeachSeen: state.elementsTeachSeen,
    modTeachSeen: state.modTeachSeen,
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

// Maps old numeric follower milestone values (FOLLOWER_MILESTONES) to the
// new string metric IDs used in 9.2+. Only the thresholds present in both
// the old and new catalogs are mapped; extras are dropped.
const MILESTONE_TO_METRIC: Record<number, string> = {
  100: "follower_100",
  1000: "follower_1000",
};

export function migrate(persistedState: unknown, version: number): PersistedState {
  let state = persistedState as PersistedV1 | PersistedV2 | PersistedV3 | PersistedV4 | PersistedV5 | PersistedV6 | PersistedV7 | PersistedV8 | PersistedV9 | PersistedV10 | PersistedV11 | PersistedV12;

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

  if (version < 5) {
    const v4 = state as PersistedV4;
    state = {
      ...v4,
      version: 5,
      // v4 saves predate repeatable upgrades (9.1) — no levels purchased yet.
      upgradeLevels: {},
      // v4 saves predate TEB teach (9.1) — show the teaching on next first tap.
      tebTeachSeen: false,
    };
  }

  if (version < 6) {
    const v5 = state as PersistedV5;
    const oldMilestones: number[] = v5.milestonesReached ?? [];
    const metricsReached = oldMilestones.flatMap(
      m => MILESTONE_TO_METRIC[m] ? [MILESTONE_TO_METRIC[m]] : [],
    );
    const { milestonesReached: _drop, ...rest } = v5;
    state = {
      ...rest,
      version: 6,
      metricsReached,
      viewsTotal: 0,
      coinsEarned: 0,
      streams: 0,
    };
  }

  if (version < 7) {
    const v6 = state as PersistedV6;
    state = {
      ...v6,
      version: 7,
      // v6 saves predate the affordable-upgrade notification dedup set (10.2).
      affordableNotifiedPillars: [],
    };
  }

  if (version < 8) {
    const v7 = state as PersistedV7;
    state = {
      ...v7,
      version: 8,
      // 11.2: the "posting" pillar's gate moved from 100 → 200 followers
      // (id follower_100 → follower_200) — preserve the unlock for saves
      // that already crossed the old threshold.
      metricsReached: v7.metricsReached.map(id => id === "follower_100" ? "follower_200" : id),
    };
  }

  if (version < 9) {
    const v8 = state as PersistedV8;
    state = {
      ...v8,
      version: 9,
      // 11.3: per-element teach-caption flags — no element has been taught yet.
      elementsTeachSeen: {},
    };
  }

  if (version < 10) {
    const v9 = state as PersistedV9;
    // 12.2 (08 §B): metric ids replaced entirely. Re-derive metricsReached from
    // persisted stats using the new catalog thresholds — no rewards granted.
    const vt = v9.viewsTotal ?? 0;
    const fo = v9.wallet?.totalFollowers ?? 0;
    const st = v9.streams ?? 0;
    type NewEntry = { id: string; stat: "views" | "followers" | "streams"; threshold: number };
    const newMetrics: NewEntry[] = [
      { id: "views_10",      stat: "views",     threshold: 10 },
      { id: "views_25",      stat: "views",     threshold: 25 },
      { id: "views_45",      stat: "views",     threshold: 45 },
      { id: "views_80",      stat: "views",     threshold: 80 },
      { id: "views_140",     stat: "views",     threshold: 140 },
      { id: "follower_50",   stat: "followers", threshold: 50 },
      { id: "follower_90",   stat: "followers", threshold: 90 },
      { id: "follower_120",  stat: "followers", threshold: 120 },
      { id: "follower_160",  stat: "followers", threshold: 160 },
      { id: "follower_200",  stat: "followers", threshold: 200 },
      { id: "streams_1",     stat: "streams",   threshold: 1 },
      { id: "follower_1000", stat: "followers", threshold: 1000 },
      { id: "follower_5000", stat: "followers", threshold: 5000 },
    ];
    const metricsReached = newMetrics
      .filter(m => (m.stat === "views" ? vt : m.stat === "followers" ? fo : st) >= m.threshold)
      .map(m => m.id);
    state = { ...v9, version: 10, metricsReached };
  }

  if (version < 11) {
    const v10 = state as PersistedV10;
    state = {
      ...v10,
      version: 11,
      // 12.3: mod-perk teach not yet seen on existing saves.
      modTeachSeen: false,
    };
  }

  if (version < 12) {
    const v11 = state as PersistedV11;
    state = {
      ...v11,
      version: 12,
      // 15.1: catalog active; videos[] already in the shape since v2 (was always persisted
      // as an empty array by the stub). No new fields — bump marks catalog as live.
    };
  }

  return state as PersistedState;
}
