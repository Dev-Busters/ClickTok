import { BALANCE } from "./balance";
import type { UpgradeEffect } from "../upgrades/types";

// 09 §A: the four derived stats a purchase can move (channelSlice.recomputeStats).
export type CoreStats = {
  tapPower: number;
  multiplier: number;
  followerConversion: number;
  passiveCoinsPerSec: number;
};

export type StatKind = "postPower" | "followerConversion" | "passiveCoins" | "multiplier";

export type StatFlash = {
  label: string;
  before: number;
  after: number;
  pct: number; // signed percent change
};

const LABEL: Record<StatKind, string> = {
  postPower: "coins/tap",
  followerConversion: "followers/tap",
  passiveCoins: "coins/sec",
  multiplier: "multiplier",
};

function coinsPerTap(s: CoreStats): number {
  return s.tapPower * BALANCE.postCoinConversion * s.multiplier;
}
function followersPerTap(s: CoreStats): number {
  return s.tapPower * BALANCE.postFollowerConversion * s.followerConversion * s.multiplier;
}

// 09 §A2: which single headline stat a purchase's effect should flash.
// One stat per buy — postPower buys read as "coins/tap", per §A4's "headline stat" rule.
export function effectStatKind(effect: UpgradeEffect): StatKind | null {
  if (effect.postPowerAdd || effect.postPowerMult) return "postPower";
  if (effect.followerConversionAdd) return "followerConversion";
  if (effect.passiveCoinsAdd) return "passiveCoins";
  if (effect.multiplierMult) return "multiplier";
  return null;
}

// 09 §A4: honest %, never shown if the stat didn't actually move.
export function computeStatFlash(kind: StatKind, before: CoreStats, after: CoreStats): StatFlash | null {
  let b: number, a: number;
  switch (kind) {
    case "postPower":          b = coinsPerTap(before);          a = coinsPerTap(after);          break;
    case "followerConversion": b = followersPerTap(before);      a = followersPerTap(after);       break;
    case "passiveCoins":       b = before.passiveCoinsPerSec;    a = after.passiveCoinsPerSec;     break;
    case "multiplier":         b = before.multiplier;            a = after.multiplier;              break;
  }
  if (Math.abs(a - b) < 1e-9) return null;
  const pct = b === 0 ? 100 : ((a - b) / b) * 100;
  return { label: LABEL[kind], before: b, after: a, pct };
}
