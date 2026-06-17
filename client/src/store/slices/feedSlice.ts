import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import type { VideoCard, ReactionKind, LobbyClientMessage } from "../../party/types";
import type { VideoPost } from "../../features/channel/types";
import { BALANCE } from "../../features/economy/balance";
import { coreCoinMult, effectiveWaveIdleGapSec, viralMult, MOD_IDS } from "../../features/feed/mods";
import { CAPTION_IDS } from "../../features/feed/npcVideos";
import { lobbySendRef } from "../../party/socketRefs";
import { track } from "../../lib/telemetry";

const REACTION_KINDS: ReactionKind[] = ["like", "comment", "share", "follow"];
const REACTION_COUNTER_KEY: Partial<Record<ReactionKind, keyof VideoCard["reactions"]>> = {
  like: "likes", comment: "comments", share: "shares",
};

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
  // 15.3 (11 §C): view-buff — temporary coin-tap multiplier when a buffed card becomes active.
  viewBuffUntil: number; // ms epoch; > now ⇒ buff active
  viewBuffMult: number;  // coin multiplier from the active card's buff (e.g. 1.15)
  // 14.1 (10 §A): Momentum — ephemeral no-dead-zones meter, never persisted.
  momentum: number;             // 0..momentumCap; fills w/ TEB taps + rail reactions, drains idle
  lastMomentumEngageAt: number; // ms epoch of last momentum-feeding action — idle decay gate
  momentumFiredAt: number;      // ms epoch ping — TapCore watches this to fire the flourish
  lastMomentumBonusCoins: number; // coins paid by the most recent Momentum bonus (for float text)
  // 7.5+ fields (stubs until the pager exists)
  deck: VideoCard[];
  deckIndex: number;
  tapsThisCard: number;
  publishReadyAt: number;
  royaltyToast: string | null;  // (7.6) ephemeral; auto-cleared after 3s
  reactedByVideo: Record<string, Partial<Record<ReactionKind, true>>>; // (8.5) session-ephemeral
                               //   once-per-VIDEO gate, keyed by videoId

  engageTap: () => void;       // THE clicker: gainPerPost × comboMult (04 §13.1)
  decayCombo: (dt: number) => void;  // called by channelSlice.tick each frame
  decayMomentum: (dt: number) => void; // (14.1) called by channelSlice.tick each frame
  setDeck: (cards: VideoCard[]) => void;
  advance: (dir: 1 | -1) => void;    // swipe: flushes engage batch, resets combo
  flushEngage: () => void;           // (7.6) send engage for current card + reset; called on unmount
  publishVideo: () => VideoCard | null;
  applyRoyalty: (taps: number, fromHandle: string, videoId?: string, reactions?: Partial<Record<ReactionKind, boolean>>) => void;  // (7.6/8.6) poster receives likes/followers
  reactToCard: (kind: ReactionKind) => boolean; // (8.5) false if already reacted on this video;
                               // pays 04 §13.7 × comboMult (× viral), bumps the local card
                               // counter optimistically, fires SUPERFAN sweep when all 4 done
};

