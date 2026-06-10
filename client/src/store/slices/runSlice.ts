import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import type {
  ReactionId,
  RunEvent,
  RunPhase,
  RunResult,
  RunStartParams,
} from "../../features/livestream/types";

export type RunSlice = {
  phase: RunPhase;
  params: RunStartParams | null;
  clockSec: number;          // elapsed run time
  viewers: number;
  peakViewers: number;
  hype: number;              // 0..100
  events: RunEvent[];        // active feed items
  cooldowns: Record<ReactionId, number>; // seconds remaining
  collected: { coins: number; diamonds: number; likes: number };
  flopTimer: number;         // seconds spent under flopFloor

  startRun: (topic: string) => void;     // compute params from meta, go live
  runTick: (dt: number) => void;         // the run loop step (engine)
  collectGift: (eventId: string) => void;
  resolveChoice: (eventId: string, choiceIndex: number) => void;
  useReaction: (id: ReactionId) => void;
  endRun: (reason: "voluntary" | "timer" | "flop") => RunResult;
};

const INITIAL_COOLDOWNS: Record<ReactionId, number> = {
  hype_dance: 0,
  clapback: 0,
  pin_comment: 0,
  shoutout: 0,
  go_off: 0,
};

// Stub: the run engine (event spawner, scoring, reactions) lands in Phase 2.
export const createRunSlice: StateCreator<FullState, [], [], RunSlice> = () => ({
  phase: "idle",
  params: null,
  clockSec: 0,
  viewers: 0,
  peakViewers: 0,
  hype: 0,
  events: [],
  cooldowns: { ...INITIAL_COOLDOWNS },
  collected: { coins: 0, diamonds: 0, likes: 0 },
  flopTimer: 0,

  startRun: () => {},
  runTick: () => {},
  collectGift: () => {},
  resolveChoice: () => {},
  useReaction: () => {},
  endRun: () => ({
    reason: "voluntary",
    peakViewers: 0,
    finalHype: 0,
    giftsCollected: 0,
    rewards: { followers: 0, coins: 0, diamonds: 0, likes: 0 },
    grade: "FLOP",
  }),
});
