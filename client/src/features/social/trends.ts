export type TrendInfo = { topic: string; heat: number };

export const TREND_POOL = [
  "dancing", "cooking", "gaming", "comedy", "fitness",
  "fashion", "music", "lifehacks", "pets", "trending",
];

export const TRENDS_SHOWN = 5;

// "Locally rotating" trends (no server authority yet — that's Phase 4.1):
// pick a random subset of the pool with a fresh `heat` (0..1) each rotation.
// 04 §6: topicMatch = 1 + heat*0.5, so heat 0..1 → up to +50% viewers.
export function generateTrends(rng: () => number = Math.random): TrendInfo[] {
  const pool = [...TREND_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, TRENDS_SHOWN).map(topic => ({ topic, heat: rng() }));
}

export function getTrendHeat(trends: TrendInfo[], topic: string | null): number {
  if (!topic) return 0;
  return trends.find(t => t.topic === topic)?.heat ?? 0;
}
