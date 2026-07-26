import type { StateCreator } from "zustand";
import { viralityUpgradeCost } from "../../features/virality/catalog";
import type { ViralityUpgradeId } from "../../features/virality/types";
import { track } from "../../lib/telemetry";
import type { FullState } from "../index";

/**
 * The Viral Lab's owned levels (docs/18).
 *
 * Deliberately its own slice rather than more fields on the onboarding slice: Virality
 * is a standalone economy with its own currency, its own shop, and room to grow well
 * past the opening chapter. The onboarding slice *reads* these levels when it resolves
 * letter spawns and VIRAL payouts, but it doesn't own them.
 */
export type ViralitySlice = {
  viralityUpgradeLevels: Record<ViralityUpgradeId, number>;
  levelViralityUpgrade: (id: ViralityUpgradeId) => boolean;
};

export const FRESH_VIRALITY_LEVELS: Record<ViralityUpgradeId, number> = {
  letter_rate: 0,
  viral_duration: 0,
  letter_dwell: 0,
  viral_mult: 0,
  virality_yield: 0,
};

export const createViralitySlice: StateCreator<FullState, [], [], ViralitySlice> = (set, get) => ({
  viralityUpgradeLevels: { ...FRESH_VIRALITY_LEVELS },

  levelViralityUpgrade: id => {
    const state = get();
    const level = state.viralityUpgradeLevels[id];
    const cost = viralityUpgradeCost(id, level);
    if (state.wallet.virality < cost) return false;
    set({
      wallet: { ...state.wallet, virality: state.wallet.virality - cost },
      viralityUpgradeLevels: { ...state.viralityUpgradeLevels, [id]: level + 1 },
      statPulseAt: Date.now(),
    });
    track("virality_upgrade_purchase", { id, level: level + 1, cost });
    return true;
  },
});
