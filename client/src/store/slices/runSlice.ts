import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import { BALANCE } from "../../features/economy/balance";
import { computeRunParams } from "../../features/livestream/computeRunParams";
import { MAX_FEED_EVENTS, spawnFeedEvent, spawnGiftEvent } from "../../features/livestream/events";
import { REACTION_CATALOG } from "../../features/livestream/reactions";
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
  giftRateBoostUntil: number; // clockSec until which `shoutout` doubles gift spawn rate
  gainsBoostUntil: number;     // clockSec until which `go_off` triples collected gains

  startRun: (topic: string) => void;     // compute params from meta, go live
  runTick: (dt: number) => void;         // the run loop step (engine)
  collectGift: (eventId: string) => void;
  rideWave: (eventId: string) => void;
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
  giftRateBoostUntil: 0,
  gainsBoostUntil: 0,

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
      giftRateBoostUntil: 0,
      gainsBoostUntil: 0,
    });
  },

  // 04 §7: hype decay, troll drain, viewer easing, event spawn/expiry, flop/timer end.
  runTick: (dt) => {
    const {
      phase, params, clockSec, hype, viewers, peakViewers, cooldowns, flopTimer,
      events, giftRateBoostUntil,
    } = get();
    if (phase !== "live" || !params) return;

    const newClockSec = clockSec + dt;

    // Expire events whose lifetime is over before computing troll drain/spawns.
    let liveEvents = events.filter(e => e.expiresAt > newClockSec);
    const activeTrolls = liveEvents.filter(e => e.type === "troll").length;

    const newHype = clamp(
      hype - params.hypeDecayPerSec * dt - activeTrolls * BALANCE.run.trollHypeDrainPerSec * dt,
      0, 100,
    );

    const targetViewers = params.startViewers * (0.6 + 0.8 * (newHype / 100));
    let newViewers = viewers + (targetViewers - viewers) * 0.5 * dt;
    newViewers -= activeTrolls * BALANCE.run.trollViewerDrainPerSec * newViewers * dt;
    newViewers = Math.max(0, newViewers);
    const newPeakViewers = Math.max(peakViewers, newViewers);

    const newCooldowns = { ...cooldowns };
    for (const id of Object.keys(newCooldowns) as ReactionId[]) {
      newCooldowns[id] = Math.max(0, newCooldowns[id] - dt);
    }

    // Gifts spawn on their own Poisson process at `giftRate`/sec (`shoutout` doubles it).
    const giftRateMult = newClockSec < giftRateBoostUntil ? 2 : 1;
    if (Math.random() < params.giftRate * giftRateMult * dt) {
      liveEvents = [...liveEvents, spawnGiftEvent(newClockSec, params.giftQuality)];
    }

    // Comments/trolls/hype-waves spawn on the general `eventIntervalSec` schedule.
    if (Math.random() < dt / params.eventIntervalSec) {
      const hasActiveWave = liveEvents.some(e => e.type === "hype_wave");
      liveEvents = [...liveEvents, spawnFeedEvent(newClockSec, hasActiveWave)];
    }

    if (liveEvents.length > MAX_FEED_EVENTS) {
      liveEvents = liveEvents.slice(liveEvents.length - MAX_FEED_EVENTS);
    }

    const newFlopTimer = newViewers < params.flopFloor ? flopTimer + dt : 0;

    set({
      clockSec: newClockSec,
      hype: newHype,
      viewers: newViewers,
      peakViewers: newPeakViewers,
      cooldowns: newCooldowns,
      flopTimer: newFlopTimer,
      events: liveEvents,
    });

    if (newFlopTimer >= BALANCE.run.flopGraceSec) {
      get().endRun("flop");
    } else if (newClockSec >= params.durationSec - 1e-6) {
      // -1e-6: a fixed-step accumulator summing 0.1 repeatedly asymptotes just
      // under durationSec due to float drift and would never reach it exactly.
      get().endRun("timer");
    }
  },

  // 04 §7: tap a gift to collect it. Value scales with monetization + hype
  // (and `go_off`'s ×3 gains window).
  collectGift: (eventId) => {
    const { events, hype, collected, clockSec, gainsBoostUntil, skillLevels } = get();
    const event = events.find(e => e.id === eventId);
    if (!event || event.type !== "gift" || event.resolved || !event.giftTier) return;

    const tier = event.giftTier;
    const valueBonus = 1 + BALANCE.run.monetizationGiftPerLevel * skillLevels.monetization;
    const hypeBonus = 1 + hype / 100;
    const gainsMult = clockSec < gainsBoostUntil ? 3 : 1;
    const mult = valueBonus * hypeBonus * gainsMult;

    const coins = Math.round(BALANCE.run.giftCoinValue[tier] * mult);
    const diamonds = Math.round(BALANCE.run.giftDiamondValue[tier] * mult);

    set({
      events: events.filter(e => e.id !== eventId),
      collected: {
        ...collected,
        coins: collected.coins + coins,
        diamonds: collected.diamonds + diamonds,
      },
    });
  },

  // 04 §7: tap a hype-wave banner before it expires for a viewer surge.
  rideWave: (eventId) => {
    const { events, viewers } = get();
    const event = events.find(e => e.id === eventId);
    if (!event || event.type !== "hype_wave" || event.resolved) return;

    set({
      events: events.filter(e => e.id !== eventId),
      viewers: viewers * (1 + BALANCE.run.hypeWaveViewerBoost),
    });
  },

  // Phase 2.5 — choice events don't exist yet.
  resolveChoice: () => {},

  // 04 §9: reaction effects, gated by cooldown and the run's unlocked loadout.
  useReaction: (id) => {
    const { phase, params, cooldowns, hype, clockSec, viewers, events, wallet, gainsBoostUntil } = get();
    if (phase !== "live" || !params) return;
    if (!params.reactions.includes(id)) return;
    if (cooldowns[id] > 0) return;

    const newCooldowns = { ...cooldowns, [id]: REACTION_CATALOG[id].cooldownSec };

    switch (id) {
      case "hype_dance":
        set({ hype: clamp(hype + 18, 0, 100), cooldowns: newCooldowns });
        break;

      case "clapback": {
        const trolls = events.filter(e => e.type === "troll" && !e.resolved);
        const target = trolls[trolls.length - 1];
        set({
          events: target ? events.filter(e => e.id !== target.id) : events,
          hype: clamp(hype + 5, 0, 100),
          cooldowns: newCooldowns,
        });
        break;
      }

      case "pin_comment": {
        const comments = events.filter(e => e.type === "comment" && !e.resolved);
        const target = comments[Math.floor(Math.random() * comments.length)];
        if (!target) {
          set({ cooldowns: newCooldowns });
          break;
        }
        const gainsMult = clockSec < gainsBoostUntil ? 3 : 1;
        const followersGain = Math.round(viewers * 0.5) * gainsMult;
        set({
          events: events.filter(e => e.id !== target.id),
          wallet: {
            ...wallet,
            followers: wallet.followers + followersGain,
            totalFollowers: wallet.totalFollowers + followersGain,
          },
          cooldowns: newCooldowns,
        });
        break;
      }

      case "shoutout":
        set({ giftRateBoostUntil: clockSec + 8, cooldowns: newCooldowns });
        break;

      case "go_off":
        set({
          gainsBoostUntil: clockSec + 6,
          hype: clamp(hype + 30, 0, 100),
          cooldowns: newCooldowns,
        });
        break;
    }
  },

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
