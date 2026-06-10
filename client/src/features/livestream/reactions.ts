import type { ReactionDef, ReactionId } from "./types";

// 04 §9
export const REACTION_CATALOG: Record<ReactionId, ReactionDef> = {
  hype_dance: {
    id: "hype_dance",
    name: "Hype Dance",
    cooldownSec: 6,
    description: "+18 hype",
  },
  clapback: {
    id: "clapback",
    name: "Clapback",
    cooldownSec: 8,
    description: "Remove the latest troll, +5 hype",
  },
  pin_comment: {
    id: "pin_comment",
    name: "Pin Comment",
    cooldownSec: 12,
    description: "Turn a comment into followers (viewers × 0.5)",
  },
  shoutout: {
    id: "shoutout",
    name: "Shoutout",
    cooldownSec: 20,
    description: "×2 gift rate for 8s",
  },
  go_off: {
    id: "go_off",
    name: "Go Off",
    cooldownSec: 45,
    description: "×3 all gains + 30 hype for 6s",
  },
};

export const REACTION_ICON: Record<ReactionId, string> = {
  hype_dance: "💃",
  clapback: "👏",
  pin_comment: "📌",
  shoutout: "📢",
  go_off: "🚀",
};
