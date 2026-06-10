export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Picks a key at random, weighted by its value. All weights must be >= 0
// and sum to > 0.
export function weightedPick<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [key, weight] of entries) {
    if (roll < weight) return key;
    roll -= weight;
  }
  return entries[entries.length - 1][0];
}
