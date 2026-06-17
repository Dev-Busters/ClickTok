import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import { UPGRADE_CATALOG } from "../../features/upgrades/catalog";
import type { Currency } from "../../features/economy/types";
import { track } from "../../lib/telemetry";

export type UpgradesSlice = {
  ownedUpgrades: Record<string, boolean>;
  upgradeLevels: Record<string, number>;
  buyUpgrade: (id: string) => boolean;        // false if locked/can't afford/repeatable
  isUpgradeUnlocked: (id: string) => boolean; // passes `requires`
  upgradeCost: (id: string) => number;        // coins for next level (0 if maxed/not repeatable)
  levelUpgrade: (id: string) => boolean;      // false if can't afford/maxed/not repeatable
};

export const createUpgradesSlice: StateCreator<FullState, [], [], UpgradesSlice> = (set, get) => ({
  ownedUpgrades: {},
  upgradeLevels: {},

  isUpgradeUnlocked: (id) => {
    const def = UPGRADE_CATALOG.find(u => u.id === id);
    if (!def) return false;
    const { requires } = def;
    if (!requires) return true;
    const { wallet, ownedUpgrades } = get();
    if (requires.followers !== undefined && wallet.followers < requires.followers) return false;
    if (requires.upgrades && !requires.upgrades.every(reqId => ownedUpgrades[reqId])) return false;
    return true;
  },

  buyUpgrade: (id) => {
    const def = UPGRADE_CATALOG.find(u => u.id === id);
    if (!def || def.repeatable) return false; // repeatables use levelUpgrade
    const { ownedUpgrades, wallet, isUpgradeUnlocked } = get();
    if (ownedUpgrades[id] || !isUpgradeUnlocked(id)) return false;

    const cost = def.cost ?? {};
    for (const [currency, amount] of Object.entries(cost) as [Currency, number][]) {
      if (wallet[currency] < amount) return false;
    }

    const newWallet = { ...wallet };
    for (const [currency, amount] of Object.entries(cost) as [Currency, number][]) {
      newWallet[currency] -= amount;
    }

    set({
      ownedUpgrades: { ...ownedUpgrades, [id]: true },
      wallet: newWallet,
    });
    get().recomputeStats();
    track('upgrade_purchased', { id, category: def.category, coins: def.cost?.coins ?? 0, handle: get().handle });
    return true;
  },

  upgradeCost: (id) => {
    const def = UPGRADE_CATALOG.find(u => u.id === id);
    if (!def?.repeatable || !def.baseCost || def.costGrowth === undefined) return 0;
    const level = get().upgradeLevels[id] ?? 0;
    if (def.maxLevel !== undefined && level >= def.maxLevel) return 0;
    const base = def.baseCost.coins ?? 0;
    return Math.round(base * Math.pow(def.costGrowth, level));
  },

  levelUpgrade: (id) => {
    const def = UPGRADE_CATALOG.find(u => u.id === id);
    if (!def?.repeatable) return false;
    const { upgradeLevels, wallet } = get();
    const level = upgradeLevels[id] ?? 0;
    if (def.maxLevel !== undefined && level >= def.maxLevel) return false;
    const cost = get().upgradeCost(id);
    if (cost === 0) return false;
    if (wallet.coins < cost) return false;
    set({
      upgradeLevels: { ...upgradeLevels, [id]: level + 1 },
      wallet: { ...wallet, coins: wallet.coins - cost },
    });
    get().recomputeStats();
    track('upgrade_purchased', { id, category: 'repeatable', level: level + 1, coins: cost, handle: get().handle });
    return true;
  },
});
