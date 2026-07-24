import type { StateCreator } from "zustand";
import { BALANCE } from "../../features/economy/balance";
import { canClaimCreatorStudioAnalytics, canClaimShoutOutAnalytics, goalById, nextGoal, resolvableGoal, engagementPerTap, isRateLimited, openingComboMult, openingFollowerAmount, openingUpgradeCost, isOpeningEngagementAvailable, isOnboardingFeatureAvailable, raidFollowersPerSec, rollShoutOut, withinOpeningComboWindow } from "../../features/onboarding/helpers";
import { ONBOARDING_REVISION, type OnboardingReveal, type OnboardingStepId, type OpeningUpgradeId } from "../../features/onboarding/types";
import { track } from "../../lib/telemetry";
import type { FullState } from "../index";

export type OpeningTapResult = { followers: number; shoutOut: boolean; combo: number; momentumBonus: number };

export type OnboardingSlice = {
  onboardingRevision: typeof ONBOARDING_REVISION;
  onboardingStep: OnboardingStepId;
  completedOnboardingGoals: OnboardingStepId[];
  activeOnboardingReveal: OnboardingReveal | null;
  onboardingTeachesSeen: Record<string, true>;
  openingUpgradeLevels: Record<OpeningUpgradeId, number>;
  openingCombo: number;
  openingLastTapAt: number;
  engagementFill: number;
  tapThreeCompletions: number;
  onboardingStepStartedAt: number;
  checkOnboardingGoal: () => void;
  acknowledgeOnboardingReveal: () => void;
  completeOnboardingTeach: (teachId: string) => void;
  openingTap: (now?: number) => OpeningTapResult;
  tickOpeningRaid: (dt: number) => void;
  openOpeningAnalytics: () => boolean;
  claimShoutOutAnalytics: () => boolean;
  claimCreatorStudioAnalytics: () => boolean;
  levelOpeningUpgrade: (id: OpeningUpgradeId) => boolean;
  addEngagement: (amount: number) => void;
  resetOnboardingRevision: () => void;
};

function progress(state: FullState) {
  return {
    viewsTotal: state.viewsTotal,
    totalFollowers: state.wallet.totalFollowers,
    openingUpgradeLevels: state.openingUpgradeLevels,
    tapThreeCompletions: state.tapThreeCompletions,
  };
}

function advance(set: (patch: Partial<FullState>) => void, get: () => FullState): void {
  const state = get();
  const next = nextGoal(state.onboardingStep);
  if (next) {
    set({ onboardingStep: next, onboardingStepStartedAt: Date.now() });
    track("onboarding_goal_start", { goal: next });
  }
}

