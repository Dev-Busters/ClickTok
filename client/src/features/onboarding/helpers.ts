import { BALANCE } from "../economy/balance";
import { ONBOARDING_GOALS } from "./catalog";
import type { GoalRequirement, OnboardingFeatureId, OnboardingStepId, OpeningPulseModifier, OpeningPulseModifierId, OpeningUpgradeId } from "./types";

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

export function canClaimPulseModifierAnalytics(step: OnboardingStepId, completed: readonly OnboardingStepId[], totalFollowers: number): boolean {
  return step === "meet_teb" && !completed.includes("meet_teb") && totalFollowers >= BALANCE.onboarding.firstGoalFollowers;
}

export function isOnboardingFeatureAvailable(feature: OnboardingFeatureId, completed: readonly OnboardingStepId[]): boolean {
  return ONBOARDING_GOALS.some(goal => goal.reveals === feature && completed.includes(goal.id));
}

export function isOpeningEngagementAvailable(completed: readonly OnboardingStepId[]): boolean {
  return completed.includes("buy_audience_reach");
}

export const OPENING_PULSE_CYCLE_MS = 1800;
export const OPENING_PULSE_GREEN_DEG = 48;
export const OPENING_PULSE_EVENT_DEG = 48;
export const OPENING_PULSE_PASSIVE_DEG = 34;
export const OPENING_PULSE_MODIFIER_DEFAULT_DEG = 180;
export const OPENING_PULSE_MODIFIER_GAP_DEG = 4;
export const OPENING_PULSE_ZONE_COST = 5;
export type OpeningPulseDirection = 1 | -1;
export type OpeningPulseZone = "green" | "blue" | "passive" | "red";
export type OpeningPulseEventKey = "base_green" | OpeningPulseModifierId;
export type OpeningPulseHit = {
  zone: OpeningPulseZone;
  eventKey: OpeningPulseEventKey | null;
  modifier: OpeningPulseModifier | null;
};

export function openingFollowerAmount(level: number): number {
  return Math.max(1, Math.round(1 + level * BALANCE.onboarding.audienceReach.followerAmountAddPerLevel));
}

export function openingPulseProgress(now: number = Date.now(), direction: OpeningPulseDirection = 1, offsetDeg = 0): number {
  return normalizePulseAngle((now % OPENING_PULSE_CYCLE_MS) / OPENING_PULSE_CYCLE_MS * 360 * direction + offsetDeg) / 360;
}

export function openingPulseAngle(now: number = Date.now(), direction: OpeningPulseDirection = 1, offsetDeg = 0): number {
  return openingPulseProgress(now, direction, offsetDeg) * 360;
}

export function normalizePulseAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export function pulseAngleDistance(a: number, b: number): number {
  const distance = Math.abs(normalizePulseAngle(a) - normalizePulseAngle(b));
  return Math.min(distance, 360 - distance);
}

export function openingPulseModifierWidth(modifier: Pick<OpeningPulseModifier, "kind">): number {
  return modifier.kind === "event" ? OPENING_PULSE_EVENT_DEG : OPENING_PULSE_PASSIVE_DEG;
}

export function openingPulseModifierLabel(id: OpeningPulseModifierId): string {
  return id === "blue_event_1" ? "BLUE EVENT ZONE" : "PASSIVE BOOST ZONE";
}

export function isOpeningPulseModifierPlacementValid(
  centerDeg: number,
  modifiers: readonly OpeningPulseModifier[],
  editingId: OpeningPulseModifierId,
  editingKind: OpeningPulseModifier["kind"] = modifiers.find(modifier => modifier.id === editingId)?.kind ?? "event",
): boolean {
  const center = normalizePulseAngle(centerDeg);
  const baseOccupiedHalfWidth = OPENING_PULSE_GREEN_DEG / 2;
  const modifierHalfWidth = openingPulseModifierWidth({ kind: editingKind }) / 2;
  if (pulseAngleDistance(center, 0) < baseOccupiedHalfWidth + modifierHalfWidth + OPENING_PULSE_MODIFIER_GAP_DEG) return false;
  return modifiers
    .filter(modifier => modifier.id !== editingId)
    .every(modifier => pulseAngleDistance(center, modifier.centerDeg) >= modifierHalfWidth + openingPulseModifierWidth(modifier) / 2 + OPENING_PULSE_MODIFIER_GAP_DEG);
}

export function openingPulseHitAtAngle(angle: number, modifiers: readonly OpeningPulseModifier[] = []): OpeningPulseHit {
  for (const modifier of modifiers) {
    const distance = pulseAngleDistance(angle, modifier.centerDeg);
    if (distance <= openingPulseModifierWidth(modifier) / 2) {
      return {
        zone: modifier.kind === "event" ? "blue" : "passive",
        eventKey: modifier.kind === "event" ? modifier.id : null,
        modifier,
      };
    }
  }
  const distanceFromTop = pulseAngleDistance(angle, 0);
  if (distanceFromTop <= OPENING_PULSE_GREEN_DEG / 2) return { zone: "green", eventKey: "base_green", modifier: null };
  return { zone: "red", eventKey: null, modifier: null };
}

export function openingPulseHit(now: number = Date.now(), modifiers: readonly OpeningPulseModifier[] = [], direction: OpeningPulseDirection = 1, offsetDeg = 0): OpeningPulseHit {
  return openingPulseHitAtAngle(openingPulseAngle(now, direction, offsetDeg), modifiers);
}

export function openingPulseZone(now: number = Date.now(), modifiers: readonly OpeningPulseModifier[] = [], direction: OpeningPulseDirection = 1, offsetDeg = 0): OpeningPulseZone {
  return openingPulseHit(now, modifiers, direction, offsetDeg).zone;
}

export function openingPulseReward(level: number, hit: OpeningPulseZone | OpeningPulseHit, passiveBonus = false): number {
  const zone = typeof hit === "string" ? hit : hit.zone;
  const amount = openingFollowerAmount(level);
  if (zone === "green") return amount + (passiveBonus ? 1 : 0);
  if (zone === "blue") return 2 + (passiveBonus ? 1 : 0);
  return 0;
}

export function rollOpeningFollowers(level: number, now: number = Date.now(), modifiers: readonly OpeningPulseModifier[] = [], direction: OpeningPulseDirection = 1, offsetDeg = 0): number {
  return openingPulseReward(level, openingPulseHit(now, modifiers, direction, offsetDeg));
}

export function openingFollowersPerTap(level: number, modifiers: readonly OpeningPulseModifier[] = []): number {
  const baseShare = OPENING_PULSE_GREEN_DEG / 360;
  const eventShare = modifiers
    .filter(modifier => modifier.kind === "event")
    .reduce((sum, modifier) => sum + openingPulseModifierWidth(modifier) / 360, 0);
  return openingPulseReward(level, "green") * baseShare
    + openingPulseReward(level, "blue") * eventShare;
}

export function engagementPerTap(level: number): number {
  return BALANCE.onboarding.engagement.baseFillPerTap + level * BALANCE.onboarding.engagementRate.fillAddPerLevel;
}

export function openingUpgradeCost(id: OpeningUpgradeId, level: number): number {
  const def = BALANCE.onboarding[id === "audience_reach" ? "audienceReach" : "engagementRate"];
  return Math.round(def.baseCost * Math.pow(def.costGrowth, level));
}
