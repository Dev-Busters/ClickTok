import type { FeedBoostId } from "../../party/types";

export type BoostDef = {
  id: FeedBoostId;
  icon: string;
  name: string;
  effectLine: string;
  // Which currency the multiplier applies to (or special)
  currency: "coins" | "followers" | "likes" | "all" | "hype";
};

export const BOOST_CATALOG: Record<FeedBoostId, BoostDef> = {
  coin_surge: {
    id: "coin_surge",
    icon: "🪙",
    name: "COIN SURGE",
    effectLine: "+50% coins per tap",
    currency: "coins",
  },
  fan_magnet: {
    id: "fan_magnet",
    icon: "🎯",
    name: "FAN MAGNET",
    effectLine: "+50% followers per tap",
    currency: "followers",
  },
  like_storm: {
    id: "like_storm",
    icon: "❤️",
    name: "LIKE STORM",
    effectLine: "×2 likes per tap",
    currency: "likes",
  },
  lucky_taps: {
    id: "lucky_taps",
    icon: "🍀",
    name: "LUCKY TAPS",
    effectLine: "8% chance ×10 all",
    currency: "all",
  },
  hype_seed: {
    id: "hype_seed",
    icon: "⚡",
    name: "HYPE SEED",
    effectLine: "Every 50 taps → +5 run hype",
    currency: "hype",
  },
};

export const BOOST_IDS: FeedBoostId[] = Object.keys(BOOST_CATALOG) as FeedBoostId[];
