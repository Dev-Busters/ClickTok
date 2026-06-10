import type { StateCreator } from "zustand";
import type { FullState } from "../index";

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

export type UpgradesSlice = {
  upgrades: Upgrade[];
  buyUpgrade: (id: UpgradeId) => void;
};

export function computeStats(upgrades: Upgrade[]) {
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

export const createUpgradesSlice: StateCreator<FullState, [], [], UpgradesSlice> = (set, get) => ({
  upgrades: BASE_UPGRADES.map(u => ({ ...u })),

  buyUpgrade: (id) => {
    const { upgrades, wallet } = get();
    const upgrade = upgrades.find(u => u.id === id);
    if (!upgrade || upgrade.purchased || wallet.coins < upgrade.cost) return;
    const updated = upgrades.map(u => u.id === id ? { ...u, purchased: true } : u);
    const stats = computeStats(updated);
    set({ upgrades: updated, wallet: { ...wallet, coins: wallet.coins - upgrade.cost }, ...stats });
  },
});
