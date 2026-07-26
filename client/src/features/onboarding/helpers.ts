import { BALANCE } from "../economy/balance";
import { ONBOARDING_GOALS } from "./catalog";
import { viralMultiplier } from "../virality/catalog";
import type { GoalRequirement, OnboardingFeatureId, OnboardingStepId, OpeningUpgradeId } from "./types";

export type OnboardingProgress = {
  viewsTotal: number;
  totalFollowers: number;
  openingUpgradeLevels: Record<OpeningUpgradeId, number>;
  tapThreeCompletions: number;
};

export function goalById(id: OnboardingStepId) {
  return ONBOARDING_GOALS.find(goal => goal.id === id) ?? ONBOARDING_GOALS[0];
}

export function nextGoal(id: OnboardingStepId): OnboardingStepId | null {
  const index = ONBOARDING_GOALS.findIndex(goal => goal.id === id);
  return ONBOARDING_GOALS[index + 1]?.id ?? null;
}

export function requirementValue(requirement: GoalRequirement, progress: OnboardingProgress): { current: number; target: number } {
  switch (requirement.kind) {
    case "tap_count": return { current: progress.viewsTotal, target: requirement.amount };
    case "total_followers": return { current: progress.totalFollowers, target: requirement.amount };
    case "upgrade_level": return { current: progress.openingUpgradeLevels[requirement.id], target: requirement.amount };
    case "total_opening_upgrade_levels": return { current: Object.values(progress.openingUpgradeLevels).reduce((sum, level) => sum + level, 0), target: requirement.amount };
    case "rhythm_completions": return { current: progress.tapThreeCompletions, target: requirement.amount };
    case "acknowledge_reveal": return { current: 0, target: 1 };
  }
}

export function requirementMet(requirement: GoalRequirement, progress: OnboardingProgress): boolean {
  const { current, target } = requirementValue(requirement, progress);
  return current >= target;
}

export function resolvableGoal(step: OnboardingStepId, completed: readonly OnboardingStepId[], blocked: boolean, progress: OnboardingProgress): OnboardingStepId | null {
  if (blocked || completed.includes(step) || step === "meet_teb" || step === "unlock_studio") return null;
  const goal = goalById(step);
  return requirementMet(goal.requirement, progress) ? goal.id : null;
}

export function canClaimCreatorStudioAnalytics(step: OnboardingStepId, completed: readonly OnboardingStepId[], totalFollowers: number): boolean {
  return step === "unlock_studio" && !completed.includes("unlock_studio") && totalFollowers >= BALANCE.onboarding.studioFollowers;
}

export function canClaimShoutOutAnalytics(step: OnboardingStepId, completed: readonly OnboardingStepId[], totalFollowers: number): boolean {
  return step === "meet_teb" && !completed.includes("meet_teb") && totalFollowers >= BALANCE.onboarding.firstGoalFollowers;
}

export function isOnboardingFeatureAvailable(feature: OnboardingFeatureId, completed: readonly OnboardingStepId[]): boolean {
  return ONBOARDING_GOALS.some(goal => goal.reveals === feature && completed.includes(goal.id));
}

export function isOpeningEngagementAvailable(completed: readonly OnboardingStepId[]): boolean {
  return completed.includes("buy_audience_reach");
}

export function openingFollowerAmount(level: number): number {
  return Math.max(1, Math.round(1 + level * BALANCE.onboarding.audienceReach.followerAmountAddPerLevel));
}

export function engagementPerTap(level: number): number {
  return BALANCE.onboarding.engagement.baseFillPerTap + level * BALANCE.onboarding.engagementRate.fillAddPerLevel;
}

// Raid Squad (13 §upgrade-taxonomy): passive followers/sec — the incremental-genre
// "something is always happening" layer. Ticked in channelSlice.tick while onboarding.
export function raidFollowersPerSec(level: number): number {
  return level * BALANCE.onboarding.raidSquad.followersPerSecPerLevel;
}

export function openingUpgradeCost(id: OpeningUpgradeId, level: number): number {
  const def = BALANCE.onboarding[id === "audience_reach" ? "audienceReach" : id === "engagement_rate" ? "engagementRate" : "raidSquad"];
  return Math.round(def.baseCost * Math.pow(def.costGrowth, level));
}

// Anti-autoclicker (see design discussion): taps registered faster than this are
// silently ignored — no gain, no combo, no goal progress. No legitimate human taps
// this fast for a sustained stretch, so it's invisible at real speed but makes a
// macro/autoclicker worthless (spamming nets the same as tapping right at the cap).
export function isRateLimited(lastTapAt: number, now: number): boolean {
  return lastTapAt !== 0 && now - lastTapAt < BALANCE.onboarding.minTapIntervalMs;
}

// Onboarding tap combo — builds per tap, decays while idle (see decayOpeningCombo).
export function openingComboMult(combo: number): number {
  return 1 + Math.min(combo, BALANCE.onboarding.combo.cap) * BALANCE.onboarding.combo.perTap;
}

export function isOpeningViral(viralUntil: number, now: number): boolean {
  return viralUntil > now;
}

/**
 * `multLevel` is the Viral Lab's PEAK REACH level (docs/18 §3) — pass 0 for the
 * un-upgraded ×2 baseline.
 */
export function openingViralMult(viralUntil: number, now: number, multLevel = 0): number {
  return isOpeningViral(viralUntil, now) ? viralMultiplier(multLevel) : 1;
}

export function rollShoutOut(): boolean {
  return Math.random() < BALANCE.onboarding.shoutOut.chance;
}
