import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import type { VideoCard, LobbyClientMessage } from "../../party/types";
import { BALANCE } from "../../features/economy/balance";
import { coreCoinMult, effectiveWaveIdleGapSec, MOD_IDS } from "../../features/feed/mods";
import { CAPTION_IDS } from "../../features/feed/npcVideos";
import { lobbySendRef } from "../../party/socketRefs";

// Duplicated from useLobby.ts/useStreamRoom.ts (small pure fn, codebase convention).
function computeCreatorLevel(totalFollowers: number): number {
  return 1 + Math.floor(Math.log10(Math.max(1, totalFollowers)));
}

// Phase 7 — EPHEMERAL, never persisted.
// 7.2 builds the combo/engageTap half; deck/pager/publish/royalty fields activate at 7.5–7.6.
export type FeedSlice = {
  combo: number;        // consecutive-tap counter (float during decay)
  lastTapAt: number;   // ms epoch — drives combo decay check
  // 7.5+ fields (stubs until the pager exists)
  deck: VideoCard[];
  deckIndex: number;
  tapsThisCard: number;
  publishReadyAt: number;

  engageTap: () => void;       // THE clicker: gainPerPost × comboMult (04 §13.1)
  decayCombo: (dt: number) => void;  // called by channelSlice.tick each frame
  // 7.5-7.6 stubs
  setDeck: (cards: VideoCard[]) => void;
  advance: (dir: 1 | -1) => void;
  publishVideo: () => VideoCard | null;
  applyRoyalty: (taps: number, fromHandle: string) => void;
};

export const createFeedSlice: StateCreator<FullState, [], [], FeedSlice> = (set, get) => ({
  combo: 0,
  lastTapAt: 0,
  deck: [],
  deckIndex: 0,
  tapsThisCard: 0,
  publishReadyAt: 0,

  engageTap: () => {
    const { tapPower, multiplier, followerConversion, wallet, combo, activeWave, deck, deckIndex } = get();
    // 04 §13.1: comboMult = 1 + min(combo, comboCap) × comboPerTap
    const comboMult = 1 + Math.min(combo, BALANCE.feed.comboCap) * BALANCE.feed.comboPerTap;
    // 04 §13.5: `core_surge` multiplies TAP CORE coin payout while its card is on screen.
    const activeMod = deck[deckIndex]?.mod ?? null;
    const coinsGain = tapPower * BALANCE.postCoinConversion * multiplier * comboMult * coreCoinMult(activeMod);
    const followersGain = tapPower * BALANCE.postFollowerConversion * followerConversion * multiplier * comboMult;
    const likesGain = tapPower * BALANCE.postLikeConversion * multiplier * comboMult;
    set({
      wallet: {
        ...wallet,
        coins: wallet.coins + coinsGain,
        followers: wallet.followers + followersGain,
        totalFollowers: wallet.totalFollowers + followersGain,
        likes: wallet.likes + likesGain,
      },
      combo: combo + 1,
      lastTapAt: Date.now(),
    });

    // 01 §8.2 / 04 §13.2: a TAP CORE tap arms the next DUET LOOP pod (energy beam).
    if (activeWave?.element === "duet_loop" && activeWave.armedIndex === null
      && activeWave.completed < BALANCE.elements.duetLoop.pods) {
      set({
        activeWave: {
          ...activeWave,
          armedIndex: activeWave.completed,
          armedAt: Date.now(),
          firstArmedAt: activeWave.firstArmedAt ?? Date.now(),
        },
      });
    }
  },

  decayCombo: (dt) => {
    const { combo, lastTapAt } = get();
    if (combo <= 0) return;
    const idleSec = (Date.now() - lastTapAt) / 1000;
    if (idleSec < BALANCE.feed.comboDecayDelaySec) return;
    set({ combo: Math.max(0, combo - BALANCE.feed.comboDecayPerSec * dt) });
  },

  setDeck: (cards) => set({ deck: cards }),

  // 06 §3 pager: swipe changes the active card; combo resets and the wave
  // scheduler reschedules against the new card's mod (TAP CORE/element stage
  // — including any in-flight activeWave — persist across the swipe).
  advance: (dir) => {
    const { deck, deckIndex } = get();
    if (deck.length === 0) return;
    const nextIndex = Math.min(deck.length - 1, Math.max(0, deckIndex + dir));
    if (nextIndex === deckIndex) return;

    const nextMod = deck[nextIndex]?.mod ?? null;
    set({
      deckIndex: nextIndex,
      combo: 0,
      tapsThisCard: 0,
      nextWaveAt: Date.now() + effectiveWaveIdleGapSec(nextMod) * 1000,
    });
  },

  // 04 §13.3: POST grants an instant burst of publishBurstTaps × gainPerPost
  // (no combo/mod multiplier), then gates the POST button for publishCooldownSec.
  publishVideo: () => {
    const { publishReadyAt, tapPower, multiplier, followerConversion, wallet, handle, activeTrend } = get();
    if (Date.now() < publishReadyAt) return null;

    const burst = BALANCE.feed.publishBurstTaps;
    const coinsGain = tapPower * BALANCE.postCoinConversion * multiplier * burst;
    const followersGain = tapPower * BALANCE.postFollowerConversion * followerConversion * multiplier * burst;
    const likesGain = tapPower * BALANCE.postLikeConversion * multiplier * burst;

    const card: VideoCard = {
      videoId: crypto.randomUUID(),
      handle,
      creatorLevel: computeCreatorLevel(wallet.totalFollowers),
      topic: activeTrend ?? "trending",
      captionId: CAPTION_IDS[Math.floor(Math.random() * CAPTION_IDS.length)],
      mod: MOD_IDS[Math.floor(Math.random() * MOD_IDS.length)],
      postedAt: Date.now(),
      tapCount: 0,
    };

    set({
      wallet: {
        ...wallet,
        coins: wallet.coins + coinsGain,
        followers: wallet.followers + followersGain,
        totalFollowers: wallet.totalFollowers + followersGain,
        likes: wallet.likes + likesGain,
      },
      publishReadyAt: Date.now() + BALANCE.feed.publishCooldownSec * 1000,
    });

    lobbySendRef.current?.({ type: "postVideo", card } satisfies LobbyClientMessage);
    return card;
  },

  applyRoyalty: () => {},
});
