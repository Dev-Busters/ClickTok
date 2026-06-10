import { create } from "zustand";
import { BALANCE } from "../features/economy/balance";
import type { Wallet } from "../features/economy/types";

// --- Upgrade catalog ---
export type UpgradeId =
  | "better_lighting"     // +tap power
  | "ring_light"          // +tap power x2
  | "viral_hooks"         // +passive followers/s
  | "trending_hashtags"   // +passive followers/s x2
  | "collab_network"      // multiplier on all income
  | "algorithm_hacks"     // passive tick rate up
  | "comment_bots"        // +comments/s
  | "super_fans";         // x2 all income

export type Upgrade = {
  id: UpgradeId;
  name: string;
  description: string;
  cost: number;
  purchased: boolean;
  // What it does when purchased
  tapPowerBonus?: number;
  passiveFollowersBonus?: number;
  multiplierBonus?: number;
};

const BASE_UPGRADES: Upgrade[] = [
  { id: "better_lighting", name: "Better Lighting", description: "+5 followers per tap", cost: 50, purchased: false, tapPowerBonus: 5 },
  { id: "ring_light", name: "Ring Light", description: "+20 followers per tap", cost: 250, purchased: false, tapPowerBonus: 20 },
  { id: "viral_hooks", name: "Viral Hooks", description: "+3 followers/sec", cost: 100, purchased: false, passiveFollowersBonus: 3 },
  { id: "trending_hashtags", name: "Trending Hashtags", description: "+15 followers/sec", cost: 500, purchased: false, passiveFollowersBonus: 15 },
  { id: "collab_network", name: "Collab Network", description: "×1.5 all income", cost: 1000, purchased: false, multiplierBonus: 1.5 },
  { id: "algorithm_hacks", name: "Algorithm Hacks", description: "+30 followers/sec", cost: 2000, purchased: false, passiveFollowersBonus: 30 },
  { id: "comment_bots", name: "Comment Bots", description: "+100 followers/sec", cost: 8000, purchased: false, passiveFollowersBonus: 100 },
  { id: "super_fans", name: "Super Fans", description: "×2 all income", cost: 20000, purchased: false, multiplierBonus: 2 },
];

export type GameState = {
  // Channel identity
  handle: string;
  // Core currencies
  wallet: Wallet;
  comments: number;
  // Derived stats (recomputed from upgrades)
  tapPower: number;
  passiveFollowersPerSec: number;
  multiplier: number;
  // Upgrades
  upgrades: Upgrade[];
  // Trend session
  trendTopic: string | null;
  leaderboard: Array<{ id: string; handle: string; followers: number; rank: number }>;
};

type GameActions = {
  setHandle: (handle: string) => void;
  tap: () => void;
  tick: (dt: number) => void;
  buyUpgrade: (id: UpgradeId) => void;
  setTrend: (topic: string) => void;
  setLeaderboard: (entries: GameState["leaderboard"]) => void;
  getStats: () => { tapPower: number; passiveFollowersPerSec: number; multiplier: number };
};

function computeStats(upgrades: Upgrade[]) {
  let tapPower = 1;
  let passiveFollowersPerSec = 0;
  let multiplier = 1;
  for (const u of upgrades) {
    if (!u.purchased) continue;
    if (u.tapPowerBonus) tapPower += u.tapPowerBonus;
    if (u.passiveFollowersBonus) passiveFollowersPerSec += u.passiveFollowersBonus;
    if (u.multiplierBonus) multiplier *= u.multiplierBonus;
  }
  return { tapPower, passiveFollowersPerSec, multiplier };
}

export const useGameStore = create<GameState & GameActions>((set, get) => ({
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
  upgrades: BASE_UPGRADES.map(u => ({ ...u })),
  trendTopic: null,
  leaderboard: [],

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

  buyUpgrade: (id) => {
    const { upgrades, wallet } = get();
    const upgrade = upgrades.find(u => u.id === id);
    if (!upgrade || upgrade.purchased || wallet.coins < upgrade.cost) return;
    const updated = upgrades.map(u => u.id === id ? { ...u, purchased: true } : u);
    const stats = computeStats(updated);
    set({ upgrades: updated, wallet: { ...wallet, coins: wallet.coins - upgrade.cost }, ...stats });
  },

  setTrend: (topic) => set({ trendTopic: topic }),
  setLeaderboard: (leaderboard) => set({ leaderboard }),

  getStats: () => {
    const { tapPower, passiveFollowersPerSec, multiplier } = get();
    return { tapPower, passiveFollowersPerSec, multiplier };
  },
}));
