import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import type { SkillId } from "../../features/skills/types";

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

// Stub: skill catalog + leveling logic land in task 1.2.
export const createSkillsSlice: StateCreator<FullState, [], [], SkillsSlice> = () => ({
  skillLevels: { ...INITIAL_SKILL_LEVELS },
  levelSkill: () => false,
  skillCost: () => Infinity,
});
