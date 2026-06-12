import { BALANCE } from "../economy/balance";

// 04 §13.2: an armed pod untapped for armTimeoutSec gutters back to dormant
// (no penalty). 0→1 progress toward that timeout — drives both the slice's
// timeout check (elementsSlice.expireOrResolveWave) and the glow-gutter visual
// (DuetLoopWave) from the same clock, mirroring beatSync.ts's ringScale.
export function armProgress(armedAt: number): number {
  const elapsedSec = (Date.now() - armedAt) / 1000;
  return Math.min(1, elapsedSec / BALANCE.elements.duetLoop.armTimeoutSec);
}

// 04 §13.2: completing all pods within flowSec of the wave's FIRST core tap
// (not the wave's spawn time) pays the FLOW bonus.
export function isFlowed(firstArmedAt: number | null, completed: number): boolean {
  if (completed < BALANCE.elements.duetLoop.pods || firstArmedAt === null) return false;
  return (Date.now() - firstArmedAt) / 1000 <= BALANCE.elements.duetLoop.flowSec;
}
