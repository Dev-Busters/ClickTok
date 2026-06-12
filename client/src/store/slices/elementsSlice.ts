import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import type { ElementId, ElementWave, BeatGrade } from "../../features/elements/types";
import { ELEMENT_CATALOG } from "../../features/elements/catalog";
import { BALANCE } from "../../features/economy/balance";
import { ringScale, gradeForScale, GRADE_MULT } from "../../features/elements/beatSync";
import { armProgress, isFlowed } from "../../features/elements/duetLoop";
import { effectiveBeatSyncConfig, effectiveWaveIdleGapSec } from "../../features/feed/mods";

export type ElementsSlice = {
  ownedElements: Partial<Record<ElementId, boolean>>; // ⚠ PERSISTED — SAVE_VERSION bump +
                                                      // migration (default {}), per `02` §4
  activeWave: ElementWave | null;     // ephemeral
  nextWaveAt: number;                 // ephemeral scheduler clock (ms epoch)
  lastSpawnedElement: ElementId | null; // ephemeral — round-robin cursor (deviation, see 7.3 note)
  unlockElement: (id: ElementId) => boolean; // false if can't afford / follower gate unmet
  spawnWave: (id: ElementId) => void;
  tapRing: (ringId: number) => void;  // beat_sync: grade = f(now - startedAt) vs 04 §13.2 windows
  tapDuetPod: () => void;             // duet_loop: pays iff armedIndex is this pod (7.4)
  expireOrResolveWave: () => void;    // payout, clear, schedule nextWaveAt (+ idle gap)
};

