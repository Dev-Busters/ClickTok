import type { StateCreator } from "zustand";
import type { FullState } from "../index";
import type { InboxNotification, NotificationType } from "../../features/inbox/types";
import { computeDailyReward, isNewCalendarDay } from "../../features/inbox/daily";
import { FOLLOWER_MILESTONES } from "../../features/inbox/milestones";
import { formatCount } from "../../lib/format";

const MAX_NOTIFICATIONS = 50;

export type InboxSlice = {
  notifications: InboxNotification[];
  lastDailyClaimAt: number | null;
  milestonesReached: number[];

  pushNotification: (n: { type: NotificationType; title: string; body: string }) => void;
  checkMilestones: () => void;
  claimDailyReward: () => void;
};

export const createInboxSlice: StateCreator<FullState, [], [], InboxSlice> = (set, get) => ({
  notifications: [],
  lastDailyClaimAt: null,
  milestonesReached: [],

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

  // 3.2: notify once when totalFollowers crosses a fixed milestone threshold
  // (totalFollowers never decreases — see 03's Wallet type).
  checkMilestones: () => {
    const { wallet, milestonesReached } = get();
    const newly = FOLLOWER_MILESTONES.filter(
      m => wallet.totalFollowers >= m && !milestonesReached.includes(m),
    );
    if (newly.length === 0) return;

    for (const m of newly) {
      get().pushNotification({
        type: "milestone",
        title: `${formatCount(m)} followers!`,
        body: `Your channel just crossed ${formatCount(m)} total followers.`,
      });
    }
    set({ milestonesReached: [...milestonesReached, ...newly] });
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
