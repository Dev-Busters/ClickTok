import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import { migrate, type PersistedState } from "./meta";

// 4.5: Supabase auth/sync status — ephemeral (re-derived from the Supabase
// session on load), not persisted via the localStorage `partialize`.
export type CloudSyncStatus = "offline" | "signing-in" | "syncing" | "synced" | "error";

export type CloudSlice = {
  cloudUserId: string | null;
  cloudIsAnonymous: boolean;
  cloudEmail: string | null;
  cloudSyncStatus: CloudSyncStatus;

  setCloudAuth: (auth: { userId: string | null; isAnonymous: boolean; email: string | null }) => void;
  setCloudSyncStatus: (status: CloudSyncStatus) => void;
  // Reverse of meta.ts's `partialize` — applies a cloud save back into the
  // live store, then recomputes derived stats.
  loadPersistedState: (persisted: PersistedState) => void;
};

export function persistedStatePatch(persisted: PersistedState): Partial<FullState> {
  return {
    handle: persisted.handle,
    wallet: persisted.wallet,
    comments: persisted.comments,
    tapPower: persisted.tapPower,
    passiveFollowersPerSec: persisted.passiveFollowersPerSec,
    passiveCoinsPerSec: persisted.passiveCoinsPerSec,
    multiplier: persisted.multiplier,
    followerConversion: persisted.followerConversion,
    boonMultiplier: persisted.boonMultiplier,
    lastSeenAt: persisted.lastSeenAt,
    ownedUpgrades: persisted.ownedUpgrades,
    upgradeLevels: persisted.upgradeLevels,
    skillLevels: persisted.skillLevels,
    videos: persisted.videos,
    notifications: persisted.notifications,
    lastDailyClaimAt: persisted.lastDailyClaimAt,
    metricsReached: persisted.metricsReached,
    ownedElements: persisted.ownedElements,
    tebTeachSeen: persisted.tebTeachSeen,
    viewsTotal: persisted.viewsTotal,
    coinsEarned: persisted.coinsEarned,
    streams: persisted.streams,
    affordableNotifiedPillars: persisted.affordableNotifiedPillars,
    elementsTeachSeen: persisted.elementsTeachSeen,
    modTeachSeen: persisted.modTeachSeen,
    tebChargeTeachSeen: persisted.tebChargeTeachSeen,
    tebSequenceTeachSeen: persisted.tebSequenceTeachSeen,
    onboardingRevision: persisted.onboardingRevision,
    onboardingStep: persisted.onboardingStep,
    completedOnboardingGoals: persisted.completedOnboardingGoals,
    activeOnboardingReveal: persisted.activeOnboardingReveal,
    onboardingTeachesSeen: persisted.onboardingTeachesSeen,
    openingUpgradeLevels: persisted.openingUpgradeLevels,
    engagementFill: persisted.engagementFill,
    tapThreeCompletions: persisted.tapThreeCompletions,
    onboardingStepStartedAt: persisted.onboardingStepStartedAt,
  };
}

export const createCloudSlice: StateCreator<FullState, [], [], CloudSlice> = (set, get) => ({
  cloudUserId: null,
  cloudIsAnonymous: true,
  cloudEmail: null,
  cloudSyncStatus: "offline",

  setCloudAuth: ({ userId, isAnonymous, email }) =>
    set({ cloudUserId: userId, cloudIsAnonymous: isAnonymous, cloudEmail: email }),

  setCloudSyncStatus: (status) => set({ cloudSyncStatus: status }),

  loadPersistedState: (persisted) => {
    const migrated = migrate(persisted, persisted.version ?? 1);
    set(persistedStatePatch(migrated));
    get().recomputeStats();
  },
});
