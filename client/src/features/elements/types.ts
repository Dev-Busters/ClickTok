// Phase 7.3+ — the clicker element framework, client-only (03 §6.5).
export type ElementId = "beat_sync" | "duet_loop";   // extensible — new elements = new id here

export type BeatGrade = "perfect" | "good" | "ok" | "miss";

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
      completed: number };                        // pods finished (0..duetCircles)
