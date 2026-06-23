import assert from "node:assert/strict";
import { BALANCE } from "../src/features/economy/balance";
import { ONBOARDING_GOALS } from "../src/features/onboarding/catalog";
import { OPENING_PULSE_CYCLE_MS, OPENING_PULSE_GREEN_DEG, OPENING_PULSE_MODIFIER_DEFAULT_DEG, canClaimCreatorStudioAnalytics, canClaimPulseModifierAnalytics, engagementPerTap, isOnboardingFeatureAvailable, isOpeningEngagementAvailable, isOpeningPulseModifierPlacementValid, openingFollowerAmount, openingFollowersPerTap, openingPulseReward, openingPulseZone, openingUpgradeCost, resolvableGoal, rollOpeningFollowers } from "../src/features/onboarding/helpers";
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

assert.equal(resolvableGoal("meet_teb", [], false, richProgress), null, "the first goal waits for its explicit Analytics claim");
assert.deepEqual(ONBOARDING_GOALS[0].requirement, { kind: "total_followers", amount: 5 }, "first goal is 5 Followers");
assert.equal(ONBOARDING_GOALS[0].reveals, "pulse_modifier");
assert.equal(BALANCE.onboarding.analyticsFollowers, 5);
assert.equal(ONBOARDING_GOALS[0].reward?.coins, 5);
assert.equal(canClaimPulseModifierAnalytics("meet_teb", [], 4), false);
assert.equal(canClaimPulseModifierAnalytics("meet_teb", [], 5), true);
assert.equal(canClaimPulseModifierAnalytics("meet_teb", ["meet_teb"], 5), false);
assert.equal(resolvableGoal("unlock_studio", ["meet_teb"], true, richProgress), null, "reveal/teach blocks a later resolution");
assert.equal(resolvableGoal("unlock_studio", ["meet_teb"], false, richProgress), null, "Studio waits for an explicit Analytics claim");
assert.equal(canClaimCreatorStudioAnalytics("unlock_studio", ["meet_teb"], 24), false);
assert.equal(canClaimCreatorStudioAnalytics("unlock_studio", ["meet_teb"], 25), true);
assert.equal(canClaimCreatorStudioAnalytics("unlock_studio", ["meet_teb", "unlock_studio"], 25), false);
assert.equal(isOnboardingFeatureAvailable("creator_studio", ["meet_teb"]), false, "legacy-like progress does not expose opening UI");
assert.equal(isOnboardingFeatureAvailable("creator_studio", ["meet_teb", "unlock_studio"]), true);
assert.equal(isOpeningEngagementAvailable(["meet_teb", "unlock_studio"]), false, "meter stays hidden before Audience Reach Lv1");
assert.equal(isOpeningEngagementAvailable(["meet_teb", "unlock_studio", "buy_audience_reach"]), true, "meter appears with Engagement Rate");

