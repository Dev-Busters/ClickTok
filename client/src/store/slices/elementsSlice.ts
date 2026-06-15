import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import type { ElementId, ElementWave, BeatGrade } from "../../features/elements/types";
import { ELEMENT_CATALOG } from "../../features/elements/catalog";
import { BALANCE } from "../../features/economy/balance";
import { ringScale, gradeForScale, GRADE_MULT } from "../../features/elements/beatSync";
import { armProgress, isFlowed } from "../../features/elements/duetLoop";
import { chargeProgress, holdGrade } from "../../features/elements/holdDrop";
import { traceProgress } from "../../features/elements/swipeHits";
import { pickPositions } from "../../features/elements/playField";
import { effectiveBeatSyncConfig, effectiveWaveIdleGapSec, viralMult } from "../../features/feed/mods";

export type ElementsSlice = {
  ownedElements: Partial<Record<ElementId, boolean>>; // ⚠ PERSISTED — SAVE_VERSION bump +
                                                      // migration (default {}), per `02` §4
  // 11.3: per-element first-time teach caption seen flag — PERSISTED (v9)
  elementsTeachSeen: Partial<Record<ElementId, boolean>>;
  setElementTeachSeen: (id: ElementId) => void;

  activeWave: ElementWave | null;     // ephemeral
  nextWaveAt: number;                 // ephemeral scheduler clock (ms epoch)
  lastSpawnedElement: ElementId | null; // ephemeral — round-robin cursor (deviation, see 7.3 note)
  unlockElement: (id: ElementId) => boolean; // false if can't afford / follower gate unmet
  spawnWave: (id: ElementId) => void;
  tapRing: (ringId: number) => void;  // beat_sync: grade = f(now - startedAt) vs 04 §13.2 windows
  tapDuetPod: () => void;             // duet_loop: pays iff armedIndex is this pod (7.4)
  pointerDownHold: () => void;        // hold_drop: record press start time
  pointerUpHold: () => void;          // hold_drop: grade + pay based on charge progress
  resolveTrace: (traceId: number, hitTarget: boolean) => void; // swipe_hits: grade one trace
  expireOrResolveWave: () => void;    // payout, clear, schedule nextWaveAt (+ idle gap)
};

