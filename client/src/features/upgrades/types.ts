import type { Currency } from "../economy/types";
import type { ReactionId } from "../livestream/types";

export type UpgradeCategory = "gear" | "software" | "repeatable";
export type UpgradePillar = "viewer" | "posting" | "live";

export type UpgradeEffect = {
  postPowerAdd?: number;
  postPowerMult?: number;
  passiveCoinsAdd?: number;       // +coins/sec
  multiplierMult?: number;        // ×global multiplier
  followerConversionAdd?: number; // +conversion factor
  // Run-stat bonuses (consumed by the meta→run bridge; see 04):
  runStartViewersAdd?: number;
  runStartViewersMult?: number;
  runGiftRateMult?: number;
  runTrollResistAdd?: number;     // 0..1 chance/effectiveness vs trolls
  unlocksReaction?: ReactionId;   // buying this unlocks a hotbar reaction
};

export type UpgradeDef = {
  id: string;
  category: UpgradeCategory;
  pillar: UpgradePillar;
  name: string;
  description: string;            // human copy; can be templated from effect
  effect: UpgradeEffect;
  requires?: { followers?: number; upgrades?: string[] }; // unlock gating
  // One-time purchase (present iff repeatable is absent):
  cost?: Partial<Record<Currency, number>>; // usually { coins } or { coins, diamonds }
  // Repeatable/leveled (all three present iff repeatable: true — see 01 §10.4):
  repeatable?: true;
  baseCost?: Partial<Record<Currency, number>>; // cost at level 0 (first buy)
  costGrowth?: number;                          // cost(L) = round(baseCost × costGrowth^L)
  maxLevel?: number;                            // if absent, unlimited
};
