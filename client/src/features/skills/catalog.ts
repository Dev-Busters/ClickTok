import { BALANCE } from "../economy/balance";
import type { SkillDef } from "./types";
import type { UpgradePillar } from "../upgrades/types";

// Which pillar each skill belongs to (01 §11.1). Shared by SkillsPanel + affordability logic.
export const SKILL_PILLAR: Record<string, UpgradePillar> = {
  charisma:     "viewer",
  editing:      "viewer",
  stagecraft:   "live",
  monetization: "live",
  network:      "live",
};

// IDs are stable — see `04-economy-formulas.md` §5. Costs in coins.
export const SKILL_CATALOG: SkillDef[] = [
  {
    id: "charisma",
    name: "Charisma",
    description: "+1 post power; +5% LIVE start viewers; more viewer growth from hype",
    maxLevel: 20,
    baseCost: 80,
    costGrowth: BALANCE.skillCostGrowth,
  },
  {
    id: "editing",
    name: "Editing",
    description: "+0.05 follower conversion; bigger LIVE follower payout",
    maxLevel: 20,
    baseCost: 120,
    costGrowth: BALANCE.skillCostGrowth,
  },
  {
    id: "stagecraft",
    name: "Stagecraft",
    description: "-3% hype decay (max -70%); +20% hype-wave strength",
    maxLevel: 15,
    baseCost: 150,
    costGrowth: BALANCE.skillCostGrowth,
    requires: { followers: 1000 },
  },
  {
    id: "monetization",
    name: "Monetization",
    description: "+4% LIVE gift rate & gift value",
    maxLevel: 15,
    baseCost: 200,
    costGrowth: BALANCE.skillCostGrowth,
    requires: { followers: 5000 },
  },
  {
    id: "network",
    name: "Network",
    description: "Better raid/collab events (Phase 4: raid power)",
    maxLevel: 10,
    baseCost: 250,
    costGrowth: BALANCE.skillCostGrowth,
    requires: { followers: 25000 },
  },
];
