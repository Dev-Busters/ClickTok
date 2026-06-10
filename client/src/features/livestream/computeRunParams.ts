import { BALANCE } from "../economy/balance";
import { UPGRADE_CATALOG } from "../upgrades/catalog";
import type { SkillId } from "../skills/types";
import type { ReactionId, RunStartParams } from "./types";

export type RunParamsMeta = {
  followers: number;
  followerConversion: number;
  skillLevels: Record<SkillId, number>;
  ownedUpgrades: Record<string, boolean>;
};

// 04 §6: the meta → run bridge. Pure function — no RNG, no rollModifiers (2.7) yet,
// so `modifiers` is always [] for now.
export function computeRunParams(
  meta: RunParamsMeta,
  topic: string,
  trendHeat = 0,
): RunStartParams {
  const { run } = BALANCE;
  const { followers, followerConversion, skillLevels, ownedUpgrades } = meta;
  const cha = skillLevels.charisma;
  const mon = skillLevels.monetization;
  const stg = skillLevels.stagecraft;

  let gearViewersAdd = 0;
  let gearViewersMul = 1;
  let gearGiftRateMul = 1;
  const reactions: ReactionId[] = ["hype_dance"];

  for (const def of UPGRADE_CATALOG) {
    if (!ownedUpgrades[def.id]) continue;
    const e = def.effect;
    if (e.runStartViewersAdd) gearViewersAdd += e.runStartViewersAdd;
    if (e.runStartViewersMult) gearViewersMul *= e.runStartViewersMult;
    if (e.runGiftRateMult) gearGiftRateMul *= e.runGiftRateMult;
    if (e.unlocksReaction) reactions.push(e.unlocksReaction);
  }

  const topicMatch = 1 + trendHeat * 0.5;

  const startViewers = Math.round(
    (run.baseStartViewers + run.followerSqrtCoeff * Math.sqrt(followers) + gearViewersAdd)
    * (1 + run.charismaViewersPerLevel * cha)
    * gearViewersMul
    * topicMatch,
  );

  const giftRate = run.baseGiftRate
    * (startViewers / run.giftRateViewerRef)
    * (1 + run.monetizationGiftPerLevel * mon)
    * gearGiftRateMul;

  const giftQuality = run.monetizationGiftPerLevel * mon;

  const hypeDecayPerSec = run.baseHypeDecay
    * (1 - Math.min(0.7, run.stagecraftDecayReductionPerLevel * stg));

  const eventIntervalSec = Math.max(
    1.2,
    run.baseEventIntervalSec * Math.pow(run.giftRateViewerRef / Math.max(startViewers, 50), 0.25),
  );

  const flopFloor = Math.max(3, Math.round(startViewers * run.flopFloorFrac));

  return {
    topic,
    startViewers,
    giftRate,
    giftQuality,
    hypeDecayPerSec,
    eventIntervalSec,
    flopFloor,
    durationSec: run.durationSec,
    followerConversion,
    trendMultiplier: topicMatch,
    reactions,
    modifiers: [],
  };
}
