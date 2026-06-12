import type { BeatGrade } from "./types";
import type { FeedModId } from "../../party/types";
import { effectiveBeatSyncConfig } from "../feed/mods";

// 04 §13.2: per-ring payout = gradeMult × gainPerPost × comboMult.
export const GRADE_MULT: Record<BeatGrade, number> = { perfect: 4, good: 2, ok: 1, miss: 0 };

export const GRADE_COLOR: Record<BeatGrade, string> = {
  perfect: "var(--gold)",
  good: "var(--cyan)",
  ok: "var(--dim)",
  miss: "var(--red)",
};

// Ring `i` spawns at `startedAt + i × staggerSec`; its scale at time `t` is
// `2.2 − 1.2 × (t − spawn)/shrinkSec` — THE shared clock for both the visual
// (BeatSyncWave) and the grade (elementsSlice.tapRing/expireOrResolveWave).
// `mod` = the video card on screen (04 §13.5: `ring_slow` widens `shrinkSec`).
export function ringScale(startedAt: number, ringId: number, mod: FeedModId | null = null): number {
  const cfg = effectiveBeatSyncConfig(mod);
  const spawnAt = startedAt + ringId * cfg.staggerSec * 1000;
  const elapsedSec = (Date.now() - spawnAt) / 1000;
  return 2.2 - 1.2 * (elapsedSec / cfg.shrinkSec);
}

// `mod` = the video card on screen (04 §13.5: `wide_window` ×1.5s the windows).
export function gradeForScale(scale: number, mod: FeedModId | null = null): BeatGrade {
  const cfg = effectiveBeatSyncConfig(mod);
  const d = Math.abs(scale - 1);
  if (d <= cfg.windowPerfect) return "perfect";
  if (d <= cfg.windowGood) return "good";
  if (d <= cfg.windowOk) return "ok";
  return "miss";
}
