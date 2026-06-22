import { BALANCE } from "../economy/balance";
import type { OnboardingGoalDef } from "./types";

export const ONBOARDING_GOALS: readonly OnboardingGoalDef[] = [
  { id: "meet_teb", label: `REACH ${BALANCE.onboarding.firstGoalFollowers} FOLLOWERS`, benefit: "Add a second green timing zone", requirement: { kind: "total_followers", amount: BALANCE.onboarding.firstGoalFollowers }, reveals: "pulse_modifier", teachId: "pulse_modifier_first_place" },
  { id: "unlock_studio", label: `REACH ${BALANCE.onboarding.studioFollowers} FOLLOWERS`, benefit: "Open Creator Studio", requirement: { kind: "total_followers", amount: BALANCE.onboarding.studioFollowers }, reward: { coins: BALANCE.onboarding.goalCoins.unlockStudio }, reveals: "creator_studio", teachId: "studio_first_use" },
  { id: "buy_audience_reach", label: "BUY AUDIENCE REACH", benefit: "Make green hits give more followers", requirement: { kind: "upgrade_level", id: "audience_reach", amount: 1 } },
  { id: "reach_700", label: "REACH 700 FOLLOWERS", benefit: "Earn your next upgrade", requirement: { kind: "total_followers", amount: BALANCE.onboarding.minorFollowerGoal1 }, reward: { coins: BALANCE.onboarding.goalCoins.reach700 } },
  { id: "own_three_fyp_levels", label: "OWN 3 FYP LEVELS", benefit: "Build your tap engine", requirement: { kind: "total_opening_upgrade_levels", amount: 3 }, reward: { coins: BALANCE.onboarding.goalCoins.ownThreeFypLevels } },
  { id: "reach_1200", label: "REACH 1,200 FOLLOWERS", benefit: "Fund your final setup", requirement: { kind: "total_followers", amount: BALANCE.onboarding.minorFollowerGoal2 }, reward: { coins: BALANCE.onboarding.goalCoins.reach1200 } },
  { id: "unlock_rhythm", label: "REACH 2,400 FOLLOWERS", benefit: "Unlock TAP THREE", requirement: { kind: "total_followers", amount: BALANCE.onboarding.rhythmFollowers }, reveals: "engagement_meter", teachId: "rhythm_first_hold" },
  { id: "complete_first_rhythm", label: "COMPLETE TAP THREE", benefit: "Make Coins repeatably", requirement: { kind: "rhythm_completions", sequenceId: "tap_three", amount: 1 } },
];
