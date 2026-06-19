// features/teb/charge.ts — Phase 16 (pure helpers per 04 §15.1, 12 §B)
//
// The hold-to-charge move: a ring shrinks from chargeStartScale toward
// chargeEndScale over chargeShrinkSec. Releasing near scale 1.0 (= TEB's
// size) yields the highest chargeQuality; releasing too early or too late
// yields lower quality. Quality is a deterministic multiplier, never a gate.

import { BALANCE } from "../economy/balance";

const { chargeStartScale, chargeEndScale, chargeShrinkSec, chargeTolerance } =
  BALANCE.teb;

/** Clamp value to [0, 1]. */
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Current ring scale given the charge start time.
 * Linear interpolation: chargeStartScale → chargeEndScale over chargeShrinkSec.
 * Scale 1.0 = exactly TEB's size (the target).
 */
export function ringScale(pressedAt: number, now: number = Date.now()): number {
  const elapsed = (now - pressedAt) / 1000;
  const t = clamp01(elapsed / chargeShrinkSec);
  return chargeStartScale + (chargeEndScale - chargeStartScale) * t;
}

/**
 * Charge quality from the ring's scale at release.
 * 1.0 = dead-on match (scale === 1.0); 0 = outside tolerance band.
 */
export function chargeQuality(scale: number): number {
  return clamp01(1 - Math.abs(scale - 1) / chargeTolerance);
}