export const createElementsSlice: StateCreator<FullState, [], [], ElementsSlice> = (set, get) => ({
  ownedElements: {},
  activeWave: null,
  nextWaveAt: 0,
  lastSpawnedElement: null,

  unlockElement: (id) => {
    const def = ELEMENT_CATALOG.find(d => d.id === id);
    if (!def) return false;
    const { ownedElements, wallet } = get();
    if (ownedElements[id]) return false;
    if (wallet.followers < def.requires.followers) return false;
    if (wallet.coins < def.requires.coins) return false;

    set({
      wallet: { ...wallet, coins: wallet.coins - def.requires.coins },
      ownedElements: { ...ownedElements, [id]: true },
      nextWaveAt: Date.now() + BALANCE.elements.waveIdleGapSec * 1000,
    });
    return true;
  },

  spawnWave: (id) => {
    if (id === "beat_sync") {
      const { deck, deckIndex } = get();
      const activeMod = deck[deckIndex]?.mod ?? null;
      // 04 §13.5: `extra_ring` adds a ring to every Beat Sync wave spawned while on screen.
      const cfg = effectiveBeatSyncConfig(activeMod);
      const rings = Array.from({ length: cfg.rings }, (_, i) => ({ id: i }));
      set({ activeWave: { element: "beat_sync", startedAt: Date.now(), rings }, lastSpawnedElement: id });
    }
    if (id === "duet_loop") {
      set({
        activeWave: {
          element: "duet_loop", startedAt: Date.now(),
          armedIndex: null, armedAt: null, firstArmedAt: null, completed: 0,
        },
        lastSpawnedElement: id,
      });
    }
  },

  tapRing: (ringId) => {
    const { activeWave, tapPower, multiplier, followerConversion, combo, wallet, deck, deckIndex } = get();
    if (!activeWave || activeWave.element !== "beat_sync") return;
    const ring = activeWave.rings.find(r => r.id === ringId);
    if (!ring || ring.grade) return;

    const activeMod = deck[deckIndex]?.mod ?? null;
    const grade = gradeForScale(ringScale(activeWave.startedAt, ringId, activeMod), activeMod);
    const gradeMult = GRADE_MULT[grade];

    if (gradeMult > 0) {
      // 04 §13.2: per-ring payout = gradeMult × gainPerPost × comboMult
      const comboMult = 1 + Math.min(combo, BALANCE.feed.comboCap) * BALANCE.feed.comboPerTap;
      const k = gradeMult * comboMult;
      const coinsGain = tapPower * BALANCE.postCoinConversion * multiplier * k;
      const followersGain = tapPower * BALANCE.postFollowerConversion * followerConversion * multiplier * k;
      const likesGain = tapPower * BALANCE.postLikeConversion * multiplier * k;
      set({
        wallet: {
          ...wallet,
          coins: wallet.coins + coinsGain,
          followers: wallet.followers + followersGain,
          totalFollowers: wallet.totalFollowers + followersGain,
          likes: wallet.likes + likesGain,
        },
      });
    }

    const rings = activeWave.rings.map(r => r.id === ringId ? { ...r, grade } : r);
    set({ activeWave: { ...activeWave, rings } });
  },

  tapDuetPod: () => {
    const { activeWave, tapPower, multiplier, followerConversion, combo, wallet, deck, deckIndex } = get();
    if (!activeWave || activeWave.element !== "duet_loop") return;
    if (activeWave.armedIndex === null) return;

    const cfg = BALANCE.elements.duetLoop;
    const activeMod = deck[deckIndex]?.mod ?? null;
    const comboMult = 1 + Math.min(combo, BALANCE.feed.comboCap) * BALANCE.feed.comboPerTap;
    const completed = activeWave.completed + 1;

    // 04 §13.2: pod tap pays podPayout; the final pod ALSO pays flowBonus if the
    // chain completed within flowSec of the wave's first core tap.
    let k = cfg.podPayout * comboMult;
    if (isFlowed(activeWave.firstArmedAt, completed, activeMod)) {
      k += cfg.flowBonus * comboMult;
    }

    const coinsGain = tapPower * BALANCE.postCoinConversion * multiplier * k;
    const followersGain = tapPower * BALANCE.postFollowerConversion * followerConversion * multiplier * k;
    const likesGain = tapPower * BALANCE.postLikeConversion * multiplier * k;

    set({
      wallet: {
        ...wallet,
        coins: wallet.coins + coinsGain,
        followers: wallet.followers + followersGain,
        totalFollowers: wallet.totalFollowers + followersGain,
        likes: wallet.likes + likesGain,
      },
      activeWave: { ...activeWave, armedIndex: null, armedAt: null, completed },
    });
  },

  expireOrResolveWave: () => {
    const { activeWave, openSheet, phase, spectating, ownedElements, nextWaveAt, deck, deckIndex } = get();
    // 01 §8.2 / 04 §13.2: scheduler pauses while a sheet is open or a run/spectate is active.
    if (openSheet !== null || phase !== "idle" || spectating !== null) return;

    const activeMod = deck[deckIndex]?.mod ?? null;
    // 04 §13.5: `wave_rush` halves the idle gap between waves while its card is on screen.
    const idleGapMs = effectiveWaveIdleGapSec(activeMod) * 1000;

    if (activeWave?.element === "beat_sync") {
      const cfg = effectiveBeatSyncConfig(activeMod);
      let changed = false;
      const rings = activeWave.rings.map(r => {
        if (r.grade) return r;
        const scale = ringScale(activeWave.startedAt, r.id, activeMod);
        // Ring expired (shrunk past the OK window) untapped ⇒ MISS.
        if (1 - scale > cfg.windowOk) {
          changed = true;
          return { ...r, grade: "miss" as BeatGrade };
        }
        return r;
      });
      if (changed) set({ activeWave: { ...activeWave, rings } });

      if (rings.every(r => r.grade)) {
        if (rings.every(r => r.grade === "perfect")) {
          const { tapPower, multiplier, followerConversion, combo, wallet } = get();
          const comboMult = 1 + Math.min(combo, BALANCE.feed.comboCap) * BALANCE.feed.comboPerTap;
          const k = cfg.perfectWaveBonus * comboMult;
          set({
            wallet: {
              ...wallet,
              coins: wallet.coins + tapPower * BALANCE.postCoinConversion * multiplier * k,
              followers: wallet.followers + tapPower * BALANCE.postFollowerConversion * followerConversion * multiplier * k,
              totalFollowers: wallet.totalFollowers + tapPower * BALANCE.postFollowerConversion * followerConversion * multiplier * k,
              likes: wallet.likes + tapPower * BALANCE.postLikeConversion * multiplier * k,
            },
          });
        }
        set({ activeWave: null, nextWaveAt: Date.now() + idleGapMs });
      }
      return;
    }

    if (activeWave?.element === "duet_loop") {
      const cfg = BALANCE.elements.duetLoop;
      if (activeWave.completed >= cfg.pods) {
        set({ activeWave: null, nextWaveAt: Date.now() + idleGapMs });
        return;
      }
      // 04 §13.2: armed pod untapped for armTimeoutSec gutters back to dormant
      // — no penalty, the chain just stalls (completed/firstArmedAt untouched).
      if (activeWave.armedIndex !== null && activeWave.armedAt !== null && armProgress(activeWave.armedAt, activeMod) >= 1) {
        set({ activeWave: { ...activeWave, armedIndex: null, armedAt: null } });
      }
      return;
    }

    if (!activeWave) {
      if (Date.now() < nextWaveAt) return;
      const owned = ELEMENT_CATALOG.filter(d => ownedElements[d.id]).map(d => d.id);
      if (owned.length === 0) return;
      const { lastSpawnedElement } = get();
      const lastIdx = lastSpawnedElement ? owned.indexOf(lastSpawnedElement) : -1;
      const next = owned[(lastIdx + 1) % owned.length];
      get().spawnWave(next);
    }
  },
});
