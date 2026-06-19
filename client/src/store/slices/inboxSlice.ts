import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import type { InboxNotification, NotificationType } from "../../features/inbox/types";
import { computeDailyReward, isNewCalendarDay } from "../../features/inbox/daily";
import { METRIC_CATALOG } from "../../features/metrics/catalog";
import { isFeatureUnlocked, featureLabel } from "../../features/metrics/unlocks";
import type { MetricStatId } from "../../features/metrics/types";
import { UPGRADE_CATALOG } from "../../features/upgrades/catalog";
import type { UpgradePillar } from "../../features/upgrades/types";
import { SKILL_CATALOG, SKILL_PILLAR } from "../../features/skills/catalog";
import { ELEMENT_CATALOG } from "../../features/elements/catalog";
import { formatCount } from "../../lib/format";
import { pushCelebration } from "../../components/fx/CelebrationLayer";
import { BALANCE } from "../../features/economy/balance";
import { track } from "../../lib/telemetry";

const ELEMENT_IDS = new Set<string>(ELEMENT_CATALOG.map(d => d.id));

const MAX_NOTIFICATIONS = 50;

function getStatValue(
  stat: MetricStatId,
  state: { viewsTotal: number; wallet: FullState["wallet"]; coinsEarned: number; streams: number },
): number {
  switch (stat) {
    case "views": return state.viewsTotal;
    case "followers": return state.wallet.totalFollowers;
    case "likes": return state.wallet.likes;
    case "streams": return state.streams;
    case "coinsEarned": return state.coinsEarned;
  }
}

function metricNotifTitle(stat: MetricStatId, threshold: number): string {
  const n = formatCount(threshold);
  switch (stat) {
    case "views":      return `${n} Views reached!`;
    case "followers":  return `${n} Followers!`;
    case "likes":      return `${n} Likes reached!`;
    case "streams":    return threshold === 1 ? "First stream completed!" : `${n} Streams completed!`;
    case "coinsEarned": return `${n} Coins earned!`;
  }
}

// Returns which unlocked Studio pillars have at least one affordable, unpurchased upgrade.
function computeAffordablePillars(state: FullState): UpgradePillar[] {
  const { wallet, ownedUpgrades, upgradeLevels, skillLevels, ownedElements, metricsReached } = state;
  const result: UpgradePillar[] = [];

  const pillars: UpgradePillar[] = ["viewer", "posting", "live"];
  for (const pillar of pillars) {
    if (!isFeatureUnlocked(pillar, metricsReached)) continue;

    let found = false;

    // Repeatable (leveled) upgrades
    for (const def of UPGRADE_CATALOG) {
      if (!def.repeatable || def.pillar !== pillar) continue;
      const level = upgradeLevels[def.id] ?? 0;
      if (def.maxLevel !== undefined && level >= def.maxLevel) continue;
      if (!def.baseCost || def.costGrowth === undefined) continue;
      const cost = Math.round((def.baseCost.coins ?? 0) * Math.pow(def.costGrowth, level));
      if (cost > 0 && wallet.coins >= cost) { found = true; break; }
    }

    if (!found) {
      // One-time gear/software
      for (const def of UPGRADE_CATALOG) {
        if (def.repeatable || def.pillar !== pillar) continue;
        if (ownedUpgrades[def.id]) continue;
        if (def.requires?.upgrades && !def.requires.upgrades.every(id => ownedUpgrades[id])) continue;
        if (def.requires?.followers !== undefined && wallet.followers < def.requires.followers) continue;
        const coinsCost = def.cost?.coins ?? 0;
        const diamondsCost = def.cost?.diamonds ?? 0;
        if (wallet.coins >= coinsCost && wallet.diamonds >= diamondsCost) { found = true; break; }
      }
    }

    if (!found) {
      // Skills
      for (const def of SKILL_CATALOG) {
        if (SKILL_PILLAR[def.id] !== pillar) continue;
        const level = (skillLevels as Record<string, number>)[def.id] ?? 0;
        if (level >= def.maxLevel) continue;
        if (def.requires?.followers !== undefined && wallet.followers < def.requires.followers) continue;
        const cost = Math.round(def.baseCost * Math.pow(def.costGrowth, level));
        if (wallet.coins >= cost) { found = true; break; }
      }
    }

    if (!found && pillar === "viewer") {
      // Elements (viewer pillar only)
      for (const def of ELEMENT_CATALOG) {
        if (ownedElements[def.id]) continue;
        if (wallet.followers < def.requires.followers) continue;
        if (wallet.coins >= def.requires.coins) { found = true; break; }
      }
    }

    if (found) result.push(pillar);
  }

  return result;
}

export type InboxSlice = {
  notifications: InboxNotification[];
  lastDailyClaimAt: number | null;
  metricsReached: string[];
  affordableNotifiedPillars: string[];  // persisted; dedup set for affordable-upgrade alerts
  affordablePillars: UpgradePillar[];   // not persisted; derived in tick for badge rendering

  pushNotification: (n: { type: NotificationType; title: string; body: string }) => void;
  checkMetrics: () => void;
  checkAffordableUpgrades: () => void;
  claimDailyReward: () => void;
};

