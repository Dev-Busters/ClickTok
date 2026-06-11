import { BALANCE } from "../economy/balance";
import type { RunModifier, RunModifierId, RunStartParams } from "./types";

export const MODIFIER_CATALOG: Record<RunModifierId, RunModifier> = {
  algorithm_boost: {
    id: "algorithm_boost",
    name: "Algorithm Boost",
    description: "+40% start viewers, but hype decays 30% faster",
  },
  tough_crowd: {
    id: "tough_crowd",
    name: "Tough Crowd",
    description: "Trolls show up 50% more often, but gifts pay 40% more",
  },
  trending_sound: {
    id: "trending_sound",
    name: "Trending Sound",
    description: "Hype waves come 2x as often and hit 20% harder",
  },
  shadowban_risk: {
    id: "shadowban_risk",
    name: "Shadowban Risk",
    description: "15% chance of a mid-stream viewer crash",
  },
  viral_moment: {
    id: "viral_moment",
    name: "Viral Moment",
    description: "Guaranteed one huge hype wave this run",
  },
};

const ALL_MODIFIER_IDS: RunModifierId[] = [
  "algorithm_boost", "tough_crowd", "trending_sound", "shadowban_risk", "viral_moment",
];

// `04` §8 names effects but not magnitudes — these are implementation
// choices, anchored to the wording of each effect description above.
export const MODIFIER_EFFECTS = {
  algorithmBoostViewersMult: 1.4,
  algorithmBoostHypeDecayMult: 1.3,
  toughCrowdTrollFreqMult: 1.5,
  toughCrowdGiftValueMult: 1.4,
  trendingSoundWaveFreqMult: 2,
  trendingSoundWaveStrengthMult: 1.2,
  shadowbanChance: 0.15,
  shadowbanViewerMult: 0.5,
  shadowbanHypeLoss: 25,
  viralWaveBoostMult: 2,
  viralWaveHypeGain: 30,
} as const;

// Modifiers that pull the same axis in opposite directions (boost the good
// side vs. lean into the bad side) — don't roll both in one run.
const CONFLICTS: Partial<Record<RunModifierId, RunModifierId>> = {
  algorithm_boost: "shadowban_risk",
  shadowban_risk: "algorithm_boost",
  trending_sound: "viral_moment",
  viral_moment: "trending_sound",
};

export function hasModifier(modifiers: RunModifier[], id: RunModifierId): boolean {
  return modifiers.some(m => m.id === id);
}

// 04 §8: roll 1 modifier always; a 2nd with 40% chance, never a conflicting pair.
export function rollModifiers(rng: () => number = Math.random): RunModifier[] {
  const first = ALL_MODIFIER_IDS[Math.floor(rng() * ALL_MODIFIER_IDS.length)];
  const picked: RunModifierId[] = [first];

  if (rng() < 0.4) {
    const conflict = CONFLICTS[first];
    const candidates = ALL_MODIFIER_IDS.filter(id => id !== first && id !== conflict);
    if (candidates.length > 0) {
      picked.push(candidates[Math.floor(rng() * candidates.length)]);
    }
  }

  return picked.map(id => MODIFIER_CATALOG[id]);
}

// Bakes `algorithm_boost`'s start-viewers/hype-decay shift into the computed
// params. `giftRate`/`eventIntervalSec`/`flopFloor` are derived purely from
// `startViewers` + BALANCE constants (04 §6), so they're rescaled/recomputed
// from the boosted viewer count to stay consistent.
export function applyModifiers(params: RunStartParams, modifiers: RunModifier[]): RunStartParams {
  if (!hasModifier(modifiers, "algorithm_boost")) {
    return { ...params, modifiers };
  }

  const { run } = BALANCE;
  const startViewers = Math.round(params.startViewers * MODIFIER_EFFECTS.algorithmBoostViewersMult);
  const giftRate = params.giftRate * (startViewers / params.startViewers);
  const hypeDecayPerSec = params.hypeDecayPerSec * MODIFIER_EFFECTS.algorithmBoostHypeDecayMult;
  const eventIntervalSec = Math.max(
    1.2,
    run.baseEventIntervalSec * Math.pow(run.giftRateViewerRef / Math.max(startViewers, 50), 0.25),
  );
  const flopFloor = Math.max(3, Math.round(startViewers * run.flopFloorFrac));

  return { ...params, startViewers, giftRate, hypeDecayPerSec, eventIntervalSec, flopFloor, modifiers };
}
