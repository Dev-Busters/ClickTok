import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import { SKILL_CATALOG } from "../../features/skills/catalog";
import type { SkillId } from "../../features/skills/types";
import { track } from "../../lib/telemetry";

export type SkillsSlice = {
  skillLevels: Record<SkillId, number>;     // default all 0
  levelSkill: (id: SkillId) => boolean;     // false if maxed/can't afford/locked
  skillCost: (id: SkillId) => number;       // cost of next level
};

const INITIAL_SKILL_LEVELS: Record<SkillId, number> = {
  charisma: 0,
  editing: 0,
  stagecraft: 0,
  monetization: 0,
  network: 0,
};

export const createSkillsSlice: StateCreator<FullState, [], [], SkillsSlice> = (set, get) => ({
  skillLevels: { ...INITIAL_SKILL_LEVELS },

  skillCost: (id) => {
    const def = SKILL_CATALOG.find(s => s.id === id);
    if (!def) return Infinity;
    const level = get().skillLevels[id];
    if (level >= def.maxLevel) return Infinity;
    return Math.round(def.baseCost * Math.pow(def.costGrowth, level));
  },

  levelSkill: (id) => {
    const def = SKILL_CATALOG.find(s => s.id === id);
    if (!def) return false;
    const { skillLevels, wallet } = get();
    const level = skillLevels[id];
    if (level >= def.maxLevel) return false;
    if (def.requires?.followers !== undefined && wallet.followers < def.requires.followers) return false;

    const cost = Math.round(def.baseCost * Math.pow(def.costGrowth, level));
    if (wallet.coins < cost) return false;

    set({
      skillLevels: { ...skillLevels, [id]: level + 1 },
      wallet: { ...wallet, coins: wallet.coins - cost },
    });
    get().recomputeStats();
    track('upgrade_purchased', { id, category: 'skill', level: level + 1, coins: cost, handle: get().handle });
    return true;
  },
});