const msAtDegrees = (degrees: number) => degrees / 360 * OPENING_PULSE_CYCLE_MS;
const greenEdge = OPENING_PULSE_GREEN_DEG / 2;
assert.equal(openingPulseZone(0), "green", "the scoring crest is at 12 o'clock");
assert.equal(openingPulseZone(msAtDegrees(greenEdge)), "green");
assert.equal(openingPulseZone(msAtDegrees(greenEdge + 0.01)), "red");
assert.equal(openingPulseZone(OPENING_PULSE_CYCLE_MS - msAtDegrees(greenEdge)), "green", "zones are symmetrical around the crest");
const blueModifier = [{ id: "blue_event_1" as const, kind: "event" as const, centerDeg: OPENING_PULSE_MODIFIER_DEFAULT_DEG }];
const passiveModifier = [{ id: "passive_boost_1" as const, kind: "passive" as const, centerDeg: OPENING_PULSE_MODIFIER_DEFAULT_DEG }];
assert.equal(openingPulseZone(msAtDegrees(180)), "red", "the opposite side starts unscored");
assert.equal(openingPulseZone(msAtDegrees(180), blueModifier), "blue", "the event zone adds a blue scoring event");
assert.equal(openingPulseZone(msAtDegrees(180), passiveModifier), "passive", "the passive zone arms a future event but does not score itself");
assert.equal(isOpeningPulseModifierPlacementValid(180, blueModifier, "blue_event_1", "event"), true, "default placement is valid");
assert.equal(isOpeningPulseModifierPlacementValid(0, [], "blue_event_1", "event"), false, "modifier cannot overlap the top scoring zone");
assert.equal(isOpeningPulseModifierPlacementValid(51, [], "blue_event_1", "event"), false, "collision includes the visible gap");
assert.equal(isOpeningPulseModifierPlacementValid(52, [], "blue_event_1", "event"), true, "edge beyond the gap can be placed");
assert.equal(isOpeningPulseModifierPlacementValid(90, blueModifier, "blue_event_1", "event"), true, "modifier can move around the remaining open circle");
assert.equal(openingFollowerAmount(0), 1);
assert.equal(openingFollowerAmount(2), 3);
assert.equal(openingPulseReward(2, "green"), 3);
assert.equal(openingPulseReward(2, "blue"), 2);
assert.equal(openingPulseReward(2, "blue", true), 3);
assert.equal(openingPulseReward(2, "passive"), 0);
assert.equal(openingPulseReward(2, "red"), 0);
assert.equal(rollOpeningFollowers(2, 0), 3);
assert.ok(Math.abs(openingFollowersPerTap(0) - 2 / 15) < 1e-10, "random timing earns on the 48-degree green scoring arc");
assert.ok(Math.abs(openingFollowersPerTap(0, blueModifier) - 2 / 5) < 1e-10, "a blue event zone adds its own reward arc");
assert.equal(engagementPerTap(0), 1);
assert.equal(engagementPerTap(1), 1.25);
assert.equal(openingUpgradeCost("audience_reach", 0), 5);
assert.equal(openingUpgradeCost("audience_reach", 1), 7);
assert.equal(openingUpgradeCost("audience_reach", 2), 10);
assert.equal(openingUpgradeCost("engagement_rate", 0), 18);
assert.equal(ONBOARDING_GOALS.find(goal => goal.id === "unlock_studio")?.reward?.coins, BALANCE.onboarding.audienceReach.baseCost, "Studio funds Audience Reach Lv1 exactly");
assert.equal(ONBOARDING_GOALS.find(goal => goal.id === "buy_audience_reach")?.reward?.coins ?? 0, 0, "Audience Reach purchase does not fund Engagement Rate immediately");
assert.equal(BALANCE.onboarding.goalCoins.reach700, openingUpgradeCost("audience_reach", 1) + openingUpgradeCost("engagement_rate", 0), "700-Follower play funds both newly available purchases");
assert.deepEqual(pickSequence([], null, ["tap_three"]), { sequence: "tap_three", bag: [] }, "opening chart eligibility is TAP THREE only");
assert.equal(ONBOARDING_GOALS.some(goal => goal.id === "unlock_video_fyp"), false, "video FYP remains deferred after the first minigame loop");

const resetPatch = persistedStatePatch({
  onboardingRevision: 1,
  onboardingStep: "meet_teb",
  completedOnboardingGoals: [],
  activeOnboardingReveal: null,
  onboardingTeachesSeen: {},
  openingUpgradeLevels: { audience_reach: 0, engagement_rate: 0 },
  openingPulseModifiers: [],
  engagementFill: 0,
  tapThreeCompletions: 0,
  onboardingStepStartedAt: 123,
} as PersistedState);
assert.deepEqual(resetPatch.completedOnboardingGoals, [], "reset loader must replace completed onboarding goals");
assert.deepEqual(resetPatch.onboardingTeachesSeen, {}, "reset loader must replace onboarding teach flags");
assert.deepEqual(resetPatch.openingUpgradeLevels, { audience_reach: 0, engagement_rate: 0 }, "reset loader must replace opening upgrades");
assert.deepEqual(resetPatch.openingPulseModifiers, [], "reset loader must replace pulse modifiers");

const deferredVideoMigration = migrate({
  onboardingStep: "unlock_video_fyp",
  completedOnboardingGoals: ["complete_first_rhythm", "unlock_video_fyp"],
  activeOnboardingReveal: { feature: "video_fyp", shownAt: 1, dismissed: false },
  onboardingTeachesSeen: { video_fyp_first_action: true },
} as PersistedState, 15);
assert.equal(deferredVideoMigration.version, 18);
assert.equal(deferredVideoMigration.onboardingStep, "complete_first_rhythm");
assert.deepEqual(deferredVideoMigration.completedOnboardingGoals, ["complete_first_rhythm"]);
assert.equal(deferredVideoMigration.activeOnboardingReveal, null);

const pulseModifierMigration = migrate({
  completedOnboardingGoals: ["meet_teb"],
} as PersistedState, 16);
assert.equal(pulseModifierMigration.version, 18);
assert.deepEqual(pulseModifierMigration.openingPulseModifiers, [{ id: "blue_event_1", kind: "event", centerDeg: 180 }], "old modifier progress becomes a blue event zone");

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
