import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import { BALANCE } from "../../features/economy/balance";
import type { GiftTier, LiveStreamSummary, QuickChatId, RunSnapshot, SpectatorEvent, StreamPoll } from "../../party/types";
import { spectatorSocketRef } from "../../party/socketRefs";

// Defined here per 03 §6 (not a wire type — stays in this slice).
export type WatchDrop = {
  watchSec: number;
  coins: number;
  diamonds: number;
  followers: number;
  likes: number;
  jackpotCoins: number;        // early-backer payout (0 until 4.3)
  shoutoutFollowers: number;   // 0 unless shouted out (4.3)
};

const SPECTATE_FEED_CAP = 40;

export type SpectateSlice = {
  spectating: LiveStreamSummary | null;
  liveSnapshot: RunSnapshot | null;
  spectateFeed: SpectatorEvent[];
  realViewers: number;
  watchStartedAt: number | null;       // ms epoch
  myGiftCoinsSent: number;
  myEarlyGiftCoins: number;
  activePoll: StreamPoll | null;
  pendingDrop: WatchDrop | null;       // drives the viewer result sheet
  // 4.3: additional viewer-interaction state
  tapCount: number;                    // taps sent toward micro-coin reward cap
  quickChatCooldowns: Record<QuickChatId, number>; // ms epoch until each preset is available
  myVotedPollId: string | null;
  myVotedChoiceIndex: number | null;
  currentPollTally: number[] | null;
  pendingShoutoutFollowers: number;    // followers to show in drop sheet from shoutout

  joinStream: (s: LiveStreamSummary) => void;
  // Deviation from 03 §6 (which has `() => void`): optional endedGrade param
  // so the hook can pass the stream's final grade when the server sends `ended`.
  // Without it (voluntary leave before end) gradeMult = 1, diamond = 0 per 04 §12.4.
  leaveStream: (endedGrade?: string) => void;
  applySnapshot: (snap: RunSnapshot, realViewers: number) => void;
  // 4.3: viewer interaction actions
  sendViewerGift: (tier: GiftTier) => void;   // spend coins, grant clout-back, send to socket
  castVote: (pollId: string, choiceIndex: number) => void;
  applyVoteResult: (pollId: string, tally: number[]) => void;
  applyShoutout: (handle: string, followers: number) => void;
  recordViewerTap: (taps: number) => void;    // track taps for micro-coin rewards
};

const INITIAL_CHAT_COOLDOWNS: Record<QuickChatId, number> = {
  w: 0, fire: 0, icon: 0, ratio: 0, cooked: 0, real_one: 0,
};

