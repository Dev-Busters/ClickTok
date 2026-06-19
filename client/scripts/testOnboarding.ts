import assert from "node:assert/strict";
import { BALANCE } from "../src/features/economy/balance";
import { ONBOARDING_GOALS } from "../src/features/onboarding/catalog";
import { engagementPerTap, followersPerTap, isOnboardingFeatureAvailable, openingUpgradeCost, resolvableGoal } from "../src/features/onboarding/helpers";
import { pickSequence } from "../src/features/teb/chartCatalog";

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

assert.equal(followersPerTap(0), 1);
assert.equal(followersPerTap(1), 1.5);
assert.equal(engagementPerTap(0), 1);
assert.equal(engagementPerTap(1), 1.25);
assert.equal(openingUpgradeCost("audience_reach", 0), 10);
assert.equal(openingUpgradeCost("audience_reach", 1), 18);
assert.equal(openingUpgradeCost("engagement_rate", 0), 18);
assert.equal(ONBOARDING_GOALS.find(goal => goal.id === "unlock_studio")?.reward?.coins, BALANCE.onboarding.audienceReach.baseCost, "Studio funds Audience Reach Lv1 exactly");
assert.deepEqual(pickSequence([], null, ["tap_three"]), { sequence: "tap_three", bag: [] }, "opening chart eligibility is TAP THREE only");

console.log("Onboarding tests passed: ordered resolution, formulas, rewards, feature gates, and chart eligibility.");

