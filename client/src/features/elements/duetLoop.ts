import type { FeedModId } from "../../party/types";
import { effectiveDuetLoopConfig } from "../feed/mods";

// 04 §13.2: an armed pod untapped for armTimeoutSec gutters back to dormant
// (no penalty). 0→1 progress toward that timeout — drives both the slice's
// timeout check (elementsSlice.expireOrResolveWave) and the glow-gutter visual
// (DuetLoopWave) from the same clock, mirroring beatSync.ts's ringScale.
// `mod` = the video card on screen (04 §13.5: `duet_flow` +1s armTimeoutSec).
export function armProgress(armedAt: number, mod: FeedModId | null = null): number {
  const elapsedSec = (Date.now() - armedAt) / 1000;
  return Math.min(1, elapsedSec / effectiveDuetLoopConfig(mod).armTimeoutSec);
}

// 04 §13.2: completing all pods within flowSec of the wave's FIRST core tap
// (not the wave's spawn time) pays the FLOW bonus.
// `mod` = the video card on screen (04 §13.5: `duet_flow` +2s flowSec).
export function isFlowed(firstArmedAt: number | null, completed: number, mod: FeedModId | null = null): boolean {
  const cfg = effectiveDuetLoopConfig(mod);
  if (completed < cfg.pods || firstArmedAt === null) return false;
  return (Date.now() - firstArmedAt) / 1000 <= cfg.flowSec;
}
