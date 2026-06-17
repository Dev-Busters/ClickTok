export type ReactionId =
  | "hype_dance" | "clapback" | "pin_comment" | "shoutout" | "go_off";

export type ReactionDef = {
  id: ReactionId;
  name: string;
  cooldownSec: number;
  description: string;
  // effect applied via applyReaction() in the run engine (see 04 § Reactions)
};

export type RunEventType =
  | "comment" | "gift" | "hype_wave" | "troll" | "raid" | "sponsor" | "challenge";

export type GiftTier = "rose" | "heart" | "galaxy" | "lion"; // ascending value

export type RunEvent = {
  id: string;
  type: RunEventType;
  spawnedAt: number;       // run-clock ms
  expiresAt: number;       // when it leaves the feed / auto-resolves
  resolved: boolean;
  // type-specific payload:
  text?: string;                       // comment text
  giftTier?: GiftTier;                 // gift value tier
  choices?: RunChoice[];               // comment/sponsor decision options
  amount?: number;                     // generic magnitude (viewers, coins...)
  // Phase 4: real-viewer events are typed identically to sim ones, rendered with a glow.
  real?: boolean;
  fromHandle?: string;                 // the real viewer's handle (set iff real)
};

export type RunChoice = { label: string; apply: string /* effect key, see 04 */ };

export type RunModifierId =
  | "algorithm_boost" | "tough_crowd" | "trending_sound" | "shadowban_risk" | "viral_moment";

// 14.2 (10 §B): strategy is a one-line playstyle hint — how to play around the modifier,
// not just what it does (that's `description`).
export type RunModifier = { id: RunModifierId; name: string; description: string; strategy: string };

export type RunStartParams = {
  topic: string;
  startViewers: number;
  giftRate: number;          // gifts/sec baseline
  giftQuality: number;       // shifts gift tier distribution up
  hypeDecayPerSec: number;
  eventIntervalSec: number;  // mean time between events
  flopFloor: number;         // viewers below this → flop countdown
  durationSec: number;
  followerConversion: number;
  trendMultiplier: number;
  reactions: ReactionId[];   // unlocked loadout
  modifiers: RunModifier[];
};

export type RunPhase = "idle" | "starting" | "live" | "results";

export type RunResult = {
  reason: "voluntary" | "timer" | "flop";
  peakViewers: number;
  finalHype: number;
  giftsCollected: number;
  rewards: { followers: number; coins: number; diamonds: number; likes: number };
  grade: "S" | "A" | "B" | "C" | "D" | "FLOP";
};
