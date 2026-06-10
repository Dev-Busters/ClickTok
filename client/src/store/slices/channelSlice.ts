import type { StateCreator } from "zustand";
import { BALANCE } from "../../features/economy/balance";
import type { Wallet } from "../../features/economy/types";
import type { FullState } from "../index";

export type IdleReport = { elapsedSec: number; coins: number; followers: number };

export type ChannelSlice = {
  handle: string;
  wallet: Wallet;
  comments: number;

  // Derived stats (recomputed from upgrades)
  tapPower: number;
  passiveFollowersPerSec: number;
  passiveCoinsPerSec: number; // idle income (04 §2); wired up by gear's passiveCoinsAdd in 1.1
  multiplier: number;

  lastSeenAt: number; // ms epoch, for idle income (04 § Idle)

  setHandle: (handle: string) => void;
  tap: () => void;
  tick: (dt: number) => void;
  getStats: () => { tapPower: number; passiveFollowersPerSec: number; multiplier: number };
  applyIdleIncome: (now: number) => IdleReport | null;
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
  passiveCoinsPerSec: 0,
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

  applyIdleIncome: (now) => {
    const { lastSeenAt, passiveCoinsPerSec, wallet } = get();
    const elapsedSec = Math.min((now - lastSeenAt) / 1000, BALANCE.idleCapSec);
    if (elapsedSec <= 0) {
      set({ lastSeenAt: now });
      return null;
    }
    const coins = passiveCoinsPerSec * elapsedSec;
    const followers = coins * 0.1;
    set({
      wallet: {
        ...wallet,
        coins: wallet.coins + coins,
        followers: wallet.followers + followers,
        totalFollowers: wallet.totalFollowers + followers,
      },
      lastSeenAt: now,
    });
    return { elapsedSec, coins, followers };
  },
});
