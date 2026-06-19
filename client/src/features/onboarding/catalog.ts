import { BALANCE } from "../economy/balance";
import type { OnboardingGoalDef } from "./types";

export const ONBOARDING_GOALS: readonly OnboardingGoalDef[] = [
  { id: "meet_teb", label: "TAP TEB 10 TIMES", benefit: "Grow your first audience", requirement: { kind: "tap_count", amount: 10 } },
  { id: "unlock_studio", label: "REACH 400 FOLLOWERS", benefit: "Open Creator Studio", requirement: { kind: "total_followers", amount: BALANCE.onboarding.studioFollowers }, reward: { coins: BALANCE.onboarding.goalCoins.unlockStudio }, reveals: "creator_studio", teachId: "studio_first_use" },
  { id: "buy_audience_reach", label: "BUY AUDIENCE REACH", benefit: "Make every tap stronger", requirement: { kind: "upgrade_level", id: "audience_reach", amount: 1 }, reward: { coins: BALANCE.onboarding.goalCoins.buyAudienceReach } },
  { id: "reach_700", label: "REACH 700 FOLLOWERS", benefit: "Earn your next upgrade", requirement: { kind: "total_followers", amount: BALANCE.onboarding.minorFollowerGoal1 }, reward: { coins: BALANCE.onboarding.goalCoins.reach700 } },
  { id: "own_three_fyp_levels", label: "OWN 3 FYP LEVELS", benefit: "Build your tap engine", requirement: { kind: "total_opening_upgrade_levels", amount: 3 }, reward: { coins: BALANCE.onboarding.goalCoins.ownThreeFypLevels } },
  { id: "reach_1200", label: "REACH 1,200 FOLLOWERS", benefit: "Fund your final setup", requirement: { kind: "total_followers", amount: BALANCE.onboarding.minorFollowerGoal2 }, reward: { coins: BALANCE.onboarding.goalCoins.reach1200 } },
  { id: "unlock_rhythm", label: "REACH 2,400 FOLLOWERS", benefit: "Unlock TAP THREE", requirement: { kind: "total_followers", amount: BALANCE.onboarding.rhythmFollowers }, reveals: "engagement_meter", teachId: "rhythm_first_hold" },
  { id: "complete_first_rhythm", label: "COMPLETE TAP THREE", benefit: "Make Coins repeatably", requirement: { kind: "rhythm_completions", sequenceId: "tap_three", amount: 1 } },
  { id: "unlock_video_fyp", label: "REACH 10K FOLLOWERS", benefit: "Reveal your video FYP", requirement: { kind: "total_followers", amount: BALANCE.onboarding.videoFypFollowers }, reveals: "video_fyp", teachId: "video_fyp_first_action" },
];
