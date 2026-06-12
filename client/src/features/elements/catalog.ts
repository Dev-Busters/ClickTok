import { BALANCE } from "../economy/balance";
import type { ElementDef } from "./types";

// Catalog of unlockable elements (01 §8.2). Adding element N+1 = a catalog
// entry + one component + a slice case for its wave — see task 7.4's note.
export const ELEMENT_CATALOG: ElementDef[] = [
  {
    id: "beat_sync",
    name: "BEAT SYNC",
    tagline: "Tap the rings in rhythm — PERFECT timing pays the most.",
    requires: BALANCE.elements.beatSync.unlock,
  },
];
