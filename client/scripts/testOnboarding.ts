import assert from "node:assert/strict";
import { BALANCE } from "../src/features/economy/balance";
import { ONBOARDING_GOALS } from "../src/features/onboarding/catalog";
import { engagementPerTap, followerChance, isOnboardingFeatureAvailable, isOpeningEngagementAvailable, openingUpgradeCost, resolvableGoal, rollOpeningFollower } from "../src/features/onboarding/helpers";
import { pickSequence } from "../src/features/teb/chartCatalog";
import { persistedStatePatch } from "../src/store/slices/cloudSlice";
import type { PersistedState } from "../src/store/slices/meta";
import { migrate } from "../src/store/slices/meta";
import { flushPendingReset, RESET_PENDING_KEY } from "../src/features/cloud/reset";

const richProgress = {
  viewsTotal: 10_000,
  totalFollowers: 10_000,
  openingUpgradeLevels: { audience_reach: 10, engagement_rate: 10 },
  tapThreeCompletions: 10,
};

assert.equal(resolvableGoal("meet_teb", [], false, richProgress), "meet_teb", "only the active goal resolves");
assert.equal(resolvableGoal("unlock_studio", ["meet_teb"], true, richProgress), null, "reveal/teach blocks a later resolution");
assert.equal(isOnboardingFeatureAvailable("creator_studio", ["meet_teb"]), false, "legacy-like progress does not expose opening UI");
assert.equal(isOnboardingFeatureAvailable("creator_studio", ["meet_teb", "unlock_studio"]), true);
assert.equal(isOpeningEngagementAvailable(["meet_teb", "unlock_studio"]), false, "meter stays hidden before Audience Reach Lv1");
assert.equal(isOpeningEngagementAvailable(["meet_teb", "unlock_studio", "buy_audience_reach"]), true, "meter appears with Engagement Rate");

assert.equal(followerChance(0), 0.25);
assert.equal(followerChance(1), 0.45);
assert.equal(rollOpeningFollower(0, () => 0.24), 1);
assert.equal(rollOpeningFollower(0, () => 0.25), 0);
assert.equal(engagementPerTap(0), 1);
assert.equal(engagementPerTap(1), 1.25);
assert.equal(openingUpgradeCost("audience_reach", 0), 10);
assert.equal(openingUpgradeCost("audience_reach", 1), 18);
assert.equal(openingUpgradeCost("engagement_rate", 0), 18);
assert.equal(ONBOARDING_GOALS.find(goal => goal.id === "unlock_studio")?.reward?.coins, BALANCE.onboarding.audienceReach.baseCost, "Studio funds Audience Reach Lv1 exactly");
assert.deepEqual(pickSequence([], null, ["tap_three"]), { sequence: "tap_three", bag: [] }, "opening chart eligibility is TAP THREE only");
assert.equal(ONBOARDING_GOALS.some(goal => goal.id === "unlock_video_fyp"), false, "video FYP remains deferred after the first minigame loop");

const resetPatch = persistedStatePatch({
  onboardingRevision: 1,
  onboardingStep: "meet_teb",
  completedOnboardingGoals: [],
  activeOnboardingReveal: null,
  onboardingTeachesSeen: {},
  openingUpgradeLevels: { audience_reach: 0, engagement_rate: 0 },
  engagementFill: 0,
  tapThreeCompletions: 0,
  onboardingStepStartedAt: 123,
} as PersistedState);
assert.deepEqual(resetPatch.completedOnboardingGoals, [], "reset loader must replace completed onboarding goals");
assert.deepEqual(resetPatch.onboardingTeachesSeen, {}, "reset loader must replace onboarding teach flags");
assert.deepEqual(resetPatch.openingUpgradeLevels, { audience_reach: 0, engagement_rate: 0 }, "reset loader must replace opening upgrades");

const deferredVideoMigration = migrate({
  onboardingStep: "unlock_video_fyp",
  completedOnboardingGoals: ["complete_first_rhythm", "unlock_video_fyp"],
  activeOnboardingReveal: { feature: "video_fyp", shownAt: 1, dismissed: false },
  onboardingTeachesSeen: { video_fyp_first_action: true },
} as PersistedState, 15);
assert.equal(deferredVideoMigration.version, 16);
assert.equal(deferredVideoMigration.onboardingStep, "complete_first_rhythm");
assert.deepEqual(deferredVideoMigration.completedOnboardingGoals, ["complete_first_rhythm"]);
assert.equal(deferredVideoMigration.activeOnboardingReveal, null);

const resetStorageData = new Map([[RESET_PENDING_KEY, "1"]]);
const resetStorage = {
  getItem: (key: string) => resetStorageData.get(key) ?? null,
  removeItem: (key: string) => { resetStorageData.delete(key); },
};
assert.equal(await flushPendingReset(resetStorage, async () => false), true);
assert.equal(resetStorageData.has(RESET_PENDING_KEY), true, "failed cloud reset must keep its durable marker");
assert.equal(await flushPendingReset(resetStorage, async () => true), true);
assert.equal(resetStorageData.has(RESET_PENDING_KEY), false, "successful cloud reset clears its marker");

console.log("Onboarding tests passed: ordered resolution, formulas, rewards, feature gates, and chart eligibility.");
