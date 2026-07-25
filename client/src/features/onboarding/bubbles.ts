import { BALANCE } from "../economy/balance";
import type { OnboardingStepId } from "./types";

/**
 * The engagement feed: comments, gifts, haters and VIRAL letters drift up the screen
 * while the player taps TEB. Tapping one pays a bonus. The ambient kinds demand no
 * timing — targets are large and live for seconds — so they add a second thing to *do*
 * without adding a second thing to *concentrate on* (the failure mode of the retired
 * pulse system).
 *
 * `viral_letter` is the deliberate exception: letters move faster and along varied
 * paths, and collecting the whole word is the ONLY way to go viral (16 §2b). That's the
 * one place in the opening where reaction is asked for — and it is entirely optional.
 *
 * Kinds unlock one at a time alongside the onboarding journey so the screen gets busier
 * as the player grows, rather than dumping four mechanics at once.
 */
export type BubbleKind = "comment" | "gift" | "hater" | "viral_letter";

export const VIRAL_LETTERS = ["V", "I", "R", "A", "L"] as const;
export type ViralLetter = (typeof VIRAL_LETTERS)[number];

/**
 * How a bubble travels. Ambient kinds always drift (`float`); letters roll one of the
 * five, which is what stops the set from being five identical taps.
 */
export type BubbleMotion = "float" | "sway" | "zigzag" | "dart" | "bob";

const LETTER_MOTIONS: readonly BubbleMotion[] = ["float", "sway", "zigzag", "dart", "bob"];

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
  /** which letter this is, for `viral_letter` bubbles */
  letter: ViralLetter | null;
  motion: BubbleMotion;
  /** bottom→top travel time; letters vary, ambient kinds use `bubbles.lifetimeMs` */
  lifeMs: number;
};

const COMMENT_TEXTS = [
  "first!!", "algorithm sent me", "this is so real",
  "how did you do that", "okay but the transition", "no bc same",
  "saving this fr", "you ate", "part 2 pls", "the way I gasped",
];

const HATER_TEXTS = [
  "mid tbh", "fell off", "ratio", "this ain't it", "who asked",
];

/**
 * Kinds available at a given point in the opening journey. Likes are deliberately absent
 * — the heart bubble was retired when VIRAL moved onto the letter set, and the like
 * mechanic is parked until the real FYP feed needs it.
 */
export function availableBubbleKinds(completed: readonly OnboardingStepId[]): BubbleKind[] {
  const kinds: BubbleKind[] = ["comment"];
  if (completed.includes("unlock_studio")) kinds.push("gift");
  if (completed.includes("buy_audience_reach")) kinds.push("hater");
  if (completed.includes("reach_700")) kinds.push("viral_letter");
  return kinds;
}

/** Whether the V·I·R·A·L letter set is part of the loop yet. */
export function areViralLettersAvailable(completed: readonly OnboardingStepId[]): boolean {
  return completed.includes("reach_700");
}

/** Gifts and haters stay rare; comments carry the ambient rhythm, letters push ahead of both. */
const KIND_WEIGHT: Record<BubbleKind, number> = {
  comment: 44,
  gift: 12,
  hater: 10,
  viral_letter: BALANCE.onboarding.viralLetters.spawnWeight,
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
 * Letters get slightly wider, more outboard channels because their motion profiles
 * swing them further sideways than an ambient drift ever does.
 */
function pickChannel(letter: boolean): { x: number; sway: number } {
  const left = Math.random() < 0.5;
  if (letter) {
    const base = left ? 0.07 + Math.random() * 0.13 : 0.80 + Math.random() * 0.13;
    return { x: base, sway: 0.04 + Math.random() * 0.06 };
  }
  const base = left ? 0.10 + Math.random() * 0.16 : 0.74 + Math.random() * 0.16;
  return { x: base, sway: 0.02 + Math.random() * 0.03 };
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * `missingLetters` are the letters the player still needs. Spawning only from that set
 * means a run at the word always converges — the challenge is catching fast, erratic
 * targets before the set window expires, not waiting for the right letter to appear.
 */
export function makeBubble(id: number, kinds: BubbleKind[], now: number, missingLetters: readonly ViralLetter[] = VIRAL_LETTERS): Bubble {
  const picked = pickKind(kinds);
  const kind: BubbleKind = picked === "viral_letter" && missingLetters.length === 0 ? "comment" : picked;
  const isLetter = kind === "viral_letter";
  const { x, sway } = pickChannel(isLetter);
  const v = BALANCE.onboarding.viralLetters;
  const lifeMs = isLetter
    ? BALANCE.onboarding.bubbles.lifetimeMs * (v.minLifetimeMult + Math.random() * (v.maxLifetimeMult - v.minLifetimeMult))
    : BALANCE.onboarding.bubbles.lifetimeMs;

  return {
    id,
    kind,
    x,
    sway,
    spawnedAt: now,
    expiresAt: now + lifeMs,
    lifeMs,
    letter: isLetter ? pick(missingLetters) : null,
    motion: isLetter ? pick(LETTER_MOTIONS) : "float",
    text: kind === "comment" ? pick(COMMENT_TEXTS)
      : kind === "hater" ? pick(HATER_TEXTS)
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
