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
 * paths, and spelling the whole word **in order** is the only way to go viral (16 §2b).
 *
 * Nothing spawns at all until the first kind unlocks — the opening screen starts empty
 * and gets busier one kind at a time as the player grows.
 */
export type BubbleKind = "comment" | "gift" | "hater" | "viral_letter";

export const VIRAL_LETTERS = ["V", "I", "R", "A", "L"] as const;
export type ViralLetter = (typeof VIRAL_LETTERS)[number];

/**
 * How a bubble travels. Ambient kinds always drift (`float`); letters roll one of the
 * five, which is what stops the set from being five identical taps.
 *
 * Every profile must keep MOVING for its whole life — a bubble that coasts to a stop
 * partway up is a free tap, which is what the first pass accidentally shipped.
 */
export type BubbleMotion = "float" | "sway" | "zigzag" | "dart" | "bob";

const LETTER_MOTIONS: readonly BubbleMotion[] = ["float", "sway", "zigzag", "dart", "bob"];

export type Bubble = {
  id: number;
  kind: BubbleKind;
  /**
   * Position WITHIN the safe lane, 0..1 — not a fraction of the screen. The renderer
   * owns the geometry (it's the only side that can measure the play area), which is how
   * a bubble is guaranteed never to drift under TEB or the creator rail.
   */
  lane: number;
  /** horizontal sway amplitude, 0..1 of the lane's width */
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
  /** per-bubble colour-drift seed, so no two bubbles morph through the same phase */
  hue: number;
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
 * Kinds available at a given point in the opening journey.
 *
 * **Nothing is available at the start.** The first minute is TEB and nothing else, so the
 * player learns one thing before the screen starts moving (playtest 2026-07-25 — comments
 * from tap one were both too early and too frequent).
 *
 * Likes are absent by design: the heart bubble was retired when VIRAL moved onto the
 * letter set, and the like mechanic is parked until the real FYP feed needs it.
 */
export function availableBubbleKinds(completed: readonly OnboardingStepId[]): BubbleKind[] {
  const kinds: BubbleKind[] = [];
  if (completed.includes("meet_teb")) kinds.push("comment");
  if (completed.includes("unlock_studio")) kinds.push("gift");
  if (completed.includes("buy_audience_reach")) kinds.push("hater");
  if (completed.includes("reach_700")) kinds.push("viral_letter");
  return kinds;
}

/** Whether the V·I·R·A·L letter set is part of the loop yet. */
export function areViralLettersAvailable(completed: readonly OnboardingStepId[]): boolean {
  return completed.includes("reach_700");
}

/**
 * The single letter the player may catch right now. Letters are collected strictly in
 * order, so only one is ever live: miss a `V` and the next letter bubble is another `V`.
 * Returns null once the word is complete (the set fires on the spot, so this is transient).
 */
export function nextViralLetter(collected: readonly ViralLetter[]): ViralLetter | null {
  return VIRAL_LETTERS[collected.length] ?? null;
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

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * `nextLetter` is the only letter that may spawn (see `nextViralLetter`). When the word
 * is momentarily complete the roll falls back to an ambient kind rather than dropping the
 * spawn, so the feed never stalls.
 *
 * Returns null when nothing is unlocked yet — the caller must not spawn.
 */
export function makeBubble(id: number, kinds: BubbleKind[], now: number, nextLetter: ViralLetter | null): Bubble | null {
  if (kinds.length === 0) return null;
  const picked = pickKind(kinds);
  const letterBlocked = picked === "viral_letter" && nextLetter === null;
  const fallback = kinds.find(k => k !== "viral_letter");
  const kind: BubbleKind = letterBlocked ? (fallback ?? picked) : picked;
  if (kind === "viral_letter" && nextLetter === null) return null;

  const isLetter = kind === "viral_letter";
  const v = BALANCE.onboarding.viralLetters;
  const lifeMs = isLetter
    ? BALANCE.onboarding.bubbles.lifetimeMs * (v.minLifetimeMult + Math.random() * (v.maxLifetimeMult - v.minLifetimeMult))
    : BALANCE.onboarding.bubbles.lifetimeMs;

  return {
    id,
    kind,
    // Letters range wider across the lane and swing harder; ambient kinds hold a line.
    lane: isLetter ? Math.random() : 0.15 + Math.random() * 0.7,
    sway: isLetter ? 0.35 + Math.random() * 0.45 : 0.1 + Math.random() * 0.2,
    spawnedAt: now,
    expiresAt: now + lifeMs,
    lifeMs,
    hue: Math.random() * 360,
    letter: isLetter ? nextLetter : null,
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
