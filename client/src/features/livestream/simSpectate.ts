// (6.1) Client-local snapshot simulator for featured streams.
// Drives a full RunStartParams simulation entirely in the browser —
// no socket, no server. Reuses computeRunParams + the event spawner.

import { computeRunParams, type RunParamsMeta } from "./computeRunParams";
import { spawnGiftEvent, spawnFeedEvent } from "./events";
import { clamp } from "../../lib/math";
import type { RunSnapshot, LiveStreamSummary, SpectatorEvent } from "../../party/types";
import type { RunResult } from "./types";
import type { SkillId } from "../skills/types";

const SIM_TICK_MS = 333; // ~3 ticks/sec, matching snapshotPerSec

const ZERO_SKILLS: Record<SkillId, number> = {
  charisma: 0, editing: 0, stagecraft: 0, monetization: 0, network: 0,
};

// 04 §6 + task 6.1: followers = 10^(creatorLevel-1), skills = 0, no gear.
export function metaFor(creatorLevel: number): RunParamsMeta {
  return {
    followers: Math.pow(10, Math.max(0, creatorLevel - 1)),
    followerConversion: 1,
    skillLevels: { ...ZERO_SKILLS },
    ownedUpgrades: {},
  };
}

// Grade per 04 §10 (no flop — featured streams always run full duration).
function computeGrade(peakViewers: number, startViewers: number, finalHype: number): RunResult["grade"] {
  const ratio = peakViewers / Math.max(1, startViewers);
  if (ratio >= 3 && finalHype >= 80) return "S";
  if (ratio >= 2) return "A";
  if (ratio >= 1.3) return "B";
  if (ratio >= 0.9) return "C";
  return "D";
}

// Starts a client-local sim for the given featured stream.
// Returns a cleanup fn that stops the interval.
export function startFeaturedSim(
  summary: LiveStreamSummary,
  trendHeat: number,
  onSnapshot: (snap: RunSnapshot, realViewers: number) => void,
  onEnded: (grade: RunResult["grade"]) => void,
): () => void {
  const params = computeRunParams(metaFor(summary.creatorLevel), summary.topic, trendHeat);

  let clockSec = 0;
  let hype = 50;               // neutral start (same as startRun in 2.1)
  let viewers = params.startViewers;
  let peakViewers = params.startViewers;

  // Accumulate events between snapshots; sent once per tick and cleared.
  let pendingEvents: SpectatorEvent[] = [];

  // Poisson process accumulators (fractional seconds until next spawn).
  let nextGiftIn = 1 / Math.max(0.001, params.giftRate);
  let nextEventIn = params.eventIntervalSec;

  let ended = false;

  const intervalId = setInterval(() => {
    if (ended) return;

    const dt = SIM_TICK_MS / 1000;
    clockSec += dt;

    // Hype decay (04 §7)
    hype = clamp(hype - params.hypeDecayPerSec * dt, 0, 100);

    // Viewer drift toward hype-driven target (04 §7)
    const targetViewers = params.startViewers * (0.6 + 0.8 * (hype / 100));
    viewers += (targetViewers - viewers) * 0.5 * dt;
    viewers = Math.max(0, viewers);
    peakViewers = Math.max(peakViewers, viewers);

    // Gift spawn
    nextGiftIn -= dt;
    if (nextGiftIn <= 0) {
      const ev = spawnGiftEvent(clockSec, params.giftQuality);
      pendingEvents.push({ id: ev.id, type: ev.type, giftTier: ev.giftTier });
      // Next gift: exponential inter-arrival at giftRate
      nextGiftIn = -Math.log(Math.random()) / Math.max(0.001, params.giftRate);
    }

    // Feed event spawn (comment/troll/hype_wave/choice)
    nextEventIn -= dt;
    if (nextEventIn <= 0) {
      const ev = spawnFeedEvent(clockSec, false);
      const specEv: SpectatorEvent = { id: ev.id, type: ev.type };
      if (ev.text) specEv.text = ev.text;
      pendingEvents.push(specEv);
      nextEventIn = params.eventIntervalSec * (0.5 + Math.random()); // jitter
    }

    const snap: RunSnapshot = {
      streamId: summary.streamId,
      handle: summary.handle,
      topic: summary.topic,
      clockSec,
      durationSec: params.durationSec,
      viewers: Math.round(viewers),
      hype: Math.round(hype),
      modifiers: [],
      newEvents: pendingEvents,
    };
    pendingEvents = [];
    onSnapshot(snap, 0);

    // End condition: full duration elapsed
    if (clockSec >= params.durationSec) {
      ended = true;
      clearInterval(intervalId);
      const grade = computeGrade(peakViewers, params.startViewers, hype);
      onEnded(grade);
    }
  }, SIM_TICK_MS);

  return () => {
    ended = true;
    clearInterval(intervalId);
  };
}
