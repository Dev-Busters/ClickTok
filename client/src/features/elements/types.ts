// Phase 7.3+ — the clicker element framework, client-only (03 §6.5).
// 10.4: added hold_drop + swipe_hits — new element = new id here + catalog + component + slice case
export type ElementId = "beat_sync" | "duet_loop" | "hold_drop" | "swipe_hits";

export type BeatGrade = "perfect" | "good" | "ok" | "miss";

export type ElementDef = {
  id: ElementId;
  name: string;              // display name, e.g. "BEAT SYNC"
  tagline: string;           // one-line pitch shown on the locked pod / unlock sheet
  requires: { coins: number; followers: number }; // coins SPENT to unlock; followers = gate
};

// Pod position as fraction [0,1] of the stage dimensions — stored in wave state
// so the render and grade-check agree regardless of screen size (11.3 / 07 §C0).
export type PodPos = { x: number; y: number };

// One in-flight wave (ephemeral). Discriminated per element:
export type ElementWave =
  | { element: "beat_sync"; startedAt: number;   // ms epoch — THE shared clock; ring scale and
      pos: PodPos[];                             //   grading both derive from (now - startedAt)
      rings: { id: number; grade?: BeatGrade }[] }
  | { element: "duet_loop"; startedAt: number;
      pos: PodPos[];                             // 11.3: scattered positions, one per pod
      armedIndex: number | null;                 // pod lit and waiting for its tap
      armedAt: number | null;                    // ms epoch the current pod was armed
      firstArmedAt: number | null;               // ms epoch of the wave's FIRST core tap
      completed: number }                        // pods finished (0..duetCircles)
  | { element: "hold_drop"; startedAt: number;
      pos: PodPos;                               // 11.3: single pod position
      pressedAt: number | null;
      grade?: "perfect" | "weak";
      payout?: number;                           // 11.6: resolved payout multiplier for float text
      resolvedAt?: number }
  | { element: "swipe_hits"; startedAt: number;
      traces: { id: number; from: { x: number; y: number }; to: { x: number; y: number }; grade?: "perfect" | "miss" }[];
      resolvedAt?: number };                     // 11.4: anchored drag-between-dots
