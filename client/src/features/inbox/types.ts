// 3.2: Inbox notification types — not specced in 03 (no Notification/Inbox
// type there), so defined locally per the boons.ts/choices.ts precedent.
export type NotificationType = "run_result" | "milestone" | "daily_reward";

export type InboxNotification = {
  id: string;
  type: NotificationType;
  createdAt: number; // ms epoch
  title: string;
  body: string;
};
