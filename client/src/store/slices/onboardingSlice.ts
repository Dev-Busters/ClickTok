import type { StateCreator } from "zustand";
import { BALANCE } from "../../features/economy/balance";
import { canClaimCreatorStudioAnalytics, canClaimShoutOutAnalytics, goalById, nextGoal, resolvableGoal, engagementPerTap, isRateLimited, openingComboMult, openingFollowerAmount, openingUpgradeCost, openingViralMult, isOpeningEngagementAvailable, isOnboardingFeatureAvailable, raidFollowersPerSec, rollShoutOut } from "../../features/onboarding/helpers";
import { availableBubbleKinds, makeBubble, nextSpawnDelay, type Bubble, type BubbleKind } from "../../features/onboarding/bubbles";
import { momentumBonusById, resolveMomentumBonus, rollMomentumBonus, type MomentumBonusId, type MomentumBonusResult } from "../../features/onboarding/momentumBonuses";
import { computeIntegritySignals, pushSample, type IntegritySignals, type TapSample } from "../../features/integrity/signals";
import { ONBOARDING_REVISION, type OnboardingReveal, type OnboardingStepId, type OpeningUpgradeId } from "../../features/onboarding/types";
import { track } from "../../lib/telemetry";
import type { FullState } from "../index";

export type OpeningTapResult = {
  followers: number;
  shoutOut: boolean;
  combo: number;
  viralStarted: boolean;
  /** Followers paid by a Momentum fill this tap (0 if it didn't fill). */
  momentumBonus: number;
  /** Which bonus rolled, if the bar filled. */
  bonus: MomentumBonusResult | null;
};

export type BubblePopResult = { kind: BubbleKind; followers: number; coins: number } | null;

// Monotonic bubble id — ephemeral, never persisted (the feed is rebuilt each session).
let nextBubbleId = 1;

