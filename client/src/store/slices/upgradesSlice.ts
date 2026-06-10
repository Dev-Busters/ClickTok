import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import { UPGRADE_CATALOG } from "../../features/upgrades/catalog";
import type { Currency } from "../../features/economy/types";

export type UpgradesSlice = {
  ownedUpgrades: Record<string, boolean>;
  buyUpgrade: (id: string) => boolean;        // false if locked/can't afford
  isUpgradeUnlocked: (id: string) => boolean; // passes `requires`
};

export const createUpgradesSlice: StateCreator<FullState, [], [], UpgradesSlice> = (set, get) => ({
  ownedUpgrades: {},

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
    if (!def) return false;
    const { ownedUpgrades, wallet, isUpgradeUnlocked } = get();
    if (ownedUpgrades[id] || !isUpgradeUnlocked(id)) return false;

    for (const [currency, amount] of Object.entries(def.cost) as [Currency, number][]) {
      if (wallet[currency] < amount) return false;
    }

    const newWallet = { ...wallet };
    for (const [currency, amount] of Object.entries(def.cost) as [Currency, number][]) {
      newWallet[currency] -= amount;
    }

    set({
      ownedUpgrades: { ...ownedUpgrades, [id]: true },
      wallet: newWallet,
    });
    get().recomputeStats();
    return true;
  },
});
