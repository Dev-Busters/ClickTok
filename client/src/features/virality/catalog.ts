import { BALANCE } from "../economy/balance";
import type { ViralityUpgradeDef, ViralityUpgradeId } from "./types";

/**
 * The Viral Lab catalog (docs/18).
 *
 * Every upgrade here deepens the VIRAL system specifically — how often letters come,
 * how catchable they are, how much the window pays, and how much Virality it all
 * generates. Nothing in this shop touches the base tap; that's Creator Studio's job.
 * Keeping the two shops on separate currencies is what keeps the two loops legible.
 */
export const VIRALITY_UPGRADES: readonly ViralityUpgradeDef[] = [
  {
    id: "letter_rate",
    name: "SIGNAL BOOST",
    blurb: "The algorithm surfaces your post more often, so VIRAL letters show up in the feed at a higher rate.",
    unit: "LETTER SPAWN WEIGHT",
    revealAtTotalLevels: 0,
    color: "var(--cyan)",
  },
  {
    id: "viral_duration",
    name: "AFTERGLOW",
    blurb: "Your moment lasts. Every VIRAL window runs longer before the feed cools off.",
    unit: "VIRAL SECONDS",
    revealAtTotalLevels: 1,
    color: "var(--gold)",
  },
  {
    id: "letter_dwell",
    name: "STICKY FEED",
    blurb: "Letters linger on screen instead of racing past — more time to catch the one you need.",
    unit: "LETTER LIFETIME",
    revealAtTotalLevels: 2,
    color: "#4dff9a",
  },
  {
    id: "viral_mult",
    name: "PEAK REACH",
    blurb: "Going viral hits harder. Raises the multiplier applied to everything while the window is live.",
    unit: "VIRAL MULTIPLIER",
    revealAtTotalLevels: 4,
    color: "var(--red)",
  },
  {
    id: "virality_yield",
    name: "CLOUT CHASER",
    blurb: "You convert attention into leverage. Every letter and every completed word pays more Virality.",
    unit: "VIRALITY YIELD",
    revealAtTotalLevels: 6,
    color: "#b56cff",
  },
];

export function viralityUpgradeById(id: ViralityUpgradeId): ViralityUpgradeDef {
  return VIRALITY_UPGRADES.find(upgrade => upgrade.id === id) ?? VIRALITY_UPGRADES[0];
}

export function viralityUpgradeCost(id: ViralityUpgradeId, level: number): number {
  const def = BALANCE.onboarding.virality.upgrades[id];
  return Math.round(def.baseCost * Math.pow(def.costGrowth, level));
}

/* ── Effects ────────────────────────────────────────────────────────────────
   Each reads its own level and returns the *effective* value, so callers never
   reimplement the curve. Level 0 always returns the un-upgraded baseline. */

/** Spawn weight for `viral_letter` against the ambient kinds. */
export function letterSpawnWeight(level: number): number {
  return BALANCE.onboarding.viralLetters.spawnWeight + level * BALANCE.onboarding.virality.upgrades.letter_rate.weightPerLevel;
}

/** Multiplier on a letter's bottom→top travel time. */
export function letterLifetimeMult(level: number): number {
  return 1 + level * BALANCE.onboarding.virality.upgrades.letter_dwell.lifetimePerLevel;
}

/** How long a VIRAL window runs, in ms. */
export function viralDurationMs(level: number): number {
  return BALANCE.onboarding.viral.durationMs + level * BALANCE.onboarding.virality.upgrades.viral_duration.msPerLevel;
}

/** The multiplier applied to everything while VIRAL is live. */
export function viralMultiplier(level: number): number {
  return BALANCE.onboarding.viral.mult + level * BALANCE.onboarding.virality.upgrades.viral_mult.multPerLevel;
}

/** Scales both the per-letter and per-word Virality payouts. */
export function viralityYieldMult(level: number): number {
  return 1 + level * BALANCE.onboarding.virality.upgrades.virality_yield.yieldPerLevel;
}

/** Virality paid for catching one letter. */
export function viralityPerLetter(yieldLevel: number): number {
  return Math.max(1, Math.round(BALANCE.onboarding.virality.perLetter * viralityYieldMult(yieldLevel)));
}

/** Virality paid for completing the whole word (on top of the last letter). */
export function viralityPerWord(yieldLevel: number): number {
  return Math.max(1, Math.round(BALANCE.onboarding.virality.perWord * viralityYieldMult(yieldLevel)));
}

/** The before → after readout each card shows. Keeps display logic out of the UI. */
export function viralityUpgradeValue(id: ViralityUpgradeId, level: number): string {
  switch (id) {
    case "letter_rate": return `${letterSpawnWeight(level)}`;
    case "viral_duration": return `${(viralDurationMs(level) / 1000).toFixed(1)}s`;
    case "letter_dwell": return `×${letterLifetimeMult(level).toFixed(2)}`;
    case "viral_mult": return `×${viralMultiplier(level).toFixed(2)}`;
    case "virality_yield": return `${viralityPerLetter(level)} / ${viralityPerWord(level)}`;
  }
}

/** Cards the player can currently see, drip-fed by total levels owned. */
export function visibleViralityUpgrades(levels: Record<ViralityUpgradeId, number>): ViralityUpgradeDef[] {
  const total = VIRALITY_UPGRADES.reduce((sum, upgrade) => sum + levels[upgrade.id], 0);
  // An owned upgrade never hides again, even if its reveal threshold is somehow ahead.
  return VIRALITY_UPGRADES.filter(upgrade => total >= upgrade.revealAtTotalLevels || levels[upgrade.id] > 0);
}
