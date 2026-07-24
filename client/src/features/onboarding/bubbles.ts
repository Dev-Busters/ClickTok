import { BALANCE } from "../economy/balance";
import type { OnboardingStepId } from "./types";

/**
 * The engagement feed: comments, likes, gifts and haters drift up the screen while
 * the player taps TEB. Tapping one pays a bonus. Nothing here demands timing — targets
 * are large and live for seconds — so it adds a second thing to *do* without adding a
 * second thing to *concentrate on* (the failure mode of the retired pulse system).
 *
 * Kinds unlock one at a time alongside the onboarding journey so the screen gets busier
 * as the player grows, rather than dumping four mechanics at once.
 */
export type BubbleKind = "like" | "comment" | "gift" | "hater";

export type Bubble = {
  id: number;
  kind: BubbleKind;
  /** normalized 0..1 horizontal position of the drift channel */
  x: number;
  /** horizontal sway amplitude, normalized */
  sway: number;
  spawnedAt: number;
  expiresAt: number;
  /** authored flavour text (comments/haters only) */
  text: string | null;
};

const COMMENT_TEXTS = [
  "first!!", "algorithm sent me", "this is so real",
  "how did you do that", "okay but the transition", "no bc same",
  "saving this fr", "you ate", "part 2 pls", "the way I gasped",
];

const HATER_TEXTS = [
  "mid tbh", "fell off", "ratio", "this ain't it", "who asked",
];

/** Kinds available at a given point in the opening journey. */
export function availableBubbleKinds(completed: readonly OnboardingStepId[]): BubbleKind[] {
  const kinds: BubbleKind[] = ["like"];
  if (completed.includes("meet_teb")) kinds.push("comment");
  if (completed.includes("unlock_studio")) kinds.push("gift");
  if (completed.includes("buy_audience_reach")) kinds.push("hater");
  return kinds;
}

/** Gifts and haters stay rare; likes/comments carry the ambient rhythm. */
const KIND_WEIGHT: Record<BubbleKind, number> = {
  like: 44,
  comment: 34,
  gift: 12,
  hater: 10,
};

function pickKind(kinds: BubbleKind[]): BubbleKind {
  const total = kinds.reduce((sum, k) => sum + KIND_WEIGHT[k], 0);
  let roll = Math.random() * total;
  for (const kind of kinds) {
    roll -= KIND_WEIGHT[kind];
    if (roll <= 0) return kind;
  }
  return kinds[kinds.length - 1];
}

/**
 * Spawn channels hug the left and right edges so bubbles never cover TEB in the
 * centre of the play area (and so a bubble tap can never be mistaken for a TEB tap).
 */
function pickChannel(): { x: number; sway: number } {
  const left = Math.random() < 0.5;
  const base = left ? 0.10 + Math.random() * 0.16 : 0.74 + Math.random() * 0.16;
  return { x: base, sway: 0.02 + Math.random() * 0.03 };
}

export function makeBubble(id: number, kinds: BubbleKind[], now: number): Bubble {
  const kind = pickKind(kinds);
  const { x, sway } = pickChannel();
  return {
    id,
    kind,
    x,
    sway,
    spawnedAt: now,
    expiresAt: now + BALANCE.onboarding.bubbles.lifetimeMs,
    text: kind === "comment" ? COMMENT_TEXTS[Math.floor(Math.random() * COMMENT_TEXTS.length)]
      : kind === "hater" ? HATER_TEXTS[Math.floor(Math.random() * HATER_TEXTS.length)]
      : null,
  };
}

/** Milliseconds until the next spawn, jittered so the feed never feels metronomic. */
export function nextSpawnDelay(rateMult: number): number {
  const b = BALANCE.onboarding.bubbles;
  const base = b.baseSpawnMs / Math.max(0.0001, rateMult);
  const jittered = base * (0.65 + Math.random() * 0.7);
  return Math.max(b.minSpawnMs, jittered);
}
