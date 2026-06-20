import { BALANCE } from "../src/features/economy/balance";
import { engagementPerTap, followerChance, openingUpgradeCost } from "../src/features/onboarding/helpers";

type Result = { tapsPerSecond: number; studioMin: number; rhythmMin: number; firstCompletionMin: number; upgradeLevelsAtRhythm: number };

function simulate(tapsPerSecond: number): Result {
  let seconds = 0, followers = 0, coins = 0, engagement = 0, completions = 0;
  let audience = 0, rate = 0, studioAt = 0, rhythmAt = 0;
  let studioRewarded = false, audienceRewarded = false, reach700Rewarded = false, threeRewarded = false, reach1200Rewarded = false;
  while (completions < 1 && seconds < 60 * 45) {
    seconds += 1;
    followers += followerChance(audience) * tapsPerSecond;
    if (!studioRewarded && followers >= 400) { studioRewarded = true; studioAt = seconds; coins += 10; }
    if (studioRewarded && audience === 0 && coins >= openingUpgradeCost("audience_reach", audience)) { coins -= openingUpgradeCost("audience_reach", audience++); audienceRewarded = true; coins += 18; }
    if (audienceRewarded && rate === 0 && coins >= openingUpgradeCost("engagement_rate", rate)) coins -= openingUpgradeCost("engagement_rate", rate++);
    if (!reach700Rewarded && followers >= 700) { reach700Rewarded = true; coins += 20; }
    if (audience + rate < 3 && coins >= openingUpgradeCost("audience_reach", audience)) audience++, coins -= openingUpgradeCost("audience_reach", audience - 1);
    if (!threeRewarded && audience + rate >= 3) { threeRewarded = true; coins += 35; }
    if (!reach1200Rewarded && followers >= 1200) { reach1200Rewarded = true; coins += 40; }
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
  return { tapsPerSecond, studioMin: studioAt / 60, rhythmMin: rhythmAt / 60, firstCompletionMin: seconds / 60, upgradeLevelsAtRhythm: audience + rate };
}

const results = [2, 2.5, 3, 4, 5].map(simulate);
for (const result of results) console.log(`${result.tapsPerSecond} tps: Studio ${result.studioMin.toFixed(1)}m, rhythm ${result.rhythmMin.toFixed(1)}m, first completion ${result.firstCompletionMin.toFixed(1)}m`);
const median = results.find(result => result.tapsPerSecond === 3)!;
if (median.studioMin < 7 || median.studioMin > 12 || median.rhythmMin < 22 || median.rhythmMin > 32) throw new Error("Median onboarding route misses a pacing band");
if (results.some(result => result.upgradeLevelsAtRhythm < 3 || result.firstCompletionMin >= 45)) throw new Error("Opening route failed to reach the repeatable minigame loop");
