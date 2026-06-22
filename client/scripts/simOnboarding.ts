import { BALANCE } from "../src/features/economy/balance";
import { engagementPerTap, openingFollowersPerTap, openingUpgradeCost } from "../src/features/onboarding/helpers";

type Result = { tapsPerSecond: number; analyticsMin: number; studioMin: number; rhythmMin: number; firstCompletionMin: number; upgradeLevelsAtRhythm: number };

function simulate(tapsPerSecond: number): Result {
  let seconds = 0, followers = 0, coins = 0, engagement = 0, completions = 0;
  let audience = 0, rate = 0, analyticsAt = 0, studioAt = 0, rhythmAt = 0;
  let studioRewarded = false, audienceRewarded = false, reach700Rewarded = false, threeRewarded = false, reach1200Rewarded = false;
  while (completions < 1 && seconds < 60 * 75) {
    seconds += 1;
    const modifierCount = followers >= BALANCE.onboarding.firstGoalFollowers ? 1 : 0;
    followers += openingFollowersPerTap(audience, modifierCount) * tapsPerSecond;
    if (!analyticsAt && followers >= BALANCE.onboarding.analyticsFollowers) analyticsAt = seconds;
    if (!studioRewarded && followers >= BALANCE.onboarding.studioFollowers) { studioRewarded = true; studioAt = seconds; coins += BALANCE.onboarding.goalCoins.unlockStudio; }
    if (studioRewarded && audience === 0 && coins >= openingUpgradeCost("audience_reach", audience)) { coins -= openingUpgradeCost("audience_reach", audience++); audienceRewarded = true; coins += BALANCE.onboarding.goalCoins.buyAudienceReach; }
    if (audienceRewarded && rate === 0 && coins >= openingUpgradeCost("engagement_rate", rate)) coins -= openingUpgradeCost("engagement_rate", rate++);
    if (!reach700Rewarded && followers >= BALANCE.onboarding.minorFollowerGoal1) { reach700Rewarded = true; coins += BALANCE.onboarding.goalCoins.reach700; }
    if (audience + rate < 3 && coins >= openingUpgradeCost("audience_reach", audience)) audience++, coins -= openingUpgradeCost("audience_reach", audience - 1);
    if (!threeRewarded && audience + rate >= 3) { threeRewarded = true; coins += BALANCE.onboarding.goalCoins.ownThreeFypLevels; }
    if (!reach1200Rewarded && followers >= BALANCE.onboarding.minorFollowerGoal2) { reach1200Rewarded = true; coins += BALANCE.onboarding.goalCoins.reach1200; }
    if (followers >= BALANCE.onboarding.rhythmFollowers && audience + rate >= 3) {
      if (!rhythmAt) rhythmAt = seconds;
      engagement = Math.min(100, engagement + engagementPerTap(rate) * tapsPerSecond);
      if (engagement >= 100) { engagement = 0; completions++; coins += 20; }
      const reachCost = openingUpgradeCost("audience_reach", audience);
      if (coins >= reachCost) {
        coins -= reachCost;
        audience++;
      }
    }
  }
  return { tapsPerSecond, analyticsMin: analyticsAt / 60, studioMin: studioAt / 60, rhythmMin: rhythmAt / 60, firstCompletionMin: seconds / 60, upgradeLevelsAtRhythm: audience + rate };
}

const results = [2, 2.5, 3, 4, 5].map(simulate);
for (const result of results) console.log(`${result.tapsPerSecond} tps: Analytics ${result.analyticsMin.toFixed(1)}m, Studio ${result.studioMin.toFixed(1)}m, rhythm ${result.rhythmMin.toFixed(1)}m, first completion ${result.firstCompletionMin.toFixed(1)}m`);
const median = results.find(result => result.tapsPerSecond === 3)!;
if (median.analyticsMin <= 0 || median.analyticsMin > 0.5 || median.studioMin < 0.4 || median.studioMin > 2) throw new Error("Median Analytics/Studio route misses its pacing band");
if (results.some(result => result.upgradeLevelsAtRhythm < 3 || result.firstCompletionMin >= 75)) throw new Error("Opening route deadlocked before the repeatable minigame loop");
