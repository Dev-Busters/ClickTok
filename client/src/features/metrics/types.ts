import type { Currency } from "../economy/types";

export type MetricStatId = "views" | "followers" | "likes" | "streams" | "coinsEarned";

export type MetricDef = {
  id: string;
  stat: MetricStatId;
  threshold: number;
  reward: Partial<Record<Currency, number>>;
  unlocks?: string;
};
