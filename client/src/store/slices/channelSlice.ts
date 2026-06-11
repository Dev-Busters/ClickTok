import type { StateCreator } from "zustand";
import { BALANCE } from "../../features/economy/balance";
import type { Wallet } from "../../features/economy/types";
import { UPGRADE_CATALOG } from "../../features/upgrades/catalog";
import type { FullState } from "../index";

export type IdleReport = { elapsedSec: number; coins: number; followers: number };

export type ChannelSlice = {
  handle: string;
  wallet: Wallet;
  comments: number;

  // Derived stats (recomputed by recomputeStats() from upgrades/skills)
  tapPower: number;
  passiveFollowersPerSec: number;
  passiveCoinsPerSec: number; // idle income (04 §2)
  multiplier: number;
  followerConversion: number; // posts → followers conversion factor (04 §1)
  boonMultiplier: number; // permanent ×income from "Algorithm Favor" boon (2.7)

  lastSeenAt: number; // ms epoch, for idle income (04 § Idle)

  setHandle: (handle: string) => void;
  tap: () => void;
  tick: (dt: number) => void;
  recomputeStats: () => void; // recompute tapPower/passive/multiplier/followerConversion
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
  followerConversion: 1,
  boonMultiplier: 1,

  lastSeenAt: Date.now(),

  setHandle: (handle) => set({ handle }),

  tap: () => {
    const { tapPower, multiplier, followerConversion, wallet } = get();
    const postPower = tapPower;
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
    // 3.2: runs every frame (the meta loop always calls tick()), so this is
    // the single integration point that catches totalFollowers crossing a
    // milestone from any source (taps, passive income, idle income, runs).
    get().checkMilestones();

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

  // 04 §1/§2: postPower/multiplier/followerConversion/passiveCoinsPerSec from
  // owned gear+software effects and Charisma/Editing skill levels.
  recomputeStats: () => {
    const { ownedUpgrades, skillLevels, boonMultiplier } = get();

    let postPowerAdd = 0;
    let postPowerMult = 1;
    let passiveCoinsAdd = 0;
    let multiplierMult = 1;
    let followerConversionAdd = 0;

    for (const def of UPGRADE_CATALOG) {
      if (!ownedUpgrades[def.id]) continue;
      const e = def.effect;
      if (e.postPowerAdd) postPowerAdd += e.postPowerAdd;
      if (e.postPowerMult) postPowerMult *= e.postPowerMult;
      if (e.passiveCoinsAdd) passiveCoinsAdd += e.passiveCoinsAdd;
      if (e.multiplierMult) multiplierMult *= e.multiplierMult;
      if (e.followerConversionAdd) followerConversionAdd += e.followerConversionAdd;
    }

    const charismaPostBonus = skillLevels.charisma * 1;
    const tapPower = (BALANCE.basePostPower + postPowerAdd + charismaPostBonus) * postPowerMult;
    const multiplier = multiplierMult * boonMultiplier;
    const followerConversion = 1 + followerConversionAdd + skillLevels.editing * 0.05;
    const passiveCoinsPerSec = passiveCoinsAdd * multiplier;

    set({ tapPower, multiplier, followerConversion, passiveCoinsPerSec });
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
