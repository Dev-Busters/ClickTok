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

// 09 §B2: named sub-terms behind `startViewers`/`giftRate`/`hypeDecayPerSec`, so the
// 13.2 loadout panel can attribute each number to its source without re-deriving the math.
export type RunParamsBreakdown = {
  params: RunStartParams;
  viewers: {
    base: number;          // run.baseStartViewers
    fromFollowers: number; // run.followerSqrtCoeff * sqrt(followers)
    fromGear: number;      // gearViewersAdd
    charismaLevel: number;
    charismaMult: number;  // 1 + charismaViewersPerLevel * cha
    gearMult: number;      // gearViewersMul
    trendMult: number;     // topicMatch
  };
  giftRate: {
    base: number;             // run.baseGiftRate * (startViewers / giftRateViewerRef)
    monetizationLevel: number;
    monetizationMult: number; // 1 + monetizationGiftPerLevel * mon
    gearMult: number;         // gearGiftRateMul
  };
  hypeDecay: {
    base: number; // run.baseHypeDecay
    stagecraftLevel: number;
    stagecraftReduction: number; // min(0.7, stagecraftDecayReductionPerLevel * stg)
  };
};

// 04 §6: the meta → run bridge. Pure — no RNG, no rollModifiers (2.7) yet, so
// `modifiers` is always []. Shared by computeRunParams and computeRunParamsBreakdown
// so the 13.2 loadout panel can never drift from the actual run start.
function computeBreakdown(meta: RunParamsMeta, topic: string, trendHeat: number): RunParamsBreakdown {
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
  const fromFollowers = run.followerSqrtCoeff * Math.sqrt(followers);
  const charismaMult = 1 + run.charismaViewersPerLevel * cha;

  const startViewers = Math.round(
    (run.baseStartViewers + fromFollowers + gearViewersAdd) * charismaMult * gearViewersMul * topicMatch,
  );

  const giftRateBase = run.baseGiftRate * (startViewers / run.giftRateViewerRef);
  const monetizationMult = 1 + run.monetizationGiftPerLevel * mon;
  const giftRate = giftRateBase * monetizationMult * gearGiftRateMul;

  const giftQuality = run.monetizationGiftPerLevel * mon;

  const stagecraftReduction = Math.min(0.7, run.stagecraftDecayReductionPerLevel * stg);
  const hypeDecayPerSec = run.baseHypeDecay * (1 - stagecraftReduction);

  const eventIntervalSec = Math.max(
    1.2,
    run.baseEventIntervalSec * Math.pow(run.giftRateViewerRef / Math.max(startViewers, 50), 0.25),
  );

  const flopFloor = Math.max(3, Math.round(startViewers * run.flopFloorFrac));

  return {
    params: {
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
    },
    viewers: {
      base: run.baseStartViewers,
      fromFollowers,
      fromGear: gearViewersAdd,
      charismaLevel: cha,
      charismaMult,
      gearMult: gearViewersMul,
      trendMult: topicMatch,
    },
    giftRate: {
      base: giftRateBase,
      monetizationLevel: mon,
      monetizationMult,
      gearMult: gearGiftRateMul,
    },
    hypeDecay: {
      base: run.baseHypeDecay,
      stagecraftLevel: stg,
      stagecraftReduction,
    },
  };
}

export function computeRunParams(
  meta: RunParamsMeta,
  topic: string,
  trendHeat = 0,
): RunStartParams {
  return computeBreakdown(meta, topic, trendHeat).params;
}

export function computeRunParamsBreakdown(
  meta: RunParamsMeta,
  topic: string,
  trendHeat = 0,
): RunParamsBreakdown {
  return computeBreakdown(meta, topic, trendHeat);
}
