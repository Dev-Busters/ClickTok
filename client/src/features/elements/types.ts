// Phase 7.3+ — the clicker element framework, client-only (03 §6.5).
// 10.4: added hold_drop + swipe_hits — new element = new id here + catalog + component + slice case
export type ElementId = "beat_sync" | "duet_loop" | "hold_drop" | "swipe_hits";

export type BeatGrade = "perfect" | "good" | "ok" | "miss";
export type SwipeDir = "up" | "down" | "left" | "right";  // 10.4: SWIPE HITS directions

export type ElementDef = {
  id: ElementId;
  name: string;              // display name, e.g. "BEAT SYNC"
  tagline: string;           // one-line pitch shown on the locked pod / unlock sheet
  requires: { coins: number; followers: number }; // coins SPENT to unlock; followers = gate
};

// One in-flight wave (ephemeral). Discriminated per element:
export type ElementWave =
  | { element: "beat_sync"; startedAt: number;   // ms epoch — THE shared clock; ring scale and
      rings: { id: number; grade?: BeatGrade }[] } //  grading both derive from (now - startedAt)
  | { element: "duet_loop"; startedAt: number;
      armedIndex: number | null;                  // pod lit and waiting for its tap
      armedAt: number | null;          // ms epoch the current pod was armed — armTimeoutSec clock
      firstArmedAt: number | null;     // ms epoch of the wave's FIRST core tap — flowSec clock
      completed: number }                         // pods finished (0..duetCircles)
  | { element: "hold_drop"; startedAt: number;   // ms epoch of wave spawn
      pressedAt: number | null;                  // ms epoch pointer went down (null = not pressed yet)
      grade?: "perfect" | "weak";                // set on release; wave clears 600ms later
      resolvedAt?: number }                      // ms epoch grade was assigned
  | { element: "swipe_hits"; startedAt: number;  // ms epoch of wave spawn
      arrows: { id: number; dir: SwipeDir; grade?: "perfect" | "miss" }[];
      resolvedAt?: number };                     // ms epoch all arrows were graded
