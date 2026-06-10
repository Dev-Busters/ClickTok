import type { StateCreator } from "zustand";
import { BALANCE } from "../../features/economy/balance";
import type { Wallet } from "../../features/economy/types";
import type { FullState } from "../index";

export type ChannelSlice = {
  handle: string;
  wallet: Wallet;
  comments: number;

  // Derived stats (recomputed from upgrades)
  tapPower: number;
  passiveFollowersPerSec: number;
  multiplier: number;

  lastSeenAt: number; // ms epoch, for idle income (04 § Idle)

  setHandle: (handle: string) => void;
  tap: () => void;
  tick: (dt: number) => void;
  getStats: () => { tapPower: number; passiveFollowersPerSec: number; multiplier: number };
};

export const createChannelSlice: StateCreator<FullState, [], [], ChannelSlice> = (set, get) => ({
  handle: "",
  wallet: {
    followers: 0,
    totalFollowers: 0,
    coins: 0,
    diamonds: 0,
    likes: 0,
  },
  comments: 0,
  tapPower: 1,
  passiveFollowersPerSec: 0,
  multiplier: 1,

  lastSeenAt: Date.now(),

  setHandle: (handle) => set({ handle }),

  tap: () => {
    const { tapPower, multiplier, wallet } = get();
    const postPower = tapPower;
    const followerConversion = 1; // no software/skills yet (Phase 1)
    const coinsGain = postPower * BALANCE.postCoinConversion * multiplier;
    const followersGain = postPower * BALANCE.postFollowerConversion * followerConversion * multiplier;
    const likesGain = postPower * BALANCE.postLikeConversion * multiplier;
    set({
      wallet: {
        ...wallet,
        coins: wallet.coins + coinsGain,
        followers: wallet.followers + followersGain,
        totalFollowers: wallet.totalFollowers + followersGain,
        likes: wallet.likes + likesGain,
      },
    });
  },

  tick: (dt) => {
    const { passiveFollowersPerSec, multiplier, wallet, comments } = get();
    const gained = passiveFollowersPerSec * multiplier * dt;
    if (gained === 0) return;
    set({
      wallet: {
        ...wallet,
        followers: wallet.followers + gained,
        totalFollowers: wallet.totalFollowers + gained,
      },
      comments: comments + gained * 0.05 * dt,
    });
  },

  getStats: () => {
    const { tapPower, passiveFollowersPerSec, multiplier } = get();
    return { tapPower, passiveFollowersPerSec, multiplier };
  },
});
