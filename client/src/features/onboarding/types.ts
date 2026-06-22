export const ONBOARDING_REVISION = 1 as const;

export type OnboardingStepId =
  | "meet_teb"
  | "unlock_studio"
  | "buy_audience_reach"
  | "reach_700"
  | "own_three_fyp_levels"
  | "reach_1200"
  | "unlock_rhythm"
  | "complete_first_rhythm"
  | "unlock_video_fyp";

export type OnboardingFeatureId =
  | "pulse_modifier"
  | "creator_studio"
  | "engagement_meter"
  | "tap_three"
  | "video_fyp";

export type OpeningUpgradeId = "audience_reach" | "engagement_rate";

export type OpeningPulseModifierId = "bonus_green_1";

export type OpeningPulseModifier = {
  id: OpeningPulseModifierId;
  centerDeg: number;
};

export type GoalRequirement =
  | { kind: "tap_count"; amount: number }
  | { kind: "total_followers"; amount: number }
  | { kind: "upgrade_level"; id: OpeningUpgradeId; amount: number }
  | { kind: "total_opening_upgrade_levels"; amount: number }
  | { kind: "rhythm_completions"; sequenceId: "tap_three"; amount: number }
  | { kind: "acknowledge_reveal"; feature: OnboardingFeatureId };

export type OnboardingGoalDef = {
  id: OnboardingStepId;
  label: string;
  benefit: string;
  requirement: GoalRequirement;
  reward?: { coins?: number };
  reveals?: OnboardingFeatureId;
  teachId?: string;
};

export type OnboardingReveal = {
  feature: OnboardingFeatureId;
  shownAt: number;
  dismissed: boolean;
};
