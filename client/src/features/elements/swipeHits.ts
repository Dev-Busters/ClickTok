import { BALANCE } from "../economy/balance";
import type { SwipeDir } from "./types";

// 04 §13.2 (10.4): DDR-style arrow timing. Arrow i activates staggerSec*i seconds
// after the wave spawns; its active window runs until progress = 1.
// progress < 0 → not yet active; 0–1 → hit window; > 1 → expired.
export function arrowProgress(startedAt: number, arrowId: number): number {
  const { staggerSec, activeSec } = BALANCE.elements.swipeHits;
  const activateAt = startedAt + arrowId * staggerSec * 1000;
  return (Date.now() - activateAt) / (activeSec * 1000);
}

// Detect swipe direction from pointer delta. Returns null if the swipe is too
// small to be intentional (< minDist pixels).
export function detectSwipeDir(dx: number, dy: number, minDist = 15): SwipeDir | null {
  if (Math.abs(dx) < minDist && Math.abs(dy) < minDist) return null;
  return Math.abs(dx) >= Math.abs(dy)
    ? dx > 0 ? "right" : "left"
    : dy > 0 ? "down" : "up";
}
