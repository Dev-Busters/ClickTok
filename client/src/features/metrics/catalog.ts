import type { MetricDef } from "./types";

// 04 §14.3: metric ladder — thresholds, rewards, and optional feature unlocks.
// IDs follow <stat>_<threshold> convention; featureId strings consumed by 9.3.
export const METRIC_CATALOG: MetricDef[] = [
  { id: "views_25",      stat: "views",     threshold: 25,    reward: { coins: 25 } },
  { id: "views_100",     stat: "views",     threshold: 100,   reward: { coins: 60 },   unlocks: "upgrades" },
  { id: "follower_10",   stat: "followers", threshold: 10,    reward: { coins: 30 }, unlocks: "viewer" },
  { id: "follower_50",   stat: "followers", threshold: 50,    reward: { diamonds: 5 }, unlocks: "diamonds" },
  { id: "follower_200",  stat: "followers", threshold: 200,   reward: { coins: 120 },   unlocks: "posting" },
  { id: "streams_1",     stat: "streams",   threshold: 1,     reward: { diamonds: 5 },  unlocks: "inbox" },
  { id: "follower_500",  stat: "followers", threshold: 500,   reward: { diamonds: 10 }, unlocks: "live" },
  { id: "follower_1000", stat: "followers", threshold: 1000,  reward: { diamonds: 15 }, unlocks: "feed_pager" },
  { id: "follower_5000", stat: "followers", threshold: 5000,  reward: { diamonds: 25 }, unlocks: "duet_loop" },
];
