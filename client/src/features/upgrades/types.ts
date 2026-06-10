import type { Currency } from "../economy/types";
import type { ReactionId } from "../livestream/types";

export type UpgradeCategory = "gear" | "software";

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
  name: string;
  description: string;            // human copy; can be templated from effect
  cost: Partial<Record<Currency, number>>; // usually { coins } or { coins, diamonds }
  requires?: { followers?: number; upgrades?: string[] }; // unlock gating
  effect: UpgradeEffect;
};
