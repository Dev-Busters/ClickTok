import type { FeedModId } from "../../party/types";
import { BALANCE } from "../economy/balance";

// 04 §13.5 — videos modify clicker MECHANICS while their card is on screen.
export type ModDef = {
  id: FeedModId;
  icon: string;
  name: string;
  effectLine: string;
  appliesTo: "beat_sync" | "duet_loop" | "core" | "scheduler";
};

export const MOD_CATALOG: Record<FeedModId, ModDef> = {
  ring_slow: {
    id: "ring_slow",
    icon: "🐢",
    name: "RING SLOW",
    effectLine: "Beat Sync rings shrink 25% slower",
    appliesTo: "beat_sync",
  },
  extra_ring: {
    id: "extra_ring",
    icon: "➕",
    name: "EXTRA RING",
    effectLine: "+1 ring per Beat Sync wave",
    appliesTo: "beat_sync",
  },
  wide_window: {
    id: "wide_window",
    icon: "🎯",
    name: "WIDE WINDOW",
    effectLine: "Beat Sync grading windows ×1.5",
    appliesTo: "beat_sync",
  },
  duet_flow: {
    id: "duet_flow",
    icon: "🔁",
    name: "DUET FLOW",
    effectLine: "Duet Loop: +2s flow window, +1s arm timeout",
    appliesTo: "duet_loop",
  },
  core_surge: {
    id: "core_surge",
    icon: "⚡",
    name: "CORE SURGE",
    effectLine: "TAP CORE coins ×1.5",
    appliesTo: "core",
  },
  wave_rush: {
    id: "wave_rush",
    icon: "🌊",
    name: "WAVE RUSH",
    effectLine: "Waves spawn twice as often",
    appliesTo: "scheduler",
  },
};

export const MOD_IDS: FeedModId[] = Object.keys(MOD_CATALOG) as FeedModId[];

// ── Effective-config helpers (04 §13.5) — `mod` is the card on screen, or null
// (offscreen / no deck yet). "Locked elements ignore their mods" falls out
// naturally: a mod for an element the player doesn't own never gets read.

export function effectiveBeatSyncConfig(mod: FeedModId | null) {
  const cfg = BALANCE.elements.beatSync;
  const windowMult = mod === "wide_window" ? 1.5 : 1;
  return {
    ...cfg,
    rings: cfg.rings + (mod === "extra_ring" ? 1 : 0),
    shrinkSec: cfg.shrinkSec * (mod === "ring_slow" ? 1.25 : 1),
    windowPerfect: cfg.windowPerfect * windowMult,
    windowGood: cfg.windowGood * windowMult,
    windowOk: cfg.windowOk * windowMult,
  };
}

export function effectiveDuetLoopConfig(mod: FeedModId | null) {
  const cfg = BALANCE.elements.duetLoop;
  return {
    ...cfg,
    flowSec: cfg.flowSec + (mod === "duet_flow" ? 2 : 0),
    armTimeoutSec: cfg.armTimeoutSec + (mod === "duet_flow" ? 1 : 0),
  };
}

export function effectiveWaveIdleGapSec(mod: FeedModId | null): number {
  return BALANCE.elements.waveIdleGapSec * (mod === "wave_rush" ? 0.5 : 1);
}

export function coreCoinMult(mod: FeedModId | null): number {
  return mod === "core_surge" ? 1.5 : 1;
}
