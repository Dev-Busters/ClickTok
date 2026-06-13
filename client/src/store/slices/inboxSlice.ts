import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import type { InboxNotification, NotificationType } from "../../features/inbox/types";
import { computeDailyReward, isNewCalendarDay } from "../../features/inbox/daily";
import { METRIC_CATALOG } from "../../features/metrics/catalog";
import type { MetricStatId } from "../../features/metrics/types";
import { formatCount } from "../../lib/format";

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

export type InboxSlice = {
  notifications: InboxNotification[];
  lastDailyClaimAt: number | null;
  metricsReached: string[];

  pushNotification: (n: { type: NotificationType; title: string; body: string }) => void;
  checkMetrics: () => void;
  claimDailyReward: () => void;
};

export const createInboxSlice: StateCreator<FullState, [], [], InboxSlice> = (set, get) => ({
  notifications: [],
  lastDailyClaimAt: null,
  metricsReached: [],

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

    for (const m of newly) {
      const rewardParts: string[] = [];
      if (m.reward.coins) rewardParts.push(`+${formatCount(m.reward.coins)} 🪙`);
      if (m.reward.diamonds) rewardParts.push(`+${formatCount(m.reward.diamonds)} 💎`);
      get().pushNotification({
        type: "milestone",
        title: metricNotifTitle(m.stat, m.threshold),
        body: rewardParts.join(" · "),
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
