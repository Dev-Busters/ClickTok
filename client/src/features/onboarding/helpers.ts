import { BALANCE } from "../economy/balance";
import { ONBOARDING_GOALS } from "./catalog";
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
  if (blocked || completed.includes(step)) return null;
  const goal = goalById(step);
  return requirementMet(goal.requirement, progress) ? goal.id : null;
}

export function isOnboardingFeatureAvailable(feature: OnboardingFeatureId, completed: readonly OnboardingStepId[]): boolean {
  return ONBOARDING_GOALS.some(goal => goal.reveals === feature && completed.includes(goal.id));
}

export function followerChance(level: number): number {
  return Math.min(1, BALANCE.onboarding.baseFollowerChance + level * BALANCE.onboarding.audienceReach.followerChanceAddPerLevel);
}

export function rollOpeningFollower(level: number, random: () => number = Math.random): number {
  return random() < followerChance(level) ? 1 : 0;
}

export function engagementPerTap(level: number): number {
  return BALANCE.onboarding.engagement.baseFillPerTap + level * BALANCE.onboarding.engagementRate.fillAddPerLevel;
}

export function openingUpgradeCost(id: OpeningUpgradeId, level: number): number {
  const def = BALANCE.onboarding[id === "audience_reach" ? "audienceReach" : "engagementRate"];
  return Math.round(def.baseCost * Math.pow(def.costGrowth, level));
}
