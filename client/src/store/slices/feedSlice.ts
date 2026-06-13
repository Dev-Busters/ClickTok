import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import type { VideoCard, LobbyClientMessage } from "../../party/types";
import { BALANCE } from "../../features/economy/balance";
import { coreCoinMult, effectiveWaveIdleGapSec, viralMult, MOD_IDS } from "../../features/feed/mods";
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
  viralUntil: number;  // (8.4) ms epoch — combo frozen + all payouts ×viralGainMult until this
  // 7.5+ fields (stubs until the pager exists)
  deck: VideoCard[];
  deckIndex: number;
  tapsThisCard: number;
  publishReadyAt: number;
  royaltyToast: string | null;  // (7.6) ephemeral; auto-cleared after 3s

  engageTap: () => void;       // THE clicker: gainPerPost × comboMult (04 §13.1)
  decayCombo: (dt: number) => void;  // called by channelSlice.tick each frame
  setDeck: (cards: VideoCard[]) => void;
  advance: (dir: 1 | -1) => void;    // swipe: flushes engage batch, resets combo
  flushEngage: () => void;           // (7.6) send engage for current card + reset; called on unmount
  publishVideo: () => VideoCard | null;
  applyRoyalty: (taps: number, fromHandle: string, videoId?: string) => void;  // (7.6) poster receives likes
};

export const createFeedSlice: StateCreator<FullState, [], [], FeedSlice> = (set, get) => ({
  combo: 0,
  lastTapAt: 0,
  viralUntil: 0,
  deck: [],
  deckIndex: 0,
  tapsThisCard: 0,
  publishReadyAt: 0,
  royaltyToast: null,

  engageTap: () => {
    const { tapPower, multiplier, followerConversion, wallet, combo, viralUntil, activeWave, deck, deckIndex, tapsThisCard } = get();
    const now = Date.now();
    const cap = BALANCE.feed.comboCap;
    const wasViral = viralUntil > now;
    // 04 §13.8: while VIRAL, combo is frozen at comboCap (taps don't overfill); decay is paused.
    const newCombo = wasViral ? cap : combo + 1;
    // 04 §13.1: comboMult = 1 + min(combo, comboCap) × comboPerTap
    const comboMult = 1 + Math.min(newCombo, cap) * BALANCE.feed.comboPerTap;
    const vMult = viralMult(viralUntil, now);
    const k = comboMult * vMult;
    // 04 §13.5: `core_surge` multiplies TAP CORE coin payout while its card is on screen.
    const activeMod = deck[deckIndex]?.mod ?? null;
    const modMult = coreCoinMult(activeMod);
    const coinsGain = tapPower * BALANCE.postCoinConversion * multiplier * k * modMult;
    const followersGain = tapPower * BALANCE.postFollowerConversion * followerConversion * multiplier * k;
    const likesGain = tapPower * BALANCE.postLikeConversion * multiplier * k;

    // 04 §13.8: trigger VIRAL the instant combo reaches comboCap (not already viral).
    const triggersViral = !wasViral && combo < cap && newCombo >= cap;
    let burstCoins = 0, burstFollowers = 0, burstLikes = 0;
    let newViralUntil = viralUntil;
    if (triggersViral) {
      const burstK = BALANCE.feed.viralBurstMult * comboMult;
      burstCoins = tapPower * BALANCE.postCoinConversion * multiplier * burstK * modMult;
      burstFollowers = tapPower * BALANCE.postFollowerConversion * followerConversion * multiplier * burstK;
      burstLikes = tapPower * BALANCE.postLikeConversion * multiplier * burstK;
      newViralUntil = now + BALANCE.feed.viralSec * 1000;
    }

    set({
      wallet: {
        ...wallet,
        coins: wallet.coins + coinsGain + burstCoins,
        followers: wallet.followers + followersGain + burstFollowers,
        totalFollowers: wallet.totalFollowers + followersGain + burstFollowers,
        likes: wallet.likes + likesGain + burstLikes,
      },
      combo: newCombo,
      viralUntil: newViralUntil,
      lastTapAt: now,
      tapsThisCard: tapsThisCard + 1,  // 7.6: batched for engage flush on swipe-away
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
    const { combo, lastTapAt, viralUntil } = get();
    const now = Date.now();
    // 04 §13.8: VIRAL just ended — settle combo to the exit floor and resume decay.
    if (viralUntil > 0 && now >= viralUntil) {
      set({ combo: BALANCE.feed.viralExitCombo, viralUntil: 0, lastTapAt: now });
      return;
    }
    // 04 §13.8: while VIRAL, combo is frozen — decay is paused.
    if (viralUntil > now) return;
    if (combo <= 0) return;
    const idleSec = (now - lastTapAt) / 1000;
    if (idleSec < BALANCE.feed.comboDecayDelaySec) return;
    set({ combo: Math.max(0, combo - BALANCE.feed.comboDecayPerSec * dt) });
  },

  setDeck: (cards) => set({ deck: cards }),

  // 06 §3 pager: swipe changes the active card; combo resets and the wave
  // scheduler reschedules against the new card's mod (TAP CORE/element stage
  // — including any in-flight activeWave — persist across the swipe).
  advance: (dir) => {
    const { deck, deckIndex, tapsThisCard } = get();
    if (deck.length === 0) return;
    const nextIndex = Math.min(deck.length - 1, Math.max(0, deckIndex + dir));
    if (nextIndex === deckIndex) return;

    // 7.6: flush engage batch before leaving the card.
    if (tapsThisCard > 0) {
      const card = deck[deckIndex];
      if (card) {
        lobbySendRef.current?.({ type: "engage", videoId: card.videoId, taps: tapsThisCard } satisfies LobbyClientMessage);
        // Optimistic tapCount bump so the counter updates locally.
        set({ deck: deck.map((c, i) => i === deckIndex ? { ...c, tapCount: c.tapCount + tapsThisCard } : c) });
      }
    }

    const nextMod = deck[nextIndex]?.mod ?? null;
    set({
      deckIndex: nextIndex,
      combo: 0,
      tapsThisCard: 0,
      nextWaveAt: Date.now() + effectiveWaveIdleGapSec(nextMod) * 1000,
    });
  },

  // Called on HomeFeed unmount (tab-switch) to flush any pending taps.
  flushEngage: () => {
    const { deck, deckIndex, tapsThisCard } = get();
    if (tapsThisCard === 0) return;
    const card = deck[deckIndex];
    if (card) {
      lobbySendRef.current?.({ type: "engage", videoId: card.videoId, taps: tapsThisCard } satisfies LobbyClientMessage);
    }
    set({ tapsThisCard: 0 });
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

  // 7.6: poster receives likes from a viewer's engage batch.
  // Formula: taps × royaltyLikesPerTap (04 §13.4). Also bumps tapCount on the
  // matching deck card so the poster sees the counter rise immediately.
  applyRoyalty: (taps, fromHandle, videoId?) => {
    const { wallet, deck } = get();
    const likesGain = Math.round(taps * BALANCE.feed.royaltyLikesPerTap);
    const toastMsg = `@${fromHandle} binged your video +${likesGain} ❤️`;
    const newDeck = videoId
      ? deck.map(c => c.videoId === videoId ? { ...c, tapCount: c.tapCount + taps } : c)
      : deck;
    set({
      wallet: { ...wallet, likes: wallet.likes + likesGain },
      royaltyToast: toastMsg,
      deck: newDeck,
    });
    setTimeout(() => {
      if (get().royaltyToast === toastMsg) set({ royaltyToast: null });
    }, 3000);
  },
});