export const createElementsSlice: StateCreator<FullState, [], [], ElementsSlice> = (set, get) => ({
  ownedElements: {},
  elementsTeachSeen: {},
  activeWave: null,
  nextWaveAt: 0,
  lastSpawnedElement: null,

  setElementTeachSeen: (id) => {
    const { elementsTeachSeen } = get();
    set({ elementsTeachSeen: { ...elementsTeachSeen, [id]: true } });
  },

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
    const now = Date.now();
    if (id === "beat_sync") {
      const { deck, deckIndex } = get();
      const activeMod = deck[deckIndex]?.mod ?? null;
      // 04 §13.5: `extra_ring` adds a ring to every Beat Sync wave spawned while on screen.
      const cfg = effectiveBeatSyncConfig(activeMod);
      const rings = Array.from({ length: cfg.rings }, (_, i) => ({ id: i }));
      const pos = pickPositions(rings.length, 76, now);
      set({ activeWave: { element: "beat_sync", startedAt: now, pos, rings }, lastSpawnedElement: id });
    }
    if (id === "duet_loop") {
      const pos = pickPositions(BALANCE.elements.duetLoop.pods, 76, now);
      set({
        activeWave: {
          element: "duet_loop", startedAt: now, pos,
          armedIndex: null, armedAt: null, firstArmedAt: null, completed: 0,
        },
        lastSpawnedElement: id,
      });
    }
    if (id === "hold_drop") {
      const [pos] = pickPositions(1, 100, now);
      set({
        activeWave: { element: "hold_drop", startedAt: now, pos, pressedAt: null },
        lastSpawnedElement: id,
      });
    }
    if (id === "swipe_hits") {
      const count = BALANCE.elements.swipeHits.traces;
      // Pick 2 positions per trace (from + to), non-overlapping across all dots.
      const pos = pickPositions(count * 2, 56, now);
      const traces = Array.from({ length: count }, (_, i) => ({
        id: i,
        from: pos[i * 2],
        to:   pos[i * 2 + 1],
      }));
      set({
        activeWave: { element: "swipe_hits", startedAt: now, traces },
        lastSpawnedElement: id,
      });
    }
  },

  tapRing: (ringId) => {
    const { activeWave, tapPower, multiplier, followerConversion, combo, viralUntil, wallet, deck, deckIndex } = get();
    if (!activeWave || activeWave.element !== "beat_sync") return;
    const ring = activeWave.rings.find(r => r.id === ringId);
    if (!ring || ring.grade) return;

    const activeMod = deck[deckIndex]?.mod ?? null;
    const grade = gradeForScale(ringScale(activeWave.startedAt, ringId, activeMod), activeMod);
    const gradeMult = GRADE_MULT[grade];

    if (gradeMult > 0) {
      // 04 §13.2/13.8: per-ring payout = gradeMult × gainPerPost × comboMult × viralMult
      const comboMult = 1 + Math.min(combo, BALANCE.feed.comboCap) * BALANCE.feed.comboPerTap;
      const k = gradeMult * comboMult * viralMult(viralUntil);
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
    const { activeWave, tapPower, multiplier, followerConversion, combo, viralUntil, wallet, deck, deckIndex } = get();
    if (!activeWave || activeWave.element !== "duet_loop") return;
    if (activeWave.armedIndex === null) return;

    const cfg = BALANCE.elements.duetLoop;
    const activeMod = deck[deckIndex]?.mod ?? null;
    const comboMult = 1 + Math.min(combo, BALANCE.feed.comboCap) * BALANCE.feed.comboPerTap;
    const completed = activeWave.completed + 1;

    // 04 §13.2/13.8: pod tap pays podPayout; the final pod ALSO pays flowBonus if the
    // chain completed within flowSec of the wave's first core tap. All ×viralMult.
    let k = cfg.podPayout * comboMult;
    if (isFlowed(activeWave.firstArmedAt, completed, activeMod)) {
      k += cfg.flowBonus * comboMult;
    }
    k *= viralMult(viralUntil);

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

  pointerDownHold: () => {
    const { activeWave } = get();
    if (!activeWave || activeWave.element !== "hold_drop") return;
    if (activeWave.pressedAt !== null || activeWave.grade !== undefined) return;
    set({ activeWave: { ...activeWave, pressedAt: Date.now() } });
  },

  pointerUpHold: () => {
    const { activeWave, tapPower, multiplier, followerConversion, combo, viralUntil, wallet } = get();
    if (!activeWave || activeWave.element !== "hold_drop") return;
    if (activeWave.pressedAt === null || activeWave.grade !== undefined) return;

    const progress = chargeProgress(activeWave.pressedAt);
    const { grade, closeness } = holdGrade(progress, activeWave.pressedAt);
    const cfg = BALANCE.elements.holdDrop;
    const payout = grade === "perfect"
      ? cfg.perfectPayoutMin + (cfg.perfectPayout - cfg.perfectPayoutMin) * closeness
      : cfg.weakPayout;
    const newCombo = grade === "perfect"
      ? Math.min(combo + cfg.crestComboKick, BALANCE.feed.comboCap)
      : combo;

    const comboMult = 1 + Math.min(combo, BALANCE.feed.comboCap) * BALANCE.feed.comboPerTap;
    const k = payout * comboMult * viralMult(viralUntil);
    set({
      combo: newCombo,
      wallet: {
        ...wallet,
        coins:          wallet.coins + tapPower * BALANCE.postCoinConversion * multiplier * k,
        followers:      wallet.followers + tapPower * BALANCE.postFollowerConversion * followerConversion * multiplier * k,
        totalFollowers: wallet.totalFollowers + tapPower * BALANCE.postFollowerConversion * followerConversion * multiplier * k,
        likes:          wallet.likes + tapPower * BALANCE.postLikeConversion * multiplier * k,
      },
      activeWave: { ...activeWave, grade, payout, resolvedAt: Date.now() },
    });
  },

  resolveTrace: (traceId, hitTarget) => {
    const { activeWave, tapPower, multiplier, followerConversion, combo, viralUntil, wallet } = get();
    if (!activeWave || activeWave.element !== "swipe_hits") return;
    const trace = activeWave.traces.find(t => t.id === traceId);
    if (!trace || trace.grade !== undefined) return;

    const progress = traceProgress(activeWave.startedAt, traceId);
    const withinWindow = progress >= 0 && progress <= 1;
    const grade: "perfect" | "miss" = withinWindow && hitTarget ? "perfect" : "miss";

    const newTraces = activeWave.traces.map(t => t.id === traceId ? { ...t, grade } : t);
    const allGraded = newTraces.every(t => t.grade !== undefined);
    const allPerfect = newTraces.every(t => t.grade === "perfect");

    const comboMult = 1 + Math.min(combo, BALANCE.feed.comboCap) * BALANCE.feed.comboPerTap;
    const vm = viralMult(viralUntil);
    let k = grade === "perfect" ? BALANCE.elements.swipeHits.perfectPayout * comboMult * vm : 0;
    if (allGraded && allPerfect) {
      k += BALANCE.elements.swipeHits.allPerfectBonus * comboMult * vm;
    }

    set({
      wallet: k > 0 ? {
        ...wallet,
        coins:          wallet.coins + tapPower * BALANCE.postCoinConversion * multiplier * k,
        followers:      wallet.followers + tapPower * BALANCE.postFollowerConversion * followerConversion * multiplier * k,
        totalFollowers: wallet.totalFollowers + tapPower * BALANCE.postFollowerConversion * followerConversion * multiplier * k,
        likes:          wallet.likes + tapPower * BALANCE.postLikeConversion * multiplier * k,
      } : wallet,
      activeWave: {
        ...activeWave,
        traces: newTraces,
        ...(allGraded ? { resolvedAt: Date.now() } : {}),
      },
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
          const { tapPower, multiplier, followerConversion, combo, viralUntil, wallet } = get();
          const comboMult = 1 + Math.min(combo, BALANCE.feed.comboCap) * BALANCE.feed.comboPerTap;
          const k = cfg.perfectWaveBonus * comboMult * viralMult(viralUntil);
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

    if (activeWave?.element === "hold_drop") {
      const cfg = BALANCE.elements.holdDrop;
      // 600ms grace after grade assigned → clear wave
      if (activeWave.grade !== undefined) {
        if (activeWave.resolvedAt !== undefined && Date.now() - activeWave.resolvedAt > 600) {
          set({ activeWave: null, nextWaveAt: Date.now() + idleGapMs });
        }
        return;
      }
      // Auto-overcharge if held past full charge
      if (activeWave.pressedAt !== null && chargeProgress(activeWave.pressedAt) >= 1) {
        const { tapPower, multiplier, followerConversion, combo, viralUntil, wallet } = get();
        const comboMult = 1 + Math.min(combo, BALANCE.feed.comboCap) * BALANCE.feed.comboPerTap;
        const k = cfg.weakPayout * comboMult * viralMult(viralUntil);
        set({
          wallet: {
            ...wallet,
            coins:          wallet.coins + tapPower * BALANCE.postCoinConversion * multiplier * k,
            followers:      wallet.followers + tapPower * BALANCE.postFollowerConversion * followerConversion * multiplier * k,
            totalFollowers: wallet.totalFollowers + tapPower * BALANCE.postFollowerConversion * followerConversion * multiplier * k,
            likes:          wallet.likes + tapPower * BALANCE.postLikeConversion * multiplier * k,
          },
          activeWave: { ...activeWave, grade: "weak", payout: cfg.weakPayout, resolvedAt: Date.now() },
        });
        return;
      }
      // Auto-expire if untouched for expiryAfterSec
      if (activeWave.pressedAt === null && (Date.now() - activeWave.startedAt) / 1000 >= cfg.expiryAfterSec) {
        set({ activeWave: null, nextWaveAt: Date.now() + idleGapMs });
      }
      return;
    }

    if (activeWave?.element === "swipe_hits") {
      // 600ms grace after all traces graded → clear wave
      if (activeWave.resolvedAt !== undefined) {
        if (Date.now() - activeWave.resolvedAt > 600) {
          set({ activeWave: null, nextWaveAt: Date.now() + idleGapMs });
        }
        return;
      }
      // Auto-miss traces whose active window has expired
      const now = Date.now();
      let changed = false;
      const newTraces = activeWave.traces.map(t => {
        if (t.grade !== undefined) return t;
        if (traceProgress(activeWave.startedAt, t.id) > 1) {
          changed = true;
          return { ...t, grade: "miss" as const };
        }
        return t;
      });
      if (changed) {
        const allGraded = newTraces.every(t => t.grade !== undefined);
        set({
          activeWave: {
            ...activeWave,
            traces: newTraces,
            ...(allGraded ? { resolvedAt: now } : {}),
          },
        });
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
