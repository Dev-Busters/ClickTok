import { BALANCE } from "../economy/balance";

// 11.4: trace timing — trace i activates staggerSec*i seconds after spawn.
// progress < 0 → not yet active; 0–1 → hit window; > 1 → expired.
export function traceProgress(startedAt: number, traceId: number): number {
  const { staggerSec, activeSec } = BALANCE.elements.swipeHits;
  const activateAt = startedAt + traceId * staggerSec * 1000;
  return (Date.now() - activateAt) / (activeSec * 1000);
}

// Returns true if the release point is within hitRadiusPx of the TO dot's screen position.
export function isOnTarget(
  release: { x: number; y: number },
  toScreen: { x: number; y: number },
  radiusPx: number,
): boolean {
  const dx = release.x - toScreen.x;
  const dy = release.y - toScreen.y;
  return Math.sqrt(dx * dx + dy * dy) <= radiusPx;
}