export type OnboardingSlice = {
  onboardingRevision: typeof ONBOARDING_REVISION;
  onboardingStep: OnboardingStepId;
  completedOnboardingGoals: OnboardingStepId[];
  activeOnboardingReveal: OnboardingReveal | null;
  onboardingTeachesSeen: Record<string, true>;
  openingUpgradeLevels: Record<OpeningUpgradeId, number>;
  unlockedMomentumBonuses: MomentumBonusId[];
  openingCombo: number;
  openingLastTapAt: number;
  openingViralUntil: number;
  openingBubbles: Bubble[];
  openingNextSpawnAt: number;
  /** Wall-clock rate limiter for Momentum fill (see engagement.maxFillPerSec). */
  openingFillWindowStart: number;
  openingFillInWindow: number;
  /** Token bucket gating base follower payout (see tapPayout). */
  openingTapTokens: number;
  openingTokensAt: number;
  /** Armed by momentum bonuses. */
  openingDuetTaps: number;
  openingPushUntil: number;
  /** Rolling input-shape buffer — ephemeral, never persisted. */
  openingTapSamples: TapSample[];
  engagementFill: number;
  tapThreeCompletions: number;
  onboardingStepStartedAt: number;
  checkOnboardingGoal: () => void;
  acknowledgeOnboardingReveal: () => void;
  completeOnboardingTeach: (teachId: string) => void;
  openingTap: (now?: number, at?: { x: number; y: number }) => OpeningTapResult;
  tickOpeningRaid: (dt: number) => void;
  decayOpeningCombo: (dt: number) => void;
  tickOpeningBubbles: (now?: number) => void;
  popOpeningBubble: (id: number) => BubblePopResult;
  openOpeningAnalytics: () => boolean;
  claimShoutOutAnalytics: () => boolean;
  claimCreatorStudioAnalytics: () => boolean;
  levelOpeningUpgrade: (id: OpeningUpgradeId) => boolean;
  unlockMomentumBonus: (id: MomentumBonusId) => boolean;
  readIntegritySignals: () => IntegritySignals;
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
  unlockedMomentumBonuses: [],
  openingCombo: 0,
  openingLastTapAt: 0,
  openingViralUntil: 0,
  openingBubbles: [],
  openingNextSpawnAt: 0,
  openingFillWindowStart: 0,
  openingFillInWindow: 0,
  openingTapTokens: BALANCE.onboarding.tapPayout.capacity,
  openingTokensAt: 0,
  openingDuetTaps: 0,
  openingPushUntil: 0,
  openingTapSamples: [],
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

  // Every tap always hits — no timing/placement check. Combo heat (which decays while
  // idle), a random Shout-Out crit, and the VIRAL payoff supply the excitement instead.
  openingTap: (now = Date.now(), at) => {
    const state = get();
    const blocked: OpeningTapResult = { followers: 0, shoutOut: false, combo: state.openingCombo, viralStarted: false, momentumBonus: 0, bonus: null };
    if (state.session) return blocked;
    if (isRateLimited(state.openingLastTapAt, now)) return blocked; // anti-autoclicker: silent no-op

    const comboCap = BALANCE.onboarding.combo.cap;
    const wasViral = state.openingViralUntil > now;
    // While VIRAL the bar is pinned at cap; taps can't overfill and decay is paused.
    const combo = wasViral ? comboCap : Math.min(comboCap, Math.floor(state.openingCombo) + 1);
    // Filling the bar (not already viral) tips the video over.
    const viralStarted = !wasViral && combo >= comboCap;

    const pushActive = state.openingPushUntil > now;
    const shoutOutActive = isOnboardingFeatureAvailable("shout_out", state.completedOnboardingGoals);
    // ALGORITHM PUSH guarantees the crit for its window.
    const shoutOut = shoutOutActive && (pushActive || rollShoutOut());
    // Token bucket: sustained payout is capped at refillPerSec while `capacity` absorbs
    // human bursts. A macro drains the bucket in ~1s and then earns exactly what a
    // sustained human earns; honest tapping never touches the floor.
    const bucket = BALANCE.onboarding.tapPayout;
    const tokensElapsed = state.openingTokensAt === 0 ? 0 : (now - state.openingTokensAt) / 1000;
    const tokensAvailable = Math.min(bucket.capacity, state.openingTapTokens + tokensElapsed * bucket.refillPerSec);
    const paid = tokensAvailable >= 1;
    const tokensLeft = paid ? tokensAvailable - 1 : tokensAvailable;

    const base = openingFollowerAmount(state.openingUpgradeLevels.audience_reach);
    const viralMult = viralStarted || wasViral ? BALANCE.onboarding.viral.mult : 1;
    const duetMult = state.openingDuetTaps > 0 ? BALANCE.onboarding.momentumBonuses.duetMult : 1;
    const followers = paid
      ? Math.max(1, Math.round(
          base * openingComboMult(combo) * viralMult * duetMult * (shoutOut ? BALANCE.onboarding.shoutOut.mult : 1),
        ))
      : 0;

    // Momentum fill is rate-limited in WALL-CLOCK time, not per tap. Because the fill
    // drives the bonus — the dominant earner — this is what makes tapping faster than a
    // human worthless. Fair players never reach the ceiling; automation gains nothing.
    const momentumAvailable = isOpeningEngagementAvailable(state.completedOnboardingGoals);
    const rawPerTap = momentumAvailable ? engagementPerTap(state.openingUpgradeLevels.engagement_rate) : 0;
    const windowElapsed = now - state.openingFillWindowStart;
    const inNewWindow = state.openingFillWindowStart === 0 || windowElapsed >= 1000;
    const usedThisWindow = inNewWindow ? 0 : state.openingFillInWindow;
    const fillBudget = Math.max(0, BALANCE.onboarding.engagement.maxFillPerSec - usedThisWindow);
    const momentumPerTap = Math.min(rawPerTap, fillBudget);

    const cap = BALANCE.onboarding.engagement.cap;
    const filledFill = state.engagementFill + momentumPerTap;
    const momentumFired = momentumPerTap > 0 && filledFill >= cap;

    // Roll one of the unlocked bonuses instead of always paying the same burst.
    const bonus = momentumFired
      ? resolveMomentumBonus(rollMomentumBonus(state.unlockedMomentumBonuses), followers)
      : null;
    const nextFill = momentumFired ? Math.min(cap, filledFill - cap) : filledFill;
    const totalFollowerGain = followers + (bonus?.followers ?? 0);
    const coinGain = bonus?.coins ?? 0;

    set({
      wallet: {
        ...state.wallet,
        followers: state.wallet.followers + totalFollowerGain,
        totalFollowers: state.wallet.totalFollowers + totalFollowerGain,
        coins: state.wallet.coins + coinGain,
      },
      coinsEarned: state.coinsEarned + coinGain,
      viewsTotal: state.viewsTotal + 1,
      lastTapAt: now,
      openingLastTapAt: now,
      openingCombo: combo,
      engagementFill: nextFill,
      openingFillWindowStart: inNewWindow ? now : state.openingFillWindowStart,
      openingFillInWindow: usedThisWindow + momentumPerTap,
      openingTapTokens: tokensLeft,
      openingTokensAt: now,
      openingDuetTaps: bonus?.duetTaps ? bonus.duetTaps : Math.max(0, state.openingDuetTaps - 1),
      ...(bonus?.pushMs ? { openingPushUntil: now + bonus.pushMs } : {}),
      ...(viralStarted ? { openingViralUntil: now + BALANCE.onboarding.viral.durationMs } : {}),
      // Advisory input-shape evidence only — never used to gate rewards client-side.
      ...(at ? { openingTapSamples: pushSample(state.openingTapSamples, { at: now, x: at.x, y: at.y }) } : {}),
    });

    // COMMENT STORM drops its bubbles immediately so the payoff is visible at once.
    if (bonus?.spawnBubbles) {
      const kinds = availableBubbleKinds(get().completedOnboardingGoals);
      const spawned = Array.from({ length: bonus.spawnBubbles }, () => makeBubble(nextBubbleId++, kinds, now));
      set({ openingBubbles: [...get().openingBubbles, ...spawned] });
    }

    if (bonus) track("onboarding_momentum_fired", { bonus: bonus.id, followers: bonus.followers, coins: bonus.coins });
    if (viralStarted) track("onboarding_viral_started", { combo });
    get().checkOnboardingGoal();
    return { followers, shoutOut, combo, viralStarted, momentumBonus: bonus?.followers ?? 0, bonus };
  },

  unlockMomentumBonus: id => {
    const state = get();
    const def = momentumBonusById(id);
    if (def.cost === 0 || state.unlockedMomentumBonuses.includes(id)) return false;
    if (state.wallet.coins < def.cost) return false;
    set({
      wallet: { ...state.wallet, coins: state.wallet.coins - def.cost },
      unlockedMomentumBonuses: [...state.unlockedMomentumBonuses, id],
      statPulseAt: Date.now(),
    });
    track("onboarding_momentum_bonus_unlocked", { id, cost: def.cost });
    return true;
  },

  readIntegritySignals: () => computeIntegritySignals(get().openingTapSamples),

  // Combo bleeds off after a short grace period, so the bar reflects what the player is
  // doing right now instead of freezing at full forever (and VIRAL pauses the bleed).
  decayOpeningCombo: (dt) => {
    const { openingCombo, openingLastTapAt, openingViralUntil } = get();
    const now = Date.now();
    if (openingViralUntil > 0 && now >= openingViralUntil) {
      // VIRAL just ended — settle to a partial bar and resume normal decay.
      set({ openingCombo: BALANCE.onboarding.viral.exitCombo, openingViralUntil: 0, openingLastTapAt: now });
      return;
    }
    if (openingViralUntil > now) return;
    if (openingCombo <= 0) return;
    if (now - openingLastTapAt < BALANCE.onboarding.combo.decayDelayMs) return;
    set({ openingCombo: Math.max(0, openingCombo - BALANCE.onboarding.combo.decayPerSec * dt) });
  },

  // Spawns and expires the engagement feed. Haters that reach the top untapped take a
  // small bite out of followers — the only downside in the loop, and an avoidable one.
  tickOpeningBubbles: (now = Date.now()) => {
    const state = get();
    // The rhythm minigame owns the whole play area, and a full-screen sheet (Studio,
    // Video Studio) hides the feed entirely — in both cases stop the feed rather than
    // let unreachable haters quietly drain followers behind the overlay.
    if (state.session || state.openSheet !== null || state.activeTab !== "home") {
      if (state.openingBubbles.length) set({ openingBubbles: [], openingNextSpawnAt: 0 });
      return;
    }
    const b = BALANCE.onboarding.bubbles;
    let bubbles = state.openingBubbles;
    let followerLoss = 0;

    const expired = bubbles.filter(bubble => bubble.expiresAt <= now);
    if (expired.length) {
      for (const bubble of expired) {
        if (bubble.kind === "hater") followerLoss += state.wallet.followers * b.haterDrainPct;
      }
      bubbles = bubbles.filter(bubble => bubble.expiresAt > now);
    }

    const kinds = availableBubbleKinds(state.completedOnboardingGoals);
    const viral = state.openingViralUntil > now;
    const pushing = state.openingPushUntil > now;
    // VIRAL and ALGORITHM PUSH stack — a push landing mid-viral floods the feed.
    const rateMult = (viral ? BALANCE.onboarding.viral.spawnRateMult : 1)
      * (pushing ? BALANCE.onboarding.momentumBonuses.algorithmPushSpawnMult : 1);
    let nextSpawnAt = state.openingNextSpawnAt;
    if (nextSpawnAt === 0) {
      nextSpawnAt = now + nextSpawnDelay(rateMult);
    } else if (now >= nextSpawnAt) {
      if (bubbles.length < b.maxActive) {
        bubbles = [...bubbles, makeBubble(nextBubbleId++, kinds, now)];
      }
      nextSpawnAt = now + nextSpawnDelay(rateMult);
    }

    if (bubbles === state.openingBubbles && nextSpawnAt === state.openingNextSpawnAt && followerLoss === 0) return;
    set({
      openingBubbles: bubbles,
      openingNextSpawnAt: nextSpawnAt,
      ...(followerLoss > 0 ? {
        wallet: { ...state.wallet, followers: Math.max(0, state.wallet.followers - followerLoss) },
      } : {}),
    });
  },

  popOpeningBubble: (id) => {
    const state = get();
    const bubble = state.openingBubbles.find(item => item.id === id);
    if (!bubble) return null;
    const b = BALANCE.onboarding.bubbles;
    const now = Date.now();
    const base = openingFollowerAmount(state.openingUpgradeLevels.audience_reach);
    const viralMult = openingViralMult(state.openingViralUntil, now);

    let followers = 0;
    let coins = 0;
    let comboBonus = 0;
    let momentum = 0;
    switch (bubble.kind) {
      case "like":
        followers = Math.round(base * b.likeFollowerMult * viralMult);
        comboBonus = b.likeComboBonus;
        break;
      case "comment":
        followers = Math.round(base * b.commentFollowerMult * viralMult);
        momentum = b.commentMomentum;
        break;
      case "gift":
        coins = Math.round((b.giftCoins.min + Math.random() * (b.giftCoins.max - b.giftCoins.min)) * viralMult);
        break;
      case "hater":
        followers = Math.round(base * b.haterFollowerMult * viralMult);
        break;
    }

    const cap = BALANCE.onboarding.engagement.cap;
    set({
      openingBubbles: state.openingBubbles.filter(item => item.id !== id),
      wallet: {
        ...state.wallet,
        followers: state.wallet.followers + followers,
        totalFollowers: state.wallet.totalFollowers + followers,
        coins: state.wallet.coins + coins,
      },
      coinsEarned: state.coinsEarned + coins,
      ...(comboBonus ? {
        openingCombo: Math.min(BALANCE.onboarding.combo.cap, state.openingCombo + comboBonus),
        openingLastTapAt: now,
      } : {}),
      ...(momentum ? { engagementFill: Math.min(cap, state.engagementFill + momentum) } : {}),
    });
    track("onboarding_bubble_popped", { kind: bubble.kind, followers, coins });
    get().checkOnboardingGoal();
    return { kind: bubble.kind, followers, coins };
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
    unlockedMomentumBonuses: [],
    openingCombo: 0,
    openingLastTapAt: 0,
    openingViralUntil: 0,
    openingBubbles: [],
    openingNextSpawnAt: 0,
    openingFillWindowStart: 0,
    openingFillInWindow: 0,
    openingTapTokens: BALANCE.onboarding.tapPayout.capacity,
    openingTokensAt: 0,
    openingDuetTaps: 0,
    openingPushUntil: 0,
    openingTapSamples: [],
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
