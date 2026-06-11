// 01 §5.5: post-run "1 of 3" boon pick on a successful run. `04` doesn't spec
// boon ids/magnitudes — these are implementation choices.
export type BoonId = "diamond_cache" | "hype_carryover" | "algorithm_favor";

export type BoonDef = {
  id: BoonId;
  name: string;
  description: string;
};

export const BOON_DIAMOND_CACHE_AMOUNT = 8;
export const BOON_HYPE_CARRYOVER_BONUS = 30; // next run starts at 50+30 = 80 hype
export const BOON_ALGORITHM_FAVOR_MULT = 1.05; // permanent +5% to post/passive income

export const BOON_CATALOG: Record<BoonId, BoonDef> = {
  diamond_cache: {
    id: "diamond_cache",
    name: "Diamond Cache",
    description: `+${BOON_DIAMOND_CACHE_AMOUNT} 💎 right now`,
  },
  hype_carryover: {
    id: "hype_carryover",
    name: "Hype Carryover",
    description: "Next stream starts at 80 hype",
  },
  algorithm_favor: {
    id: "algorithm_favor",
    name: "Algorithm Favor",
    description: "Permanent +5% to post & passive income",
  },
};

export const BOON_LIST: BoonDef[] = [
  BOON_CATALOG.diamond_cache,
  BOON_CATALOG.hype_carryover,
  BOON_CATALOG.algorithm_favor,
];
