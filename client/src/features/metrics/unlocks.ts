import { METRIC_CATALOG } from "./catalog";
import type { MetricDef, MetricStatId } from "./types";

// Cascade safety-net: lets old readers (e.g. isFeatureUnlocked("viewer", ...),
// isFeatureUnlocked("go_live", ...)) still work after the 08 §B flag rename.
// Each value is the canonical flag that has a direct metric unlock.
const FEATURE_TO_PILLAR: Record<string, string> = {
  viewer:  "studio",  // old "viewer" pillar → new "studio" flag
  upgrades: "studio", // Creator Tools sub-feature
  go_live: "live",    // alias for go_live → live
};

// Derives from metricsReached — no extra persisted set needed (01 §10.3).
export function isFeatureUnlocked(featureId: string, metricsReached: string[]): boolean {
  // Direct metric unlock (canonical path)
  if (METRIC_CATALOG.some(m => m.unlocks === featureId && metricsReached.includes(m.id))) return true;
  // Alias cascade: e.g. "viewer" → "studio", "go_live" → "live"
  const canonical = FEATURE_TO_PILLAR[featureId];
  if (canonical) {
    return METRIC_CATALOG.some(m => m.unlocks === canonical && metricsReached.includes(m.id));
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
  studio:          "CREATOR STUDIO",
  viewer:          "CREATOR STUDIO",
  upgrades:        "CREATOR TOOLS",
  posting:         "POSTING",
  live:            "GO LIVE",
  go_live:         "GO LIVE",
  diamonds:        "DIAMONDS",
  inbox:           "INBOX",
  discover:        "DISCOVER",
  feed_scroll:     "FEED SCROLL",
  feed_pager:      "FEED SCROLL",
  fyp_video:       "FYP VIDEO",
  engagement_rail: "ENGAGEMENT RAIL",
  bottom_nav:      "NAVIGATION",
  element_stage:   "ELEMENTS",
  duet_loop:       "DUET LOOP",
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
