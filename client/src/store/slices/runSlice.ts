import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import { BALANCE } from "../../features/economy/balance";
import { computeRunParams } from "../../features/livestream/computeRunParams";
import { clamp } from "../../lib/math";
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
  returnToChannel: () => void;           // dismiss results, back to phase "idle"
};

const INITIAL_COOLDOWNS: Record<ReactionId, number> = {
  hype_dance: 0,
  clapback: 0,
  pin_comment: 0,
  shoutout: 0,
  go_off: 0,
};

// Neutral starting hype: at 50, targetViewers == startViewers (04 §7).
const INITIAL_HYPE = 50;

export const createRunSlice: StateCreator<FullState, [], [], RunSlice> = (set, get) => ({
  phase: "idle",
  params: null,
  clockSec: 0,
  viewers: 0,
  peakViewers: 0,
  hype: INITIAL_HYPE,
  events: [],
  cooldowns: { ...INITIAL_COOLDOWNS },
  collected: { coins: 0, diamonds: 0, likes: 0 },
  flopTimer: 0,

  // 04 §6: compute run params from current meta state, then go live.
  startRun: (topic) => {
    const { wallet, followerConversion, skillLevels, ownedUpgrades } = get();
    const params = computeRunParams(
      { followers: wallet.followers, followerConversion, skillLevels, ownedUpgrades },
      topic,
    );

    set({
      phase: "live",
      params,
      clockSec: 0,
      viewers: params.startViewers,
      peakViewers: params.startViewers,
      hype: INITIAL_HYPE,
      events: [],
      cooldowns: { ...INITIAL_COOLDOWNS },
      collected: { coins: 0, diamonds: 0, likes: 0 },
      flopTimer: 0,
    });
  },

  // 04 §7: hype decay, viewer easing toward hype-driven target, flop/timer end.
  // Event spawning/expiry is Phase 2.3 — not implemented here.
  runTick: (dt) => {
    const { phase, params, clockSec, hype, viewers, peakViewers, cooldowns, flopTimer } = get();
    if (phase !== "live" || !params) return;

    const newHype = clamp(hype - params.hypeDecayPerSec * dt, 0, 100);

    const targetViewers = params.startViewers * (0.6 + 0.8 * (newHype / 100));
    let newViewers = viewers + (targetViewers - viewers) * 0.5 * dt;
    newViewers = Math.max(0, newViewers);
    const newPeakViewers = Math.max(peakViewers, newViewers);

    const newCooldowns = { ...cooldowns };
    for (const id of Object.keys(newCooldowns) as ReactionId[]) {
      newCooldowns[id] = Math.max(0, newCooldowns[id] - dt);
    }

    const newClockSec = clockSec + dt;
    const newFlopTimer = newViewers < params.flopFloor ? flopTimer + dt : 0;

    set({
      clockSec: newClockSec,
      hype: newHype,
      viewers: newViewers,
      peakViewers: newPeakViewers,
      cooldowns: newCooldowns,
      flopTimer: newFlopTimer,
    });

    if (newFlopTimer >= BALANCE.run.flopGraceSec) {
      get().endRun("flop");
    } else if (newClockSec >= params.durationSec) {
      get().endRun("timer");
    }
  },

  // Phase 2.3 — gift events don't exist yet.
  collectGift: () => {},
  // Phase 2.5 — choice events don't exist yet.
  resolveChoice: () => {},
  // Phase 2.4 — reaction hotbar lands later.
  useReaction: () => {},

  // Stops the run and surfaces basic stats. Reward conversion (`scoreRun`,
  // 04 §10) and the results sheet are task 2.6 — rewards are zero here.
  endRun: (reason) => {
    const { peakViewers, hype } = get();

    set({ phase: "results" });

    return {
      reason,
      peakViewers,
      finalHype: hype,
      giftsCollected: 0,
      rewards: { followers: 0, coins: 0, diamonds: 0, likes: 0 },
      grade: "FLOP",
    };
  },

  returnToChannel: () => set({ phase: "idle", params: null }),
});
