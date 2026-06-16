import type { MetricDef } from "./types";

// 04 §14.3 (08 §B): metric ladder — thresholds, rewards, and optional feature unlocks.
// Ordered ascending; each id is unique. Feature flags are granular (one-at-a-time per 08 §B).
export const METRIC_CATALOG: MetricDef[] = [
  { id: "views_10",      stat: "views",     threshold: 10,   reward: { coins: 15 },   unlocks: "fyp_video" },
  { id: "views_25",      stat: "views",     threshold: 25,   reward: { coins: 25 },   unlocks: "engagement_rail" },
  { id: "views_45",      stat: "views",     threshold: 45,   reward: { coins: 35 },   unlocks: "bottom_nav" },
  { id: "views_80",      stat: "views",     threshold: 80,   reward: { coins: 50 },   unlocks: "studio" },
  { id: "views_140",     stat: "views",     threshold: 140,  reward: { coins: 70 },   unlocks: "feed_scroll" },
  { id: "follower_50",   stat: "followers", threshold: 50,   reward: { diamonds: 5 }, unlocks: "diamonds" },
  { id: "follower_90",   stat: "followers", threshold: 90,   reward: { coins: 80 },   unlocks: "posting" },
  { id: "follower_120",  stat: "followers", threshold: 120,  reward: { coins: 100 },  unlocks: "element_stage" },
  { id: "follower_160",  stat: "followers", threshold: 160,  reward: { diamonds: 5 }, unlocks: "discover" },
  { id: "follower_200",  stat: "followers", threshold: 200,  reward: { coins: 120 },  unlocks: "live" },
  { id: "streams_1",     stat: "streams",   threshold: 1,    reward: { diamonds: 5 }, unlocks: "inbox" },
  { id: "follower_1000", stat: "followers", threshold: 1000, reward: { diamonds: 15 } },
  { id: "follower_5000", stat: "followers", threshold: 5000, reward: { diamonds: 25 } },
];