export const createFeedSlice: StateCreator<FullState, [], [], FeedSlice> = (set, get) => ({
  combo: 0,
  lastTapAt: 0,
  viralUntil: 0,
  viewBuffUntil: 0,
  viewBuffMult: 1,
  momentum: 0,
  lastMomentumEngageAt: 0,
  momentumFiredAt: 0,
  lastMomentumBonusCoins: 0,
  deck: [],
  deckIndex: 0,
  tapsThisCard: 0,
  publishReadyAt: 0,
  royaltyToast: null,
  reactedByVideo: {},

  engageTap: () => {
    const { tapPower, multiplier, followerConversion, wallet, combo, viralUntil, viewBuffUntil, viewBuffMult, activeWave, deck, deckIndex, tapsThisCard, viewsTotal, coinsEarned } = get();
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
    // 15.3 (11 §C): view-buff — temporary +X% coins per tap when a buffed card is active.
    const bMult = viewBuffUntil > now ? viewBuffMult : 1;
    const coinsGain = tapPower * BALANCE.postCoinConversion * multiplier * k * modMult * bMult;
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
      viewsTotal: viewsTotal + 1,
      coinsEarned: coinsEarned + coinsGain + burstCoins,
    });

    // 14.1 (10 §A): Momentum — fills with engagement, drains while idle; on
    // fill, pay a coin-burst bonus (a multiple of this tap's gain) and ping
    // momentumFiredAt so TapCore can fire the flourish.
    const { momentum } = get();
    const nextMomentum = momentum + BALANCE.feed.momentumPerEngage;
    if (nextMomentum >= BALANCE.feed.momentumCap) {
      const bonusCoins = coinsGain * BALANCE.feed.momentumBonusMult;
      set(s => ({
        momentum: 0,
        lastMomentumEngageAt: now,
        momentumFiredAt: now,
        lastMomentumBonusCoins: bonusCoins,
        wallet: { ...s.wallet, coins: s.wallet.coins + bonusCoins },
        coinsEarned: s.coinsEarned + bonusCoins,
      }));
    } else {
      set({ momentum: nextMomentum, lastMomentumEngageAt: now });
    }

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

  // 14.1 (10 §A): drains the Momentum meter after an idle grace period so an
  // AFK player never triggers the bonus.
  decayMomentum: (dt) => {
    const { momentum, lastMomentumEngageAt } = get();
    if (momentum <= 0) return;
    const idleSec = (Date.now() - lastMomentumEngageAt) / 1000;
    if (idleSec < BALANCE.feed.momentumIdleDelaySec) return;
    set({ momentum: Math.max(0, momentum - BALANCE.feed.momentumIdleDecayPerSec * dt) });
  },

  // (8.5) defensively default `reactions` on cards from a pre-8.6 server.
  // 15.3: also apply the first card's buff immediately on deck load.
  setDeck: (cards) => {
    const normalized = cards.map(c => ({ ...c, reactions: c.reactions ?? { likes: 0, comments: 0, shares: 0 } }));
    const firstBuff = normalized[0]?.buff;
    const now = Date.now();
    set({
      deck: normalized,
      ...(firstBuff ? {
        viewBuffUntil: now + firstBuff.durationSec * 1000,
        viewBuffMult: firstBuff.mult,
      } : {}),
    });
    if (firstBuff) {
      track('video_buff_applied', { handle: get().handle, buffMult: firstBuff.mult, buffDurationSec: firstBuff.durationSec, source: 'deck_load' });
    }
    track('video_viewed', { handle: get().handle, videoId: normalized[0]?.videoId, npc: normalized[0]?.npc ?? true });
  },

  // 06 §3 pager: swipe changes the active card; combo resets and the wave
  // scheduler reschedules against the new card's mod (TAP CORE/element stage
  // — including any in-flight activeWave — persist across the swipe).
  // 15.3: apply the new card's view-buff.
  advance: (dir) => {
    const { deck, deckIndex, tapsThisCard, reactedByVideo } = get();
    if (deck.length === 0) return;
    const nextIndex = Math.min(deck.length - 1, Math.max(0, deckIndex + dir));
    if (nextIndex === deckIndex) return;

    // 7.6/8.6: flush engage batch (taps + this card's reactions) before leaving the card.
    const card = deck[deckIndex];
    const reactions = card ? reactedByVideo[card.videoId] : undefined;
    if (card && (tapsThisCard > 0 || reactions)) {
      lobbySendRef.current?.({
        type: "engage", videoId: card.videoId, taps: tapsThisCard,
        ...(reactions ? { reactions } : {}),
      } satisfies LobbyClientMessage);
      if (tapsThisCard > 0) {
        // Optimistic tapCount bump so the counter updates locally.
        set({ deck: deck.map((c, i) => i === deckIndex ? { ...c, tapCount: c.tapCount + tapsThisCard } : c) });
      }
    }

    const nextCard = deck[nextIndex];
    const nextMod = nextCard?.mod ?? null;
    const nextBuff = nextCard?.buff;
    const now = Date.now();
    set({
      deckIndex: nextIndex,
      combo: 0,
      tapsThisCard: 0,
      nextWaveAt: now + effectiveWaveIdleGapSec(nextMod) * 1000,
      ...(nextBuff ? {
        viewBuffUntil: now + nextBuff.durationSec * 1000,
        viewBuffMult: nextBuff.mult,
      } : {}),
    });
    if (nextBuff) {
      track('video_buff_applied', { handle: get().handle, buffMult: nextBuff.mult, buffDurationSec: nextBuff.durationSec, source: 'swipe' });
    }
    track('video_viewed', { handle: get().handle, videoId: nextCard?.videoId, npc: nextCard?.npc ?? true });
  },

  // Called on HomeFeed unmount (tab-switch) to flush any pending taps + reactions.
  flushEngage: () => {
    const { deck, deckIndex, tapsThisCard, reactedByVideo } = get();
    const card = deck[deckIndex];
    const reactions = card ? reactedByVideo[card.videoId] : undefined;
    if (tapsThisCard === 0 && !reactions) return;
    if (card) {
      lobbySendRef.current?.({
        type: "engage", videoId: card.videoId, taps: tapsThisCard,
        ...(reactions ? { reactions } : {}),
      } satisfies LobbyClientMessage);
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

    const now = Date.now();
    const videoId = crypto.randomUUID();
    const topic = activeTrend ?? "trending";
    const captionId = CAPTION_IDS[Math.floor(Math.random() * CAPTION_IDS.length)];
    const buff = { mult: BALANCE.catalog.viewBuffMult, durationSec: BALANCE.catalog.viewBuffDurationSec };

    const card: VideoCard = {
      videoId,
      handle,
      creatorLevel: computeCreatorLevel(wallet.totalFollowers),
      topic,
      captionId,
      mod: MOD_IDS[Math.floor(Math.random() * MOD_IDS.length)],
      postedAt: now,
      tapCount: 0,
      reactions: { likes: 0, comments: 0, shares: 0 },
      buff,
    };

    // 15.1 (11 §A): persist the video in catalogSlice with its passive yield.
    const videoPost: VideoPost = {
      id: videoId,
      topic,
      captionId,
      createdAt: now,
      coinsPerSec: tapPower * BALANCE.catalog.catalogYieldCoeff * multiplier,
      followersPerSec: 0,
      peakAtSec: BALANCE.catalog.catalogPeakAtSec,
      buff,
    };
    get().addVideo(videoPost);

    set({
      wallet: {
        ...wallet,
        coins: wallet.coins + coinsGain,
        followers: wallet.followers + followersGain,
        totalFollowers: wallet.totalFollowers + followersGain,
        likes: wallet.likes + likesGain,
      },
      publishReadyAt: now + BALANCE.feed.publishCooldownSec * 1000,
    });

    lobbySendRef.current?.({ type: "postVideo", card } satisfies LobbyClientMessage);
    track('video_posted', { handle, topic, captionId });
    return card;
  },

  // 7.6/8.6: poster receives likes (+ followers from reactions) from a viewer's engage batch.
  // Tap likes: taps × royaltyLikesPerTap (04 §13.4). Reaction royalties (04 §13.7):
  // royaltyLikesPerReaction likes per like/comment/share, royaltyFollowersPerFollow followers
  // per follow. Also bumps tapCount on the matching deck card so the poster sees it rise.
  applyRoyalty: (taps, fromHandle, videoId?, reactions?) => {
    const { wallet, deck } = get();
    const tapLikes = Math.round(taps * BALANCE.feed.royaltyLikesPerTap);
    const reactionLikes = reactions
      ? REACTION_KINDS.filter(k => k !== "follow" && reactions[k]).length * BALANCE.feed.royaltyLikesPerReaction
      : 0;
    const likesGain = tapLikes + reactionLikes;
    const followersGain = reactions?.follow ? BALANCE.feed.royaltyFollowersPerFollow : 0;

    const parts: string[] = [];
    if (likesGain > 0) parts.push(`+${likesGain} ❤️`);
    if (followersGain > 0) parts.push(`+${followersGain} 👥`);
    const toastMsg = `@${fromHandle} engaged your video ${parts.join(" ")}`;

    const newDeck = videoId
      ? deck.map(c => c.videoId === videoId ? { ...c, tapCount: c.tapCount + taps } : c)
      : deck;
    set({
      wallet: {
        ...wallet,
        likes: wallet.likes + likesGain,
        followers: wallet.followers + followersGain,
        totalFollowers: wallet.totalFollowers + followersGain,
      },
      royaltyToast: toastMsg,
      deck: newDeck,
    });
    setTimeout(() => {
      if (get().royaltyToast === toastMsg) set({ royaltyToast: null });
    }, 3000);
  },

  // 04 §13.7: rail reaction — once per video per session, pays
  // railReactionMult[kind] × gainPerPost × comboMult × viralMult; the 4th
  // reaction on a card adds railSweepBonus × gainPerPost × comboMult × viralMult.
  // Rail presses do NOT build combo and video mods do NOT apply.
  reactToCard: (kind) => {
    const { deck, deckIndex, reactedByVideo, combo, viralUntil, tapPower, multiplier, followerConversion, wallet } = get();
    const card = deck[deckIndex];
    if (!card) return false;
    if (reactedByVideo[card.videoId]?.[kind]) return false;

    const cap = BALANCE.feed.comboCap;
    const comboMult = 1 + Math.min(combo, cap) * BALANCE.feed.comboPerTap;
    const vMult = viralMult(viralUntil, Date.now());

    const reacted = { ...reactedByVideo[card.videoId], [kind]: true as const };
    const isSweep = REACTION_KINDS.every(k => reacted[k]);

    const k = (BALANCE.feed.railReactionMult[kind] + (isSweep ? BALANCE.feed.railSweepBonus : 0)) * comboMult * vMult;
    const coinsGain = tapPower * BALANCE.postCoinConversion * multiplier * k;
    const followersGain = tapPower * BALANCE.postFollowerConversion * followerConversion * multiplier * k;
    const likesGain = tapPower * BALANCE.postLikeConversion * multiplier * k;

    const counterKey = REACTION_COUNTER_KEY[kind];
    const newDeck = counterKey
      ? deck.map((c, i) => i === deckIndex
          ? { ...c, reactions: { ...c.reactions, [counterKey]: c.reactions[counterKey] + 1 } }
          : c)
      : deck;

    set({
      wallet: {
        ...wallet,
        coins: wallet.coins + coinsGain,
        followers: wallet.followers + followersGain,
        totalFollowers: wallet.totalFollowers + followersGain,
        likes: wallet.likes + likesGain,
      },
      deck: newDeck,
      reactedByVideo: { ...reactedByVideo, [card.videoId]: reacted },
    });

    // 14.1 (10 §A): rail reactions feed Momentum the same as TEB taps.
    const { momentum } = get();
    const now = Date.now();
    const nextMomentum = momentum + BALANCE.feed.momentumPerEngage;
    if (nextMomentum >= BALANCE.feed.momentumCap) {
      const bonusCoins = coinsGain * BALANCE.feed.momentumBonusMult;
      set(s => ({
        momentum: 0,
        lastMomentumEngageAt: now,
        momentumFiredAt: now,
        lastMomentumBonusCoins: bonusCoins,
        wallet: { ...s.wallet, coins: s.wallet.coins + bonusCoins },
      }));
    } else {
      set({ momentum: nextMomentum, lastMomentumEngageAt: now });
    }

    return true;
  },
});
