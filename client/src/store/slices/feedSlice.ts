import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import type { VideoCard } from "../../party/types";
import { BALANCE } from "../../features/economy/balance";

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
    const { tapPower, multiplier, followerConversion, wallet, combo } = get();
    // 04 §13.1: comboMult = 1 + min(combo, comboCap) × comboPerTap
    const comboMult = 1 + Math.min(combo, BALANCE.feed.comboCap) * BALANCE.feed.comboPerTap;
    const coinsGain = tapPower * BALANCE.postCoinConversion * multiplier * comboMult;
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
  },

  decayCombo: (dt) => {
    const { combo, lastTapAt } = get();
    if (combo <= 0) return;
    const idleSec = (Date.now() - lastTapAt) / 1000;
    if (idleSec < BALANCE.feed.comboDecayDelaySec) return;
    set({ combo: Math.max(0, combo - BALANCE.feed.comboDecayPerSec * dt) });
  },

  setDeck: () => {},
  advance: () => {},
  publishVideo: () => null,
  applyRoyalty: () => {},
});
