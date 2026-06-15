import { BALANCE } from "../economy/balance";

// Charge ring fills from 0→1 over chargeSec.
// Both visual and grade logic derive from the same clock.
export function chargeProgress(pressedAt: number): number {
  return Math.min(1, (Date.now() - pressedAt) / (BALANCE.elements.holdDrop.chargeSec * 1000));
}

// Golden crest oscillates on the ring so the target window moves while the ring fills.
export function crestPos(pressedAt: number): number {
  const t = (Date.now() - pressedAt) / 1000;
  const { crestCenter, crestAmplitude, crestPeriodSec } = BALANCE.elements.holdDrop;
  return crestCenter + crestAmplitude * Math.sin(2 * Math.PI * t / crestPeriodSec);
}

// Returns grade + closeness [0,1] (1 = dead center, 0 = edge of zone).
export function holdGrade(
  progress: number,
  pressedAt: number,
): { grade: "perfect" | "weak"; closeness: number } {
  const { crestHalfWidth } = BALANCE.elements.holdDrop;
  const crest = crestPos(pressedAt);
  const dist = Math.abs(progress - crest);
  if (dist <= crestHalfWidth) {
    return { grade: "perfect", closeness: 1 - dist / crestHalfWidth };
  }
  return { grade: "weak", closeness: 0 };
}
