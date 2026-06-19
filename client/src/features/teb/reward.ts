import { BALANCE } from "../economy/balance";
import { viralMult } from "../feed/mods";

export type RhythmRewardInput = {
  chargeQuality: number; performanceQuality: number; completion: number; maxRhythmCombo: number;
  feedCombo: number; viralUntil: number; tapPower: number; multiplier: number; followerConversion: number; now?: number;
};

export function computeRhythmReward(input: RhythmRewardInput) {
  const r = BALANCE.teb.rhythm;
  const chargeMult = BALANCE.teb.chargeMultMin + (BALANCE.teb.chargeMultMax - BALANCE.teb.chargeMultMin) * input.chargeQuality;
  const performanceMult = r.performanceMultMin + (r.performanceMultMax - r.performanceMultMin) * input.performanceQuality;
  const rhythmComboMult = 1 + Math.min(input.maxRhythmCombo, r.rhythmComboCap) * r.rhythmComboPerHit;
  const feedComboMult = 1 + Math.min(input.feedCombo, BALANCE.feed.comboCap) * BALANCE.feed.comboPerTap;
  const k = r.rhythmBasePayout * chargeMult * performanceMult * input.completion * rhythmComboMult * feedComboMult * viralMult(input.viralUntil, input.now);
  return {
    coins: input.tapPower * BALANCE.postCoinConversion * input.multiplier * k,
    followers: input.tapPower * BALANCE.postFollowerConversion * input.followerConversion * input.multiplier * k,
    likes: input.tapPower * BALANCE.postLikeConversion * input.multiplier * k,
    k,
  };
}
