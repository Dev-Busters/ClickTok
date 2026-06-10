export type SkillId = "charisma" | "editing" | "stagecraft" | "monetization" | "network";

export type SkillDef = {
  id: SkillId;
  name: string;
  description: string;
  maxLevel: number;
  // cost of NEXT level = baseCost * costGrowth^currentLevel (coins), see 04
  baseCost: number;
  costGrowth: number;
  requires?: { followers?: number };
};
