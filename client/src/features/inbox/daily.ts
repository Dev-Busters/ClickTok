// 3.2: daily login reward — not specced in 04. A flat base plus a small
// multiple of current passive coin income, claimable once per real
// calendar day (per user decision: "Coins, scaled by passiveCoinsPerSec").
export const DAILY_REWARD_BASE_COINS = 100;
export const DAILY_REWARD_PASSIVE_SECONDS = 300; // ~5 minutes of passive coins

export function computeDailyReward(passiveCoinsPerSec: number): number {
  return Math.round(DAILY_REWARD_BASE_COINS + passiveCoinsPerSec * DAILY_REWARD_PASSIVE_SECONDS);
}

export function isNewCalendarDay(lastClaimAt: number | null, now: number): boolean {
  if (lastClaimAt === null) return true;
  return new Date(lastClaimAt).toDateString() !== new Date(now).toDateString();
}
