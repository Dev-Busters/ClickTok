import { BALANCE } from "../economy/balance";

// 04 §13.2 (10.4): charge ring fills from 0→1 over chargeSec.
// Both the visual (HoldDropWave) and the grade (elementsSlice.pointerUpHold /
// expireOrResolveWave) derive from the same clock to stay in sync.
export function chargeProgress(pressedAt: number): number {
  return Math.min(1, (Date.now() - pressedAt) / (BALANCE.elements.holdDrop.chargeSec * 1000));
}

// 04 §13.2 (10.4): releasing inside [windowStart, windowEnd] = PERFECT;
// outside (undercharge or overcharge) = WEAK.
export function holdGrade(progress: number): "perfect" | "weak" {
  const { windowStart, windowEnd } = BALANCE.elements.holdDrop;
  return progress >= windowStart && progress <= windowEnd ? "perfect" : "weak";
}
