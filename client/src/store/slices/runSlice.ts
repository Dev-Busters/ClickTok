import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import { BALANCE } from "../../features/economy/balance";
import { track } from "../../lib/telemetry";
import type { ChoiceEffectId } from "../../features/livestream/choices";
import { computeRunParams } from "../../features/livestream/computeRunParams";
import {
  MAX_FEED_EVENTS,
  spawnCrashEvent,
  spawnFeedEvent,
  spawnGiftEvent,
  spawnViralWaveEvent,
  type FeedEventType,
} from "../../features/livestream/events";
import { applyModifiers, hasModifier, MODIFIER_EFFECTS, rollModifiers } from "../../features/livestream/modifiers";
import { REACTION_CATALOG } from "../../features/livestream/reactions";
import {
  BOON_ALGORITHM_FAVOR_MULT,
  BOON_DIAMOND_CACHE_AMOUNT,
  BOON_HYPE_CARRYOVER_BONUS,
  BOON_LIST,
  type BoonDef,
  type BoonId,
} from "../../features/livestream/boons";
import { getTrendHeat } from "../../features/social/trends";
import { clamp } from "../../lib/math";
import { formatCount } from "../../lib/format";
import type {
  ReactionId,
  RunEvent,
  RunModifierId,
  RunPhase,
  RunResult,
  RunStartParams,
} from "../../features/livestream/types";

