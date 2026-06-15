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
  {
    id: "duet_loop",
    name: "DUET LOOP",
    tagline: "Tap the core to arm a pod, then tap it back — chain it for FLOW.",
    requires: BALANCE.elements.duetLoop.unlock,
  },
  {
    id: "hold_drop",
    name: "HOLD DROP",
    tagline: "Press and hold to charge — release inside the target window for a big payout.",
    requires: BALANCE.elements.holdDrop.unlock,
  },
  {
    id: "swipe_hits",
    name: "SWIPE HITS",
    tagline: "Swipe the arrows in the right direction before time runs out. DDR-style.",
    requires: BALANCE.elements.swipeHits.unlock,
  },
];