export const createInboxSlice: StateCreator<FullState, [], [], InboxSlice> = (set, get) => ({
  notifications: [],
  lastDailyClaimAt: null,
  metricsReached: [],
  affordableNotifiedPillars: [],
  affordablePillars: [],

  pushNotification: ({ type, title, body }) => {
    const { notifications } = get();
    const notification: InboxNotification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      createdAt: Date.now(),
      title,
      body,
    };
    set({ notifications: [notification, ...notifications].slice(0, MAX_NOTIFICATIONS) });
  },

  // 9.2: check all metrics in the catalog; grant rewards + notify once per crossing.
  checkMetrics: () => {
    const { metricsReached, wallet, viewsTotal, coinsEarned, streams } = get();
    const statCtx = { viewsTotal, wallet, coinsEarned, streams };

    const newly = METRIC_CATALOG.filter(
      m => getStatValue(m.stat, statCtx) >= m.threshold && !metricsReached.includes(m.id),
    );
    if (newly.length === 0) return;

    let coinsDelta = 0;
    let diamondsDelta = 0;
    for (const m of newly) {
      coinsDelta += m.reward.coins ?? 0;
      diamondsDelta += m.reward.diamonds ?? 0;
    }

    set({
      metricsReached: [...metricsReached, ...newly.map(m => m.id)],
      wallet: {
        ...wallet,
        coins: wallet.coins + coinsDelta,
        diamonds: wallet.diamonds + diamondsDelta,
      },
    });

    const { handle } = get();
    for (const m of newly) {
      track('milestone_reached', { milestone: m.id, stat: m.stat, threshold: m.threshold, handle });
      const rewardParts: string[] = [];
      if (m.reward.coins) rewardParts.push(`+${formatCount(m.reward.coins)} 🪙`);
      if (m.reward.diamonds) rewardParts.push(`+${formatCount(m.reward.diamonds)} 💎`);
      get().pushNotification({
        type: "milestone",
        title: metricNotifTitle(m.stat, m.threshold),
        body: rewardParts.join(" · "),
      });

      // 12.2 (08 §B): celebration popup on every feature unlock.
      if (m.unlocks) {
        if (m.unlocks === "element_stage") {
          set({ tebReadyAt: Date.now() + BALANCE.teb.cooldownSec * 1000 });
        }
        if (ELEMENT_IDS.has(m.unlocks)) {
          pushCelebration({
            icon: "🔓",
            label: `${featureLabel(m.unlocks)} UNLOCKED`,
            sublabel: "NEW ELEMENT",
            color: "var(--gold)",
          });
        } else {
          pushCelebration({
            icon: "✨",
            label: `${featureLabel(m.unlocks)} UNLOCKED`,
            sublabel: "NEW FEATURE",
            color: "var(--cyan)",
          });
        }
      }
    }
  },

  // 10.2: called every tick; updates affordablePillars badge state and fires
  // ONE notification per pillar the first time it gains an affordable upgrade.
  checkAffordableUpgrades: () => {
    const state = get();
    const newAffordable = computeAffordablePillars(state);

    // Badge state update (skip set if unchanged to avoid spurious re-renders)
    const current = state.affordablePillars;
    if (newAffordable.join(',') !== current.join(',')) {
      set({ affordablePillars: newAffordable });
    }

    // Notification dedup: fire once per pillar that first enters the affordable set
    const { affordableNotifiedPillars } = state;
    const toNotify = newAffordable.filter(p => !affordableNotifiedPillars.includes(p));
    if (toNotify.length === 0) return;

    set({ affordableNotifiedPillars: [...affordableNotifiedPillars, ...toNotify] });

    for (const pillar of toNotify) {
      const label = pillar === "viewer" ? "STUDIO" : pillar === "posting" ? "POSTING" : "LIVE";
      get().pushNotification({
        type: "milestone",
        title: `New upgrade ready — ${label}`,
        body: `Open Creator Studio → ${label} to level up.`,
      });
      // 10.5: quick affordable-alert celebration
      pushCelebration({
        icon: "⚡",
        label: `${label} UPGRADE READY`,
        sublabel: "CREATOR STUDIO",
        color: "var(--cyan)",
      });
    }
  },

  // 3.2: once per real-world calendar day, grants base coins + a small
  // multiple of current passive income (magnitudes: features/inbox/daily.ts).
  claimDailyReward: () => {
    const { lastDailyClaimAt, passiveCoinsPerSec, wallet } = get();
    const now = Date.now();
    if (!isNewCalendarDay(lastDailyClaimAt, now)) return;

    const coins = computeDailyReward(passiveCoinsPerSec);
    set({
      wallet: { ...wallet, coins: wallet.coins + coins },
      lastDailyClaimAt: now,
    });
    get().pushNotification({
      type: "daily_reward",
      title: "Daily reward claimed",
      body: `+${formatCount(coins)} coins for logging in today.`,
    });
  },
});
