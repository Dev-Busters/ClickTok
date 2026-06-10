import { BALANCE } from "../economy/balance";
import { weightedPick } from "../../lib/math";
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

type FeedEventType = "comment" | "troll" | "hype_wave";

const FEED_EVENT_TTL_SEC: Record<FeedEventType, number> = {
  comment: 6,
  troll: 9,
  hype_wave: 4,
};

const FEED_EVENT_WEIGHTS: Record<FeedEventType, number> = {
  comment: 70,
  troll: 18,
  hype_wave: 12,
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

// Spawns one of comment/troll/hype_wave. Avoids stacking a second hype wave
// while one is already active in the feed.
export function spawnFeedEvent(clockSec: number, hasActiveWave: boolean): RunEvent {
  let type = weightedPick(FEED_EVENT_WEIGHTS);
  if (type === "hype_wave" && hasActiveWave) type = "comment";

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