export const createSpectateSlice: StateCreator<FullState, [], [], SpectateSlice> = (set, get) => ({
  spectating: null,
  liveSnapshot: null,
  spectateFeed: [],
  realViewers: 0,
  watchStartedAt: null,
  myGiftCoinsSent: 0,
  myEarlyGiftCoins: 0,
  activePoll: null,
  pendingDrop: null,
  tapCount: 0,
  quickChatCooldowns: { ...INITIAL_CHAT_COOLDOWNS },
  myVotedPollId: null,
  myVotedChoiceIndex: null,
  currentPollTally: null,
  pendingShoutoutFollowers: 0,

  joinStream: (s) =>
    set({
      spectating: s,
      liveSnapshot: null,
      spectateFeed: [],
      realViewers: 0,
      watchStartedAt: Date.now(),
      myGiftCoinsSent: 0,
      myEarlyGiftCoins: 0,
      activePoll: null,
      pendingDrop: null,
      tapCount: 0,
      quickChatCooldowns: { ...INITIAL_CHAT_COOLDOWNS },
      myVotedPollId: null,
      myVotedChoiceIndex: null,
      currentPollTally: null,
      pendingShoutoutFollowers: 0,
    }),

  // 04 §12.4: compute and grant the watch-drop, then show the viewer result sheet.
  leaveStream: (endedGrade) => {
    const { spectating, watchStartedAt, wallet, myEarlyGiftCoins, pendingShoutoutFollowers } = get();

    // If we were never properly watching (e.g., called defensively), just clear.
    if (!spectating || !watchStartedAt) {
      set({
        spectating: null, liveSnapshot: null, spectateFeed: [],
        realViewers: 0, watchStartedAt: null, myGiftCoinsSent: 0, myEarlyGiftCoins: 0,
        activePoll: null, tapCount: 0, pendingShoutoutFollowers: 0,
        myVotedPollId: null, myVotedChoiceIndex: null, currentPollTally: null,
      });
      return;
    }

    const watchSec = Math.max(0, Math.round((Date.now() - watchStartedAt) / 1000));
    const { social: s } = BALANCE;
    const creatorLevel = spectating.creatorLevel;

    // Leaving before stream ends → gradeMult = 1, no diamond (04 §12.4).
    type GradeKey = keyof typeof s.dropGradeMult;
    const streamEnded = endedGrade != null;
    const gradeMult = streamEnded && endedGrade in s.dropGradeMult
      ? s.dropGradeMult[endedGrade as GradeKey]
      : 1;

    const baseCoins = Math.round(watchSec * s.dropCoinsPerSecPerLevel * creatorLevel * gradeMult);
    // 04 §12.2: early-backer jackpot — if gifts sent ≤30s AND grade ≥ A.
    const jackpotCoins = streamEnded &&
      (endedGrade === "S" || endedGrade === "A") &&
      myEarlyGiftCoins > 0
        ? Math.round(myEarlyGiftCoins * s.earlyBackerJackpotMult)
        : 0;
    const coins = baseCoins + jackpotCoins;
    const likes = Math.round(watchSec * s.dropLikesPerSec);
    const followers = Math.min(
      s.dropFollowerCap,
      Math.floor(watchSec / 30) * s.dropFollowerPer30s,
    );
    const diamonds =
      streamEnded &&
      (endedGrade === "S" || endedGrade === "A") &&
      watchSec >= s.dropDiamondMinSec
        ? 1
        : 0;

    const drop: WatchDrop = {
      watchSec,
      coins,
      diamonds,
      followers,
      likes,
      jackpotCoins,
      shoutoutFollowers: pendingShoutoutFollowers,
    };

    set({
      wallet: {
        ...wallet,
        coins: wallet.coins + coins,
        likes: wallet.likes + likes,
        followers: wallet.followers + followers,
        totalFollowers: wallet.totalFollowers + followers,
        diamonds: wallet.diamonds + diamonds,
      },
      pendingDrop: drop,
      spectating: null, liveSnapshot: null, spectateFeed: [],
      realViewers: 0, watchStartedAt: null, myGiftCoinsSent: 0, myEarlyGiftCoins: 0,
      activePoll: null, tapCount: 0, pendingShoutoutFollowers: 0,
      myVotedPollId: null, myVotedChoiceIndex: null, currentPollTally: null,
    });
  },

  applySnapshot: (snap, realViewers) => {
    set((state) => {
      const incoming = snap.newEvents ?? [];
      const merged = [...state.spectateFeed, ...incoming];
      // Clear a poll whose time window has passed per the run clock.
      const pollExpired = state.activePoll != null && snap.clockSec > state.activePoll.closesAtSec;
      return {
        liveSnapshot: snap,
        realViewers,
        spectateFeed:
          merged.length > SPECTATE_FEED_CAP
            ? merged.slice(merged.length - SPECTATE_FEED_CAP)
            : merged,
        ...(pollExpired ? { activePoll: null, currentPollTally: null, myVotedPollId: null, myVotedChoiceIndex: null } : {}),
      };
    });
  },

  // 04 §12.2: spend coins on a gift, grant clout-back likes, track gift log.
  sendViewerGift: (tier) => {
    const { wallet, spectating, liveSnapshot, myGiftCoinsSent, myEarlyGiftCoins } = get();
    const cost = BALANCE.run.giftCoinValue[tier];
    if (wallet.coins < cost || !spectating) return;

    const { social: s } = BALANCE;
    const creatorLevel = spectating.creatorLevel;
    const likesBack = Math.round(cost * (s.giftCloutbackBase + s.giftCloutbackPerLevel * creatorLevel));
    const clockSec = liveSnapshot?.clockSec ?? 0;
    const isEarly = clockSec <= s.earlyBackerWindowSec;

    set({
      wallet: {
        ...wallet,
        coins: wallet.coins - cost,
        likes: wallet.likes + likesBack,
      },
      myGiftCoinsSent: myGiftCoinsSent + cost,
      myEarlyGiftCoins: isEarly ? myEarlyGiftCoins + cost : myEarlyGiftCoins,
    });

    spectatorSocketRef.current?.send(JSON.stringify({ type: "sendGift", tier }));
  },

  // 04 §12.2: cast a vote on an active poll.
  castVote: (pollId, choiceIndex) => {
    set({ myVotedPollId: pollId, myVotedChoiceIndex: choiceIndex });
    spectatorSocketRef.current?.send(JSON.stringify({ type: "vote", pollId, choiceIndex }));
  },

  // Called when the server broadcasts the final voteTally.
  // If the viewer voted for the winning option, grant coins.
  applyVoteResult: (pollId, tally) => {
    const { myVotedPollId, myVotedChoiceIndex, spectating, wallet } = get();
    set({ currentPollTally: tally });
    if (myVotedPollId !== pollId || myVotedChoiceIndex === null) return;
    if (tally.length === 0) return;
    const max = Math.max(...tally);
    if (max === 0) return;
    const winningIndex = tally.indexOf(max);
    if (winningIndex !== myVotedChoiceIndex) return;
    const creatorLevel = spectating?.creatorLevel ?? 1;
    const coins = BALANCE.social.voteWinCoinsPerLevel * creatorLevel;
    set({
      wallet: { ...wallet, coins: wallet.coins + coins },
      myVotedPollId: null,
      myVotedChoiceIndex: null,
    });
  },

  // Called when the server broadcasts a shoutout with our handle.
  applyShoutout: (_handle, followers) => {
    const { wallet, pendingDrop } = get();
    set({
      wallet: {
        ...wallet,
        followers: wallet.followers + followers,
        totalFollowers: wallet.totalFollowers + followers,
      },
      pendingShoutoutFollowers: followers,
      // If the drop sheet is already showing, update it immediately.
      pendingDrop: pendingDrop ? { ...pendingDrop, shoutoutFollowers: followers } : pendingDrop,
    });
  },

  // 04 §12.1: record viewer taps for micro-coin rewards.
  recordViewerTap: (taps) => {
    const { tapCount, spectating, wallet } = get();
    if (!spectating) return;
    const { social: s } = BALANCE;
    const newCount = tapCount + taps;
    const prevBundles = Math.floor(Math.min(tapCount, s.tapRewardCapPerStream) / s.tapRewardBundle);
    const newBundles = Math.floor(Math.min(newCount, s.tapRewardCapPerStream) / s.tapRewardBundle);
    const bundlesEarned = newBundles - prevBundles;
    if (bundlesEarned > 0) {
      const coins = bundlesEarned * spectating.creatorLevel;
      set({ tapCount: newCount, wallet: { ...wallet, coins: wallet.coins + coins } });
    } else {
      set({ tapCount: newCount });
    }
  },
});