export const createOnboardingSlice: StateCreator<FullState, [], [], OnboardingSlice> = (set, get) => ({
  onboardingRevision: ONBOARDING_REVISION,
  onboardingStep: "meet_teb",
  completedOnboardingGoals: [],
  activeOnboardingReveal: null,
  onboardingTeachesSeen: {},
  openingUpgradeLevels: { audience_reach: 0, engagement_rate: 0, raid_squad: 0 },
  openingCombo: 0,
  openingLastTapAt: 0,
  engagementFill: 0,
  tapThreeCompletions: 0,
  onboardingStepStartedAt: Date.now(),

  checkOnboardingGoal: () => {
    const state = get();
    if (!resolvableGoal(state.onboardingStep, state.completedOnboardingGoals, state.activeOnboardingReveal !== null, progress(state))) return;
    const goal = goalById(state.onboardingStep);
    const coins = goal.reward?.coins ?? 0;
    const reveal = goal.reveals ? { feature: goal.reveals, shownAt: Date.now(), dismissed: false } : null;
    set({
      completedOnboardingGoals: [...state.completedOnboardingGoals, goal.id],
      wallet: { ...state.wallet, coins: state.wallet.coins + coins },
      coinsEarned: state.coinsEarned + coins,
      activeOnboardingReveal: reveal,
    });
    track("onboarding_goal_complete", { goal: goal.id, durationMs: Date.now() - state.onboardingStepStartedAt });
    if (goal.reveals) track("onboarding_reveal_shown", { feature: goal.reveals });
    if (!reveal) advance(set, get);
  },

  acknowledgeOnboardingReveal: () => {
    const reveal = get().activeOnboardingReveal;
    if (!reveal) return;
    set({ activeOnboardingReveal: { ...reveal, dismissed: true } });
    track("onboarding_reveal_acknowledged", { feature: reveal.feature });
  },

  completeOnboardingTeach: teachId => {
    const state = get();
    const goal = goalById(state.onboardingStep);
    if (goal.teachId !== teachId || !state.completedOnboardingGoals.includes(goal.id)) return;
    set({ onboardingTeachesSeen: { ...state.onboardingTeachesSeen, [teachId]: true }, activeOnboardingReveal: null });
    track("onboarding_feature_first_use", { teachId });
    advance(set, get);
    queueMicrotask(() => get().checkOnboardingGoal());
  },

  // Every tap always hits — no timing/placement check. Combo heat (short window,
  // decays fast) plus a random Shout-Out bonus supply the excitement instead.
  openingTap: (now = Date.now()) => {
    const state = get();
    const blocked: OpeningTapResult = { followers: 0, shoutOut: false, combo: state.openingCombo, momentumBonus: 0 };
    if (state.session) return blocked;
    if (isRateLimited(state.openingLastTapAt, now)) return blocked; // anti-autoclicker: silent no-op

    const combo = withinOpeningComboWindow(state.openingLastTapAt, now) ? state.openingCombo + 1 : 0;
    const shoutOutActive = isOnboardingFeatureAvailable("shout_out", state.completedOnboardingGoals);
    const shoutOut = shoutOutActive && rollShoutOut();
    const base = openingFollowerAmount(state.openingUpgradeLevels.audience_reach);
    const followers = Math.max(1, Math.round(base * openingComboMult(combo) * (shoutOut ? BALANCE.onboarding.shoutOut.mult : 1)));

    // Momentum: fills every tap; at full it auto-fires a bonus and resets on the spot —
    // an active, repeating heartbeat rather than a one-time gate that just sits full.
    const momentumAvailable = isOpeningEngagementAvailable(state.completedOnboardingGoals);
    const momentumPerTap = momentumAvailable ? engagementPerTap(state.openingUpgradeLevels.engagement_rate) : 0;
    const cap = BALANCE.onboarding.engagement.cap;
    const filledFill = state.engagementFill + momentumPerTap;
    const momentumFired = momentumPerTap > 0 && filledFill >= cap;
    // Bonus scales with this tap's own combo-boosted gain, so a sustained streak pays bigger.
    const momentumBonus = momentumFired ? Math.round(followers * BALANCE.onboarding.engagement.bonusMult) : 0;
    const nextFill = momentumFired ? Math.min(cap, filledFill - cap) : filledFill;
    const totalFollowerGain = followers + momentumBonus;

    set({
      wallet: { ...state.wallet, followers: state.wallet.followers + totalFollowerGain, totalFollowers: state.wallet.totalFollowers + totalFollowerGain },
      viewsTotal: state.viewsTotal + 1,
      lastTapAt: now,
      openingLastTapAt: now,
      openingCombo: combo,
      engagementFill: nextFill,
    });
    if (momentumFired) track("onboarding_momentum_fired", { bonus: momentumBonus });
    get().checkOnboardingGoal();
    return { followers, shoutOut, combo, momentumBonus };
  },

  // Raid Squad passive income — ticks while onboarding is active (see channelSlice.tick).
  tickOpeningRaid: (dt) => {
    const state = get();
    const level = state.openingUpgradeLevels.raid_squad;
    if (!level) return;
    const gain = raidFollowersPerSec(level) * dt;
    if (gain <= 0) return;
    set({ wallet: { ...state.wallet, followers: state.wallet.followers + gain, totalFollowers: state.wallet.totalFollowers + gain } });
  },

  openOpeningAnalytics: () => {
    const state = get();
    if (state.onboardingTeachesSeen.legacy_preserved !== true && state.wallet.totalFollowers < BALANCE.onboarding.analyticsFollowers) return false;
    set({
      activeTab: "inbox",
      onboardingTeachesSeen: state.onboardingTeachesSeen.analytics_first_open
        ? state.onboardingTeachesSeen
        : { ...state.onboardingTeachesSeen, analytics_first_open: true },
    });
    if (!state.onboardingTeachesSeen.analytics_first_open) track("onboarding_feature_first_use", { teachId: "analytics_first_open" });
    return true;
  },

  claimShoutOutAnalytics: () => {
    const state = get();
    if (!canClaimShoutOutAnalytics(state.onboardingStep, state.completedOnboardingGoals, state.wallet.totalFollowers)) return false;
    const goal = goalById("meet_teb");
    const gold = goal.reward?.coins ?? 0;
    set({
      completedOnboardingGoals: [...state.completedOnboardingGoals, "meet_teb"],
      activeOnboardingReveal: { feature: "shout_out", shownAt: Date.now(), dismissed: false },
      wallet: { ...state.wallet, coins: state.wallet.coins + gold },
      coinsEarned: state.coinsEarned + gold,
      activeTab: "home",
    });
    track("analytics_unlock_claimed", { id: "shout_out", type: "feature", rewardGold: gold });
    track("onboarding_goal_complete", { goal: "meet_teb", durationMs: Date.now() - state.onboardingStepStartedAt });
    track("onboarding_reveal_shown", { feature: "shout_out" });
    return true;
  },

  claimCreatorStudioAnalytics: () => {
    const state = get();
    const goal = goalById("unlock_studio");
    if (!canClaimCreatorStudioAnalytics(state.onboardingStep, state.completedOnboardingGoals, state.wallet.totalFollowers)) return false;
    const gold = goal.reward?.coins ?? 0;
    set({
      completedOnboardingGoals: [...state.completedOnboardingGoals, "unlock_studio"],
      wallet: { ...state.wallet, coins: state.wallet.coins + gold },
      coinsEarned: state.coinsEarned + gold,
      onboardingTeachesSeen: { ...state.onboardingTeachesSeen, studio_first_use: true },
      activeOnboardingReveal: null,
    });
    track("analytics_unlock_claimed", { id: "creator_studio", type: "feature", rewardGold: gold });
    track("onboarding_goal_complete", { goal: "unlock_studio", durationMs: Date.now() - state.onboardingStepStartedAt });
    advance(set, get);
    queueMicrotask(() => get().checkOnboardingGoal());
    return true;
  },

  levelOpeningUpgrade: id => {
    const state = get();
    const audienceLevel = state.openingUpgradeLevels.audience_reach;
    const engagementLevel = state.openingUpgradeLevels.engagement_rate;
    if (id === "engagement_rate" && audienceLevel < 1) return false;
    if (id === "raid_squad" && engagementLevel < 1) return false;
    const level = state.openingUpgradeLevels[id];
    const cost = openingUpgradeCost(id, level);
    if (state.wallet.coins < cost) return false;
    set({
      wallet: { ...state.wallet, coins: state.wallet.coins - cost },
      openingUpgradeLevels: { ...state.openingUpgradeLevels, [id]: level + 1 },
      statPulseAt: Date.now(),
    });
    track("onboarding_upgrade_purchase", { id, level: level + 1, cost });
    get().checkOnboardingGoal();
    return true;
  },

  addEngagement: amount => set(state => ({ engagementFill: Math.min(BALANCE.onboarding.engagement.cap, Math.max(0, state.engagementFill + amount)) })),

  resetOnboardingRevision: () => set(state => ({
    onboardingRevision: ONBOARDING_REVISION,
    onboardingStep: "meet_teb",
    completedOnboardingGoals: [],
    activeOnboardingReveal: null,
    onboardingTeachesSeen: {},
    openingUpgradeLevels: { audience_reach: 0, engagement_rate: 0, raid_squad: 0 },
    openingCombo: 0,
    openingLastTapAt: 0,
    engagementFill: 0,
    tapThreeCompletions: 0,
    onboardingStepStartedAt: Date.now(),
    wallet: { followers: 0, totalFollowers: 0, coins: 0, diamonds: 0, likes: 0 },
    viewsTotal: 0,
    coinsEarned: 0,
    metricsReached: [],
    session: null,
    tebReadyAt: 0,
    openSheet: null,
    activeTab: "home",
    reducedFeedback: state.reducedFeedback,
    rhythmMuted: state.rhythmMuted,
  })),
});
