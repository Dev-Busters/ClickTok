import { BALANCE } from "../economy/balance";

/**
 * Momentum no longer always pays the same follower burst. Filling the bar rolls one of
 * the player's unlocked bonuses, so the payoff moment varies instead of being a single
 * repeating beat. Bonuses are bought one-off in Creator Studio; owning more widens the
 * pool rather than replacing what came before.
 */
export type MomentumBonusId =
  | "follower_surge"
  | "gold_rush"
  | "comment_storm"
  | "duet_boost"
  | "algorithm_push";

export type MomentumBonusDef = {
  id: MomentumBonusId;
  name: string;
  /** Shown on the payoff callout. */
  callout: string;
  /** Studio card copy. */
  blurb: string;
  color: string;
  /** One-off unlock price in Gold; 0 = owned from the start. */
  cost: number;
  /** Relative roll weight once unlocked. */
  weight: number;
};

export const MOMENTUM_BONUSES: readonly MomentumBonusDef[] = [
  {
    id: "follower_surge",
    name: "FOLLOWER SURGE",
    callout: "SURGE!",
    blurb: "A burst of Followers, scaled by the tap that filled the bar.",
    color: "var(--cyan)",
    cost: 0,
    weight: 30,
  },
  {
    id: "gold_rush",
    name: "GOLD RUSH",
    callout: "GOLD RUSH!",
    blurb: "Pays Gold instead of Followers — a repeatable way to fund upgrades.",
    color: "var(--gold)",
    cost: 20,
    weight: 22,
  },
  {
    id: "comment_storm",
    name: "COMMENT STORM",
    callout: "COMMENT STORM!",
    blurb: "Floods the feed with comments to grab all at once.",
    color: "#4dff9a",
    cost: 35,
    weight: 20,
  },
  {
    id: "duet_boost",
    name: "DUET",
    callout: "DUET!",
    blurb: "A creator duets you — your next taps pay multiplied.",
    color: "var(--red)",
    cost: 50,
    weight: 18,
  },
  {
    id: "algorithm_push",
    name: "ALGORITHM PUSH",
    callout: "ALGORITHM PUSH!",
    blurb: "The algorithm picks you up: guaranteed Shout-Outs and a flooded feed.",
    color: "#b56cff",
    cost: 70,
    weight: 14,
  },
];

export function momentumBonusById(id: MomentumBonusId): MomentumBonusDef {
  return MOMENTUM_BONUSES.find(bonus => bonus.id === id) ?? MOMENTUM_BONUSES[0];
}

/** `follower_surge` is always in the pool so a fill can never roll nothing. */
export function rollMomentumBonus(unlocked: readonly MomentumBonusId[]): MomentumBonusId {
  const pool = MOMENTUM_BONUSES.filter(bonus => bonus.cost === 0 || unlocked.includes(bonus.id));
  const total = pool.reduce((sum, bonus) => sum + bonus.weight, 0);
  let roll = Math.random() * total;
  for (const bonus of pool) {
    roll -= bonus.weight;
    if (roll <= 0) return bonus.id;
  }
  return pool[pool.length - 1].id;
}

/**
 * Resolved payload of one Momentum fill. Followers/coins land immediately; the timed
 * fields arm effects the tap loop and bubble feed read on subsequent frames.
 */
export type MomentumBonusResult = {
  id: MomentumBonusId;
  followers: number;
  coins: number;
  /** Bubbles to spawn instantly (comment_storm). */
  spawnBubbles: number;
  /** Taps remaining at a multiplier (duet_boost). */
  duetTaps: number;
  /** ms duration of the algorithm window (algorithm_push). */
  pushMs: number;
};

export function resolveMomentumBonus(id: MomentumBonusId, tapFollowers: number): MomentumBonusResult {
  const b = BALANCE.onboarding.momentumBonuses;
  const base: MomentumBonusResult = { id, followers: 0, coins: 0, spawnBubbles: 0, duetTaps: 0, pushMs: 0 };
  switch (id) {
    case "follower_surge":
      return { ...base, followers: Math.round(tapFollowers * b.surgeMult) };
    case "gold_rush":
      return { ...base, coins: b.goldRush.min + Math.floor(Math.random() * (b.goldRush.max - b.goldRush.min + 1)) };
    case "comment_storm":
      return { ...base, spawnBubbles: b.commentStormBubbles };
    case "duet_boost":
      return { ...base, duetTaps: b.duetTaps };
    case "algorithm_push":
      return { ...base, pushMs: b.algorithmPushMs };
  }
}
