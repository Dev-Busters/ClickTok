import { METRIC_CATALOG } from "./catalog";
import type { MetricDef, MetricStatId } from "./types";

// Features that cascade from a pillar: if the pillar is reached, the feature is also unlocked.
// This lets old readers (isFeatureUnlocked("go_live", ...)) still work after the pillar rework.
const FEATURE_TO_PILLAR: Record<string, "viewer" | "posting" | "live"> = {
  viewer:     "viewer",
  upgrades:   "viewer",
  diamonds:   "viewer",
  feed_pager: "viewer",
  inbox:      "viewer",
  posting:    "posting",
  live:       "live",
  go_live:    "live",
  discover:   "live",
};

// Derives from metricsReached — no extra persisted set needed (01 §10.3).
export function isFeatureUnlocked(featureId: string, metricsReached: string[]): boolean {
  // Direct metric unlock
  if (METRIC_CATALOG.some(m => m.unlocks === featureId && metricsReached.includes(m.id))) return true;
  // Pillar cascade safety net
  const pillar = FEATURE_TO_PILLAR[featureId];
  if (pillar) {
    return METRIC_CATALOG.some(m => m.unlocks === pillar && metricsReached.includes(m.id));
  }
  return false;
}

export type UnlockStatCtx = {
  viewsTotal: number;
  totalFollowers: number;
  streams: number;
  coinsEarned: number;
};

function statCurrentValue(stat: MetricStatId, ctx: UnlockStatCtx): number {
  switch (stat) {
    case "views":       return ctx.viewsTotal;
    case "followers":   return ctx.totalFollowers;
    case "streams":     return ctx.streams;
    case "coinsEarned": return ctx.coinsEarned;
    case "likes":       return 0;
  }
}

// Returns the lowest-threshold metric not yet reached.
export function getNextMetric(metricsReached: string[]): MetricDef | null {
  return METRIC_CATALOG.find(m => !metricsReached.includes(m.id)) ?? null;
}

export function metricCurrentValue(metric: MetricDef, ctx: UnlockStatCtx): number {
  return statCurrentValue(metric.stat, ctx);
}

const FEATURE_LABELS: Record<string, string> = {
  viewer:     "CREATOR STUDIO",
  upgrades:   "CREATOR TOOLS",
  posting:    "POSTING",
  live:       "GO LIVE",
  go_live:    "GO LIVE",
  diamonds:   "DIAMONDS",
  inbox:      "INBOX",
  discover:   "DISCOVER",
  feed_pager: "FEED SCROLL",
  duet_loop:  "DUET LOOP",
};
export function featureLabel(featureId: string): string {
  return FEATURE_LABELS[featureId] ?? featureId.toUpperCase().replace("_", " ");
}

const STAT_LABELS: Record<MetricStatId, string> = {
  views:       "VIEWS",
  followers:   "FOLLOWERS",
  streams:     "STREAMS",
  coinsEarned: "COINS",
  likes:       "LIKES",
};
export function statLabel(stat: MetricStatId): string {
  return STAT_LABELS[stat];
}
