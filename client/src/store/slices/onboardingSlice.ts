import type { StateCreator } from "zustand";
import { BALANCE } from "../../features/economy/balance";
import { canClaimCreatorStudioAnalytics, canClaimPulseModifierAnalytics, goalById, nextGoal, resolvableGoal, engagementPerTap, openingPulseAngle, openingPulseHit, openingPulseReward, openingUpgradeCost, isOpeningEngagementAvailable, isOpeningPulseModifierPlacementValid, normalizePulseAngle, OPENING_PULSE_CYCLE_MS, OPENING_PULSE_ZONE_COST, type OpeningPulseDirection, type OpeningPulseEventKey, type OpeningPulseHit } from "../../features/onboarding/helpers";
import { ONBOARDING_REVISION, type OnboardingReveal, type OnboardingStepId, type OpeningPulseModifier, type OpeningPulseModifierId, type OpeningPulseModifierKind, type OpeningUpgradeId } from "../../features/onboarding/types";
import { track } from "../../lib/telemetry";
import type { FullState } from "../index";

export type OnboardingSlice = {
  onboardingRevision: typeof ONBOARDING_REVISION;
  onboardingStep: OnboardingStepId;
  completedOnboardingGoals: OnboardingStepId[];
  activeOnboardingReveal: OnboardingReveal | null;
  onboardingTeachesSeen: Record<string, true>;
  openingUpgradeLevels: Record<OpeningUpgradeId, number>;
  openingPulseModifiers: OpeningPulseModifier[];
  openingPulseDirection: OpeningPulseDirection;
  openingPulseOffsetDeg: number;
  openingPulsePassiveArmed: boolean;
  openingPulsePassiveTarget: OpeningPulseEventKey | null;
  engagementFill: number;
  tapThreeCompletions: number;
  onboardingStepStartedAt: number;
  checkOnboardingGoal: () => void;
  acknowledgeOnboardingReveal: () => void;
  completeOnboardingTeach: (teachId: string) => void;
  openingTap: (now?: number) => number;
  updateOpeningPulsePassive: (now?: number) => void;
  openOpeningAnalytics: () => boolean;
  claimPulseModifierAnalytics: () => boolean;
  claimCreatorStudioAnalytics: () => boolean;
  levelOpeningUpgrade: (id: OpeningUpgradeId) => boolean;
  setOpeningPulseModifier: (id: OpeningPulseModifierId, kind: OpeningPulseModifierKind, centerDeg: number) => boolean;
  addEngagement: (amount: number) => void;
  consumeEngagementForRhythm: () => boolean;
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

function pulseOffsetForAngle(now: number, direction: OpeningPulseDirection, angle: number): number {
  return normalizePulseAngle(angle - (now % OPENING_PULSE_CYCLE_MS) / OPENING_PULSE_CYCLE_MS * 360 * direction);
}

function resolvePassiveState(state: FullState, now: number): {
  hit: OpeningPulseHit;
  passiveArmed: boolean;
  passiveTarget: OpeningPulseEventKey | null;
} {
  const hit = openingPulseHit(now, state.openingPulseModifiers, state.openingPulseDirection, state.openingPulseOffsetDeg);
  let passiveArmed = state.openingPulsePassiveArmed;
  let passiveTarget = state.openingPulsePassiveTarget;

  if (hit.zone === "passive" && hit.modifier?.kind === "passive") {
    passiveArmed = true;
    passiveTarget = null;
  } else if (passiveArmed) {
    if (passiveTarget === null && hit.eventKey) {
      passiveTarget = hit.eventKey;
    } else if (passiveTarget !== null && hit.eventKey !== passiveTarget) {
      passiveArmed = false;
      passiveTarget = null;
    }
  }

  return { hit, passiveArmed, passiveTarget };
}

export const createOnboardingSlice: StateCreator<FullState, [], [], OnboardingSlice> = (set, get) => ({
  onboardingRevision: ONBOARDING_REVISION,
  onboardingStep: "meet_teb",
  completedOnboardingGoals: [],
  activeOnboardingReveal: null,
  onboardingTeachesSeen: {},
  openingUpgradeLevels: { audience_reach: 0, engagement_rate: 0 },
  openingPulseModifiers: [],
  openingPulseDirection: 1,
  openingPulseOffsetDeg: 0,
  openingPulsePassiveArmed: false,
  openingPulsePassiveTarget: null,
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

  openingTap: (now = Date.now()) => {
    const state = get();
    if (state.session) return 0;
    const { hit, passiveArmed, passiveTarget } = resolvePassiveState(state, now);
    const passiveBonus = passiveArmed && passiveTarget !== null && hit.eventKey === passiveTarget;
    const followers = openingPulseReward(state.openingUpgradeLevels.audience_reach, hit, passiveBonus);
    const engagementAvailable = isOpeningEngagementAvailable(state.completedOnboardingGoals);
    const engagement = engagementAvailable ? engagementPerTap(state.openingUpgradeLevels.engagement_rate) : 0;
    const nextDirection: OpeningPulseDirection = hit.zone === "blue" && followers > 0 ? (state.openingPulseDirection === 1 ? -1 : 1) : state.openingPulseDirection;
    const currentAngle = openingPulseAngle(now, state.openingPulseDirection, state.openingPulseOffsetDeg);
    set({
      wallet: { ...state.wallet, followers: state.wallet.followers + followers, totalFollowers: state.wallet.totalFollowers + followers },
      viewsTotal: state.viewsTotal + 1,
      lastTapAt: now,
      engagementFill: Math.min(BALANCE.onboarding.engagement.cap, state.engagementFill + engagement),
      openingPulseDirection: nextDirection,
      openingPulseOffsetDeg: nextDirection === state.openingPulseDirection ? state.openingPulseOffsetDeg : pulseOffsetForAngle(now, nextDirection, currentAngle),
      openingPulsePassiveArmed: passiveBonus ? false : passiveArmed,
      openingPulsePassiveTarget: passiveBonus ? null : passiveTarget,
      onboardingTeachesSeen: hit.zone === "green" && !state.onboardingTeachesSeen.pulse_timing_first_perfect
        ? { ...state.onboardingTeachesSeen, pulse_timing_first_perfect: true }
        : state.onboardingTeachesSeen,
    });
    if (state.engagementFill < BALANCE.onboarding.engagement.cap && state.engagementFill + engagement >= BALANCE.onboarding.engagement.cap) {
      track("onboarding_engagement_filled");
    }
    get().checkOnboardingGoal();
    return followers;
  },

  updateOpeningPulsePassive: (now = Date.now()) => {
    const state = get();
    const { passiveArmed, passiveTarget } = resolvePassiveState(state, now);
    if (state.openingPulsePassiveArmed === passiveArmed && state.openingPulsePassiveTarget === passiveTarget) return;
    set({ openingPulsePassiveArmed: passiveArmed, openingPulsePassiveTarget: passiveTarget });
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

  claimPulseModifierAnalytics: () => {
    const state = get();
    if (!canClaimPulseModifierAnalytics(state.onboardingStep, state.completedOnboardingGoals, state.wallet.totalFollowers)) return false;
    const goal = goalById("meet_teb");
    const gold = goal.reward?.coins ?? 0;
    set({
      completedOnboardingGoals: [...state.completedOnboardingGoals, "meet_teb"],
      activeOnboardingReveal: { feature: "pulse_modifier", shownAt: Date.now(), dismissed: false },
      wallet: { ...state.wallet, coins: state.wallet.coins + gold },
      coinsEarned: state.coinsEarned + gold,
      openingPulseModifiers: state.openingPulseModifiers,
      activeTab: "home",
    });
    track("analytics_unlock_claimed", { id: "teb_editor", type: "feature", rewardGold: gold });
    track("onboarding_goal_complete", { goal: "meet_teb", durationMs: Date.now() - state.onboardingStepStartedAt });
    track("onboarding_reveal_shown", { feature: "pulse_modifier" });
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
    if (id === "engagement_rate" && audienceLevel < 1) return false;
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

  setOpeningPulseModifier: (id, kind, centerDeg) => {
    const state = get();
    if (!state.completedOnboardingGoals.includes("meet_teb")) return false;
    const normalized = normalizePulseAngle(centerDeg);
    if (!isOpeningPulseModifierPlacementValid(normalized, state.openingPulseModifiers, id, kind)) return false;
    const exists = state.openingPulseModifiers.some(modifier => modifier.id === id);
    if (!exists && state.wallet.coins < OPENING_PULSE_ZONE_COST) return false;
    const openingPulseModifiers = exists
      ? state.openingPulseModifiers.map(modifier => modifier.id === id ? { ...modifier, kind, centerDeg: normalized } : modifier)
      : [...state.openingPulseModifiers, { id, kind, centerDeg: normalized }];
    set({
      openingPulseModifiers,
      wallet: exists ? state.wallet : { ...state.wallet, coins: state.wallet.coins - OPENING_PULSE_ZONE_COST },
    });
    track("onboarding_pulse_modifier_placed", { id, kind, centerDeg: Math.round(normalized), cost: exists ? 0 : OPENING_PULSE_ZONE_COST });
    return true;
  },

  addEngagement: amount => set(state => ({ engagementFill: Math.min(BALANCE.onboarding.engagement.cap, Math.max(0, state.engagementFill + amount)) })),
  consumeEngagementForRhythm: () => {
    const state = get();
    if (state.engagementFill < BALANCE.onboarding.engagement.cap || state.session) return false;
    set({ engagementFill: 0 });
    track("onboarding_engagement_consumed");
    return true;
  },

  resetOnboardingRevision: () => set(state => ({
    onboardingRevision: ONBOARDING_REVISION,
    onboardingStep: "meet_teb",
    completedOnboardingGoals: [],
    activeOnboardingReveal: null,
    onboardingTeachesSeen: {},
    openingUpgradeLevels: { audience_reach: 0, engagement_rate: 0 },
    openingPulseModifiers: [],
    openingPulseDirection: 1,
    openingPulseOffsetDeg: 0,
    openingPulsePassiveArmed: false,
    openingPulsePassiveTarget: null,
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
