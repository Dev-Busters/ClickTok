import { BALANCE } from "../economy/balance";
import { weightedPick } from "../../lib/math";
import { CHOICE_EVENT_POOL } from "./choices";
import type { GiftTier, RunEvent } from "./types";

export const GIFT_ICON: Record<GiftTier, string> = {
  rose: "🌹",
  heart: "💗",
  galaxy: "🌌",
  lion: "🦁",
};

// Cap the live feed so a busy stream can't grow the events array unbounded.
export const MAX_FEED_EVENTS = 20;

const GIFT_TTL_SEC = 6;

export type FeedEventType = "comment" | "troll" | "hype_wave" | "choice";

const FEED_EVENT_TTL_SEC: Record<Exclude<FeedEventType, "choice">, number> = {
  comment: 6,
  troll: 9,
  hype_wave: 4,
};

// Choice prompts get longer to read + decide.
const CHOICE_TTL_SEC = 8;

const FEED_EVENT_WEIGHTS: Record<FeedEventType, number> = {
  comment: 60,
  troll: 16,
  hype_wave: 11,
  choice: 13,
};

const COMMENT_POOL = [
  "first!! 🔥",
  "wait this is actually good",
  "the algorithm sent me",
  "POV: you're watching greatness",
  "no because why is this so real 😭",
  "let's goooooo",
  "who else watching rn",
  "ngl this is fire",
  "🫡🫡🫡",
  "real one fr",
  "W stream",
  "more more more",
];

const TROLL_POOL = [
  "this is so mid ngl",
  "ratio + L + fell off",
  "unfollowed lol",
  "boooo get off",
  "fake account",
  "skip skip skip",
  "next",
  "L stream tbh",
];

function pickFrom<T>(pool: readonly T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}

// 04 §7: weighted gift tier roll. `giftQuality` shifts mass toward higher
// tiers by moving that fraction of each tier's weight up to the next tier.
export function rollGiftTier(giftQuality: number): GiftTier {
  const base = BALANCE.run.giftWeights;
  const tiers: GiftTier[] = ["rose", "heart", "galaxy", "lion"];
  const weights: Record<GiftTier, number> = { ...base };
  for (let i = 0; i < tiers.length - 1; i++) {
    const shift = base[tiers[i]] * giftQuality;
    weights[tiers[i]] -= shift;
    weights[tiers[i + 1]] += shift;
  }
  return weightedPick(weights);
}

export function spawnGiftEvent(clockSec: number, giftQuality: number): RunEvent {
  return {
    id: crypto.randomUUID(),
    type: "gift",
    spawnedAt: clockSec,
    expiresAt: clockSec + GIFT_TTL_SEC,
    resolved: false,
    giftTier: rollGiftTier(giftQuality),
  };
}

// Spawns one of comment/troll/hype_wave/choice. Avoids stacking a second hype
// wave while one is already active in the feed. `weightMultipliers` lets run
// modifiers (04 §8: tough_crowd, trending_sound) skew the spawn odds.
export function spawnFeedEvent(
  clockSec: number,
  hasActiveWave: boolean,
  weightMultipliers: Partial<Record<FeedEventType, number>> = {},
): RunEvent {
  const weights: Record<FeedEventType, number> = { ...FEED_EVENT_WEIGHTS };
  for (const key of Object.keys(weightMultipliers) as FeedEventType[]) {
    const mult = weightMultipliers[key];
    if (mult) weights[key] *= mult;
  }

  let type = weightedPick(weights);
  if (type === "hype_wave" && hasActiveWave) type = "comment";

  if (type === "choice") {
    const template = pickFrom(CHOICE_EVENT_POOL);
    return {
      id: crypto.randomUUID(),
      type: template.type,
      spawnedAt: clockSec,
      expiresAt: clockSec + CHOICE_TTL_SEC,
      resolved: false,
      text: template.text,
      choices: template.choices,
    };
  }

  const base = {
    id: crypto.randomUUID(),
    spawnedAt: clockSec,
    expiresAt: clockSec + FEED_EVENT_TTL_SEC[type],
    resolved: false,
  };

  if (type === "comment") return { ...base, type, text: pickFrom(COMMENT_POOL) };
  if (type === "troll") return { ...base, type, text: pickFrom(TROLL_POOL) };
  return { ...base, type: "hype_wave" };
}

const CRASH_TEXT = "wait... where did everyone go?? 📉 #shadowban";

// `shadowban_risk` (04 §8): the one-time mid-stream viewer crash, flavored as
// a comment so it reads in the feed without triggering troll-drain logic.
export function spawnCrashEvent(clockSec: number): RunEvent {
  return {
    id: crypto.randomUUID(),
    type: "comment",
    spawnedAt: clockSec,
    expiresAt: clockSec + FEED_EVENT_TTL_SEC.comment,
    resolved: false,
    text: CRASH_TEXT,
  };
}

// `viral_moment` (04 §8): the guaranteed huge hype wave. `amount: 1` flags it
// for `rideWave` to apply a bigger boost than a normal wave.
export function spawnViralWaveEvent(clockSec: number): RunEvent {
  return {
    id: crypto.randomUUID(),
    type: "hype_wave",
    spawnedAt: clockSec,
    expiresAt: clockSec + FEED_EVENT_TTL_SEC.hype_wave,
    resolved: false,
    amount: 1,
  };
}
