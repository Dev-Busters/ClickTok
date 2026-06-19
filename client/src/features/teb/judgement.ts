import { BALANCE } from "../economy/balance";
import type { NodeKind, RhythmJudgementLabel } from "./types";
import type { NodePos } from "./types";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function timingQuality(errorMs: number): number {
  const e = Math.abs(errorMs);
  const r = BALANCE.teb.rhythm;
  if (e <= r.perfectWindowMs) return 1;
  if (e <= r.greatWindowMs) {
    const t = (e - r.perfectWindowMs) / (r.greatWindowMs - r.perfectWindowMs);
    return 1 + (r.greatQuality - 1) * t;
  }
  if (e <= r.goodWindowMs) {
    const t = (e - r.greatWindowMs) / (r.goodWindowMs - r.greatWindowMs);
    return r.greatQuality * (1 - t);
  }
  return 0;
}

export function judgementLabel(quality: number): RhythmJudgementLabel {
  if (quality >= BALANCE.teb.rhythm.perfectQuality) return "perfect";
  if (quality >= BALANCE.teb.rhythm.greatQuality) return "great";
  return quality > 0 ? "good" : "miss";
}

export const holdQuality = (start: number, integrity: number, release: number) => clamp01(.3 * start + .45 * integrity + .25 * release);
export const swipeQuality = (start: number, links: number, control: number) => clamp01(.25 * start + .45 * links + .3 * control);
export const traceQuality = (start: number, coverage: number, end: number) => clamp01(.2 * start + .55 * coverage + .25 * end);

export function interactionWeight(kind: NodeKind): number {
  return kind === "tap" ? 1 : kind === "hold" ? 1.5 : kind === "swipe" ? .75 : 2;
}

function pointSegmentDistance(p: NodePos, a: NodePos, b: NodePos): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : clamp01(((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq);
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** Fixed-distance rail buckets covered by pointer segments; event density cannot add score. */
export function distanceWeightedPathCoverage(samples: NodePos[], path: NodePos[], radius = .12): number {
  if (path.length === 0 || samples.length < 2) return 0;
  let covered = 0;
  for (const bucket of path) {
    if (samples.slice(1).some((point, i) => pointSegmentDistance(bucket, samples[i], point) <= radius)) covered++;
  }
  return covered / path.length;
}

export function gestureControl(samples: NodePos[], idealPath: NodePos[]): number {
  const length = (points: NodePos[]) => points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0);
  const ideal = Math.max(length(idealPath), .001);
  return clamp01(1 - Math.max(0, length(samples) - ideal) / ideal);
}