export type RunSlice = {
  phase: RunPhase;
  params: RunStartParams | null;
  streamId: string | null;   // 4.2: stable UUID for this run; used as stream room id
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
  giftsCollected: number;      // count of gifts tapped this run (for results)
  lastResult: RunResult | null; // most recent endRun() output, for the results screen
  crashAtSec: number | null;     // 2.7: scheduled `shadowban_risk` crash time, or null
  viralWaveAtSec: number | null; // 2.7: scheduled `viral_moment` wave time, or null
  pendingHypeBoost: number;      // 2.7: `hype_carryover` boon, applied to next run's start hype
  boonChoices: BoonDef[] | null; // 2.7: 1-of-3 post-run boon pick, shown on a successful run
  // 4.3: real-crowd state (ephemeral, streamer-side)
  realViewers: number;
  realTapsLast5s: number;        // sliding window fed by useStreamerRoom for hype-decay relief
  realGiftLog: { handle: string; coins: number; atRunSec: number }[];
  lastChoiceResolution: { pollId: string; winningIndex: number } | null;
  pendingVoteTally: Record<string, number[]>; // pollId → per-option vote counts

  startRun: (topic: string) => void;     // compute params from meta, go live
  runTick: (dt: number) => void;         // the run loop step (engine)
  collectGift: (eventId: string) => void;
  rideWave: (eventId: string) => void;
  resolveChoice: (eventId: string, choiceIndex: number) => void;
  useReaction: (id: ReactionId) => void;
  endRun: (reason: "voluntary" | "timer" | "flop") => RunResult;
  applyBoon: (id: BoonId) => void;       // 2.7: apply the chosen post-run boon
  returnToChannel: () => void;           // dismiss results, back to phase "idle"
  injectRealEvent: (event: RunEvent) => void; // 4.3: inject a real viewer event into the feed
  applyRealViewerCount: (count: number) => void; // 4.3: update realViewers from viewerCount msg
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
  streamId: null,
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
  giftsCollected: 0,
  lastResult: null,
  crashAtSec: null,
  viralWaveAtSec: null,
  pendingHypeBoost: 0,
  boonChoices: null,
  realViewers: 0,
  realTapsLast5s: 0,
  realGiftLog: [],
  lastChoiceResolution: null,
  pendingVoteTally: {},

  // 04 §6: compute run params from current meta state, roll/apply modifiers
  // (04 §8), then go live.
  startRun: (topic) => {
    const { wallet, followerConversion, skillLevels, ownedUpgrades, trendsAvailable, pendingHypeBoost, algorithm } = get();
    const trendHeat = getTrendHeat(trendsAvailable, topic);
    const baseParams = computeRunParams(
      { followers: wallet.followers, followerConversion, skillLevels, ownedUpgrades },
      topic,
      trendHeat,
    );
    // 04 §12.5: BLESSED guarantees a 2nd modifier from this pool.
    const guaranteedSecondPool: RunModifierId[] | undefined = algorithm.tier === "BLESSED"
      ? ["algorithm_boost", "trending_sound", "viral_moment"]
      : undefined;
    const modifiers = rollModifiers(Math.random, guaranteedSecondPool);
    const params = applyModifiers(baseParams, modifiers);

    let crashAtSec: number | null = null;
    if (hasModifier(modifiers, "shadowban_risk") && Math.random() < MODIFIER_EFFECTS.shadowbanChance) {
      crashAtSec = 20 + Math.random() * Math.max(1, params.durationSec - 40);
    }

    let viralWaveAtSec: number | null = null;
    if (hasModifier(modifiers, "viral_moment")) {
      viralWaveAtSec = 15 + Math.random() * Math.max(1, params.durationSec - 30);
    }

    set({
      phase: "live",
      params,
      streamId: crypto.randomUUID(),
      clockSec: 0,
      viewers: params.startViewers,
      peakViewers: params.startViewers,
      hype: clamp(INITIAL_HYPE + pendingHypeBoost, 0, 100),
      events: [],
      cooldowns: { ...INITIAL_COOLDOWNS },
      collected: { coins: 0, diamonds: 0, likes: 0 },
      flopTimer: 0,
      giftRateBoostUntil: 0,
      gainsBoostUntil: 0,
      giftsCollected: 0,
      lastResult: null,
      boonChoices: null,
      pendingHypeBoost: 0,
      crashAtSec,
      viralWaveAtSec,
      realViewers: 0,
      realTapsLast5s: 0,
      realGiftLog: [],
      lastChoiceResolution: null,
      pendingVoteTally: {},
    });
    track('run_started', {
      topic,
      startViewers: params.startViewers,
      modifiers: modifiers.map(m => m.id),
      handle: get().handle,
    });
  },

  // 04 §7: hype decay, troll drain, viewer easing, event spawn/expiry, flop/timer end.
  // 2.7: modifiers skew event weights (tough_crowd/trending_sound) and trigger the
  // scheduled shadowban crash / viral wave.
  runTick: (dt) => {
    const {
      phase, params, clockSec, hype, viewers, peakViewers, cooldowns, flopTimer,
      events, giftRateBoostUntil, crashAtSec, viralWaveAtSec,
      realViewers, realTapsLast5s,
    } = get();
    if (phase !== "live" || !params) return;

    const newClockSec = clockSec + dt;

    // Expire events whose lifetime is over before computing troll drain/spawns.
    let liveEvents = events.filter(e => e.expiresAt > newClockSec);
    const activeTrolls = liveEvents.filter(e => e.type === "troll").length;

    // 04 §12.3: real taps reduce effective hype decay (cap 50%).
    const { social: S } = BALANCE;
    const hypeDecayEff = params.hypeDecayPerSec *
      (1 - Math.min(0.5, S.tapDecayReliefPerTap * realTapsLast5s));

    let newHype = clamp(
      hype - hypeDecayEff * dt - activeTrolls * BALANCE.run.trollHypeDrainPerSec * dt,
      0, 100,
    );

    const targetViewers = params.startViewers * (0.6 + 0.8 * (newHype / 100));
    let newViewers = viewers + (targetViewers - viewers) * 0.5 * dt;
    newViewers -= activeTrolls * BALANCE.run.trollViewerDrainPerSec * newViewers * dt;
    newViewers = Math.max(0, newViewers);

    const newCooldowns = { ...cooldowns };
    for (const id of Object.keys(newCooldowns) as ReactionId[]) {
      newCooldowns[id] = Math.max(0, newCooldowns[id] - dt);
    }

    // Gifts spawn on their own Poisson process at `giftRate`/sec (`shoutout` doubles it).
    const giftRateMult = newClockSec < giftRateBoostUntil ? 2 : 1;
    if (Math.random() < params.giftRate * giftRateMult * dt) {
      liveEvents = [...liveEvents, spawnGiftEvent(newClockSec, params.giftQuality)];
    }

    // 04 §8: tough_crowd → more trolls; trending_sound → more hype waves.
    const weightMultipliers: Partial<Record<FeedEventType, number>> = {};
    if (hasModifier(params.modifiers, "tough_crowd")) {
      weightMultipliers.troll = MODIFIER_EFFECTS.toughCrowdTrollFreqMult;
    }
    if (hasModifier(params.modifiers, "trending_sound")) {
      weightMultipliers.hype_wave = MODIFIER_EFFECTS.trendingSoundWaveFreqMult;
    }

    // Comments/trolls/hype-waves spawn on the general `eventIntervalSec` schedule.
    if (Math.random() < dt / params.eventIntervalSec) {
      const hasActiveWave = liveEvents.some(e => e.type === "hype_wave");
      liveEvents = [...liveEvents, spawnFeedEvent(newClockSec, hasActiveWave, weightMultipliers)];
    }

    // 2.7 shadowban_risk: fire the scheduled mid-stream crash once.
    let newCrashAtSec = crashAtSec;
    if (newCrashAtSec !== null && newClockSec >= newCrashAtSec) {
      newViewers *= MODIFIER_EFFECTS.shadowbanViewerMult;
      newHype = clamp(newHype - MODIFIER_EFFECTS.shadowbanHypeLoss, 0, 100);
      liveEvents = [...liveEvents, spawnCrashEvent(newClockSec)];
      newCrashAtSec = null;
    }

    // 2.7 viral_moment: fire the guaranteed wave once, avoiding stacking with
    // a wave that's already active in the feed.
    let newViralWaveAtSec = viralWaveAtSec;
    if (newViralWaveAtSec !== null && newClockSec >= newViralWaveAtSec) {
      const hasActiveWave = liveEvents.some(e => e.type === "hype_wave");
      if (!hasActiveWave) {
        liveEvents = [...liveEvents, spawnViralWaveEvent(newClockSec)];
        newViralWaveAtSec = null;
      }
    }

    if (liveEvents.length > MAX_FEED_EVENTS) {
      liveEvents = liveEvents.slice(liveEvents.length - MAX_FEED_EVENTS);
    }

    // 04 §12.3: real viewers inflate the display total and scoring peak.
    const displayViewers = newViewers + S.realViewerWeight * realViewers;
    const newPeakViewers = Math.max(peakViewers, displayViewers);

    // 04 §12.3: real viewers reduce the effective flop floor (cap 50%).
    const flopFloorEff = params.flopFloor *
      (1 - Math.min(0.5, S.flopReliefPerRealViewer * realViewers));
    const newFlopTimer = newViewers < flopFloorEff ? flopTimer + dt : 0;

    set({
      clockSec: newClockSec,
      hype: newHype,
      viewers: newViewers,
      peakViewers: newPeakViewers,
      cooldowns: newCooldowns,
      flopTimer: newFlopTimer,
      events: liveEvents,
      crashAtSec: newCrashAtSec,
      viralWaveAtSec: newViralWaveAtSec,
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
  // (and `go_off`'s ×3 gains window). 2.7: `tough_crowd` pays out more.
  collectGift: (eventId) => {
    const { events, hype, collected, clockSec, gainsBoostUntil, skillLevels, giftsCollected, params } = get();
    const event = events.find(e => e.id === eventId);
    if (!event || event.type !== "gift" || event.resolved || !event.giftTier) return;

    const tier = event.giftTier;
    const valueBonus = 1 + BALANCE.run.monetizationGiftPerLevel * skillLevels.monetization;
    const hypeBonus = 1 + hype / 100;
    const gainsMult = clockSec < gainsBoostUntil ? 3 : 1;
    const toughCrowdMult = hasModifier(params?.modifiers ?? [], "tough_crowd")
      ? MODIFIER_EFFECTS.toughCrowdGiftValueMult
      : 1;
    const mult = valueBonus * hypeBonus * gainsMult * toughCrowdMult;

    const coins = Math.round(BALANCE.run.giftCoinValue[tier] * mult);
    const diamonds = Math.round(BALANCE.run.giftDiamondValue[tier] * mult);

    set({
      events: events.filter(e => e.id !== eventId),
      collected: {
        ...collected,
        coins: collected.coins + coins,
        diamonds: collected.diamonds + diamonds,
      },
      giftsCollected: giftsCollected + 1,
    });
  },

  // 04 §7: tap a hype-wave banner before it expires for a viewer surge.
  // 2.7: `trending_sound` makes waves hit harder; the `viral_moment` wave
  // (flagged via `event.amount === 1`) is bigger still and grants hype.
  rideWave: (eventId) => {
    const { events, viewers, hype, params } = get();
    const event = events.find(e => e.id === eventId);
    if (!event || event.type !== "hype_wave" || event.resolved) return;

    let boost = BALANCE.run.hypeWaveViewerBoost;
    let hypeGain = 0;

    if (hasModifier(params?.modifiers ?? [], "trending_sound")) {
      boost *= MODIFIER_EFFECTS.trendingSoundWaveStrengthMult;
    }
    if (event.amount === 1) {
      boost *= MODIFIER_EFFECTS.viralWaveBoostMult;
      hypeGain = MODIFIER_EFFECTS.viralWaveHypeGain;
    }

    set({
      events: events.filter(e => e.id !== eventId),
      viewers: viewers * (1 + boost),
      hype: clamp(hype + hypeGain, 0, 100),
    });
  },

  // 04 §8/§9-adjacent: resolve a comment/sponsor choice prompt. Effect
  // magnitudes are anchored to existing run formulas — see `choices.ts`.
  // 2.7: `tough_crowd` also boosts the sponsor payout.
  resolveChoice: (eventId, choiceIndex) => {
    const { phase, events, hype, viewers, wallet, collected, clockSec, gainsBoostUntil, skillLevels, params, pendingVoteTally } = get();
    if (phase !== "live") return;

    const event = events.find(e => e.id === eventId);
    if (!event || !event.choices || event.resolved) return;
    const choice = event.choices[choiceIndex];
    if (!choice) return;

    const remaining = events.filter(e => e.id !== eventId);
    const gainsMult = clockSec < gainsBoostUntil ? 3 : 1;

    // 04 §12.2: if majority of voters picked this option, boost its effects.
    const tally = pendingVoteTally[eventId];
    const voteBoost = (() => {
      if (!tally || tally.length === 0) return 1;
      const max = Math.max(...tally);
      if (max === 0) return 1;
      return tally[choiceIndex] === max ? BALANCE.social.voteBoostMult : 1;
    })();
    const newPendingVoteTally = { ...pendingVoteTally };
    delete newPendingVoteTally[eventId];

    const resolution = { lastChoiceResolution: { pollId: eventId, winningIndex: choiceIndex }, pendingVoteTally: newPendingVoteTally };

    switch (choice.apply as ChoiceEffectId) {
      case "sponsor_accept": {
        const valueBonus = 1 + BALANCE.run.monetizationGiftPerLevel * skillLevels.monetization;
        const hypeBonus = 1 + hype / 100;
        const toughCrowdMult = hasModifier(params?.modifiers ?? [], "tough_crowd")
          ? MODIFIER_EFFECTS.toughCrowdGiftValueMult
          : 1;
        const coins = Math.round(BALANCE.run.giftCoinValue.galaxy * valueBonus * hypeBonus * gainsMult * toughCrowdMult * voteBoost);
        set({ events: remaining, viewers: viewers * 0.92, collected: { ...collected, coins: collected.coins + coins }, ...resolution });
        break;
      }

      case "sponsor_decline":
        set({ events: remaining, hype: clamp(hype + 5 * voteBoost, 0, 100), ...resolution });
        break;

      case "drama_clapback":
        set({ events: remaining, hype: clamp(hype + 10 * voteBoost, 0, 100), viewers: viewers * 0.95, ...resolution });
        break;

      case "drama_classy": {
        const followersGain = Math.round(viewers * 0.1 * gainsMult * voteBoost);
        set({
          events: remaining,
          hype: clamp(hype + 3 * voteBoost, 0, 100),
          wallet: { ...wallet, followers: wallet.followers + followersGain, totalFollowers: wallet.totalFollowers + followersGain },
          ...resolution,
        });
        break;
      }

      case "shoutout_fan": {
        const followersGain = Math.round(viewers * 0.05 * gainsMult * voteBoost);
        set({
          events: remaining,
          hype: clamp(hype + 2 * voteBoost, 0, 100),
          wallet: { ...wallet, followers: wallet.followers + followersGain, totalFollowers: wallet.totalFollowers + followersGain },
          ...resolution,
        });
        break;
      }

      case "shoutout_skip":
      default:
        set({ events: remaining, ...resolution });
        break;
    }
  },

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

  // 04 §10: scoreRun — convert run performance + collected gifts into meta
  // currencies, grant them to the wallet, and surface a result for the
  // results screen. 2.7: on a non-FLOP grade, offer the 1-of-3 boon pick.
  endRun: (reason) => {
    const { params, peakViewers, hype, collected, giftsCollected, wallet } = get();
    if (!params) throw new Error("endRun called with no active run params");

    const { scoring } = BALANCE;
    const hypeBonus = 1 + hype * scoring.hypeBonusCoeff;
    const base = peakViewers * hypeBonus * params.trendMultiplier;
    const fullFollowers = Math.round(base * params.followerConversion * scoring.followerYieldCoeff);

    let followers: number;
    let coins: number;
    let diamonds: number;
    let likes: number;

    if (reason === "flop") {
      // Flop payout: just the collected gifts + 30% of computed followers —
      // not zero, but no completion/peak-viewer bonuses (04 §10).
      followers = Math.round(fullFollowers * 0.3);
      coins = collected.coins;
      diamonds = collected.diamonds;
      likes = collected.likes;
    } else {
      followers = fullFollowers;
      coins = collected.coins + Math.round(base * 0.5);
      diamonds = collected.diamonds + scoring.completionDiamondBase;
      likes = collected.likes + Math.round(peakViewers * 2);
    }

    const ratio = peakViewers / params.startViewers;
    let grade: RunResult["grade"];
    if (reason === "flop") grade = "FLOP";
    else if (ratio >= 3 && hype >= 80) grade = "S";
    else if (ratio >= 2) grade = "A";
    else if (ratio >= 1.3) grade = "B";
    else if (ratio >= 0.9) grade = "C";
    else grade = "D";

    const result: RunResult = {
      reason,
      peakViewers,
      finalHype: hype,
      giftsCollected,
      rewards: { followers, coins, diamonds, likes },
      grade,
    };

    const { streams } = get();
    set({
      phase: "results",
      lastResult: result,
      boonChoices: grade !== "FLOP" ? BOON_LIST : null,
      streams: streams + 1,
      wallet: {
        ...wallet,
        followers: wallet.followers + followers,
        totalFollowers: wallet.totalFollowers + followers,
        coins: wallet.coins + coins,
        diamonds: wallet.diamonds + diamonds,
        likes: wallet.likes + likes,
      },
    });

    // 3.2: every completed run lands a result notification in the Inbox.
    get().pushNotification({
      type: "run_result",
      title: `Stream ended — Grade ${grade}`,
      body: `Peak ${formatCount(peakViewers)} viewers · +${formatCount(followers)} 👥, +${formatCount(coins)} 🪙, +${formatCount(diamonds)} 💎, +${formatCount(likes)} ❤️`,
    });

    track('run_ended', {
      grade,
      reason,
      peakViewers,
      followers,
      coins,
      diamonds,
      handle: get().handle,
    });

    return result;
  },

  // 01 §5.5: post-run "1 of 3" boon pick. Magnitudes/ids are implementation
  // choices (`features/livestream/boons.ts`) — `04` doesn't spec this.
  applyBoon: (id) => {
    const { wallet, boonMultiplier } = get();
    switch (id) {
      case "diamond_cache":
        set({ wallet: { ...wallet, diamonds: wallet.diamonds + BOON_DIAMOND_CACHE_AMOUNT }, boonChoices: null });
        break;

      case "hype_carryover":
        set({ pendingHypeBoost: BOON_HYPE_CARRYOVER_BONUS, boonChoices: null });
        break;

      case "algorithm_favor":
        set({ boonMultiplier: boonMultiplier * BOON_ALGORITHM_FAVOR_MULT, boonChoices: null });
        get().recomputeStats();
        break;
    }
  },

  returnToChannel: () => set({
    phase: "idle", params: null, streamId: null, lastResult: null, boonChoices: null,
    realViewers: 0, realTapsLast5s: 0, realGiftLog: [], lastChoiceResolution: null, pendingVoteTally: {},
  }),

  // 4.3: inject a real viewer event (glow-rendered) into the live feed.
  injectRealEvent: (event) => set(state => ({
    events: state.events.concat(event).slice(-MAX_FEED_EVENTS),
  })),

  // 4.3: update real viewer count from the stream room's viewerCount message.
  applyRealViewerCount: (count) => set({ realViewers: count }),
});
