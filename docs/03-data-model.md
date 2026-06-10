# 03 — Data Model (Canonical Types)

> **These TypeScript types are the source of truth.** When a task touches state, mirror these
> exactly. They are written to drop into `client/src/store/slices/*` and `features/*`. Add fields
> by editing this doc first, then code, then bump `SAVE_VERSION` if the persisted shape changed.
> Some types are marked **(Phase N)** — stub them when that phase starts; you don't need them all
> on day one, but keep names/shapes as given so later phases fit.

## 1. Currencies & core channel state

```ts
// features/economy/types.ts
export type Currency = "followers" | "coins" | "diamonds" | "likes";

export type Wallet = {
  followers: number;     // headline stat; scales runs; rarely spent
  totalFollowers: number;// all-time, never decreases (for milestones/prestige)
  coins: number;         // main spendable
  diamonds: number;      // premium/rare (mostly from LIVE gifts)
  likes: number;         // engagement
};
```

```ts
// store/slices/channelSlice.ts
export type ChannelSlice = {
  handle: string;
  wallet: Wallet;

  // Derived & cached (recomputed by recomputeStats() when upgrades/skills change)
  postPower: number;            // followers/coins per post (before multiplier)
  passiveCoinsPerSec: number;   // idle income
  multiplier: number;           // global ×income (gear/software/skills/prestige)
  followerConversion: number;   // posts/runs → followers conversion factor

  lastSeenAt: number;           // ms epoch, for idle income

  // actions
  setHandle: (h: string) => void;
  post: () => void;                       // the active "create post" tap
  tickPassive: (dt: number) => void;      // meta loop tick
  addCurrency: (c: Currency, amount: number) => void;
  spend: (c: Currency, amount: number) => boolean; // false if insufficient
  recomputeStats: () => void;             // recompute postPower/passive/multiplier/conversion
  applyIdleIncome: (now: number) => IdleReport | null;
};

export type IdleReport = { elapsedSec: number; coins: number; followers: number };
```

## 2. Upgrades — Gear & Software

```ts
// features/upgrades/types.ts
export type UpgradeCategory = "gear" | "software";

export type UpgradeEffect = {
  postPowerAdd?: number;
  postPowerMult?: number;
  passiveCoinsAdd?: number;       // +coins/sec
  multiplierMult?: number;        // ×global multiplier
  followerConversionAdd?: number; // +conversion factor
  // Run-stat bonuses (consumed by the meta→run bridge; see 04):
  runStartViewersAdd?: number;
  runStartViewersMult?: number;
  runGiftRateMult?: number;
  runTrollResistAdd?: number;     // 0..1 chance/effectiveness vs trolls
  unlocksReaction?: ReactionId;   // buying this unlocks a hotbar reaction
};

export type UpgradeDef = {
  id: string;
  category: UpgradeCategory;
  name: string;
  description: string;            // human copy; can be templated from effect
  cost: Partial<Record<Currency, number>>; // usually { coins } or { coins, diamonds }
  requires?: { followers?: number; upgrades?: string[] }; // unlock gating
  effect: UpgradeEffect;
};

// store/slices/upgradesSlice.ts
export type UpgradesSlice = {
  ownedUpgrades: Record<string, boolean>;
  buyUpgrade: (id: string) => boolean;        // false if locked/can't afford
  isUpgradeUnlocked: (id: string) => boolean; // passes `requires`
};
```

## 3. Creator Skills

```ts
// features/skills/types.ts
export type SkillId = "charisma" | "editing" | "stagecraft" | "monetization" | "network";

export type SkillDef = {
  id: SkillId;
  name: string;
  description: string;
  maxLevel: number;
  // cost of NEXT level = baseCost * costGrowth^currentLevel (coins), see 04
  baseCost: number;
  costGrowth: number;
  requires?: { followers?: number };
};

// store/slices/skillsSlice.ts
export type SkillsSlice = {
  skillLevels: Record<SkillId, number>;     // default all 0
  levelSkill: (id: SkillId) => boolean;     // false if maxed/can't afford/locked
  skillCost: (id: SkillId) => number;       // cost of next level
};
```

## 4. Catalog (Phase 1.x — optional richer passive income)

```ts
// features/channel/types.ts
export type VideoPost = {
  id: string;
  topic: string;             // trend/topic it was posted under
  createdAt: number;
  coinsPerSec: number;       // passive yield (decays over time, see 04 § Catalog)
  followersPerSec: number;
  peakAtSec: number;         // when this video's yield peaks then decays
};

// store/slices/catalogSlice.ts
export type CatalogSlice = {
  videos: VideoPost[];
  addVideo: (v: VideoPost) => void;          // created by post() when catalog is enabled
  catalogYieldPerSec: () => { coins: number; followers: number };
};
```

## 5. Livestream run (EPHEMERAL — never persisted)

```ts
// features/livestream/types.ts
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
};

export type RunChoice = { label: string; apply: string /* effect key, see 04 */ };

export type RunModifierId =
  | "algorithm_boost" | "tough_crowd" | "trending_sound" | "shadowban_risk" | "viral_moment";

export type RunModifier = { id: RunModifierId; name: string; description: string };

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

// store/slices/runSlice.ts
export type RunSlice = {
  phase: RunPhase;
  params: RunStartParams | null;
  clockSec: number;          // elapsed run time
  viewers: number;
  peakViewers: number;
  hype: number;              // 0..100
  events: RunEvent[];        // active feed items
  cooldowns: Record<ReactionId, number>; // seconds remaining
  collected: { coins: number; diamonds: number; likes: number };
  flopTimer: number;         // seconds spent under flopFloor

  startRun: (topic: string) => void;     // compute params from meta, go live
  runTick: (dt: number) => void;         // the run loop step (engine)
  collectGift: (eventId: string) => void;
  resolveChoice: (eventId: string, choiceIndex: number) => void;
  useReaction: (id: ReactionId) => void;
  endRun: (reason: "voluntary" | "timer" | "flop") => RunResult;
};

export type RunResult = {
  reason: "voluntary" | "timer" | "flop";
  peakViewers: number;
  finalHype: number;
  giftsCollected: number;
  rewards: { followers: number; coins: number; diamonds: number; likes: number };
  grade: "S" | "A" | "B" | "C" | "D" | "FLOP";
};
```

## 6. Social / multiplayer (Phase 4 — shapes to design toward)

```ts
// client/src/party/types.ts  (MIRROR in party/src/*.ts)
export type ChannelSummary = {
  id: string;
  handle: string;
  followers: number;
  likes: number;
  rank: number;
  live?: boolean;            // is this player currently streaming
};

export type ClientMessage =
  | { type: "join"; handle: string }
  | { type: "score"; followers: number; likes: number }
  | { type: "goLive"; topic: string }                 // Phase 4
  | { type: "raid"; targetId: string; viewers: number }; // Phase 4

export type ServerMessage =
  | { type: "state"; room: { topic: string; startsAt: number; endsAt: number; channels: Record<string, ChannelSummary> } }
  | { type: "leaderboard"; channels: ChannelSummary[] }
  | { type: "raided"; fromHandle: string; viewers: number }; // Phase 4

// store/slices/socialSlice.ts
export type SocialSlice = {
  activeTrend: string | null;     // replaces hardcoded DEFAULT_TREND
  trendsAvailable: { topic: string; heat: number }[]; // Discover list
  leaderboard: ChannelSummary[];
  setActiveTrend: (t: string) => void;
  setLeaderboard: (l: ChannelSummary[]) => void;
  setTrends: (t: { topic: string; heat: number }[]) => void;
};
```

## 7. UI slice & navigation

```ts
// navigation/tabs.ts
export type Tab = "home" | "discover" | "create" | "inbox" | "profile";

// store/slices/uiSlice.ts
export type UiSlice = {
  activeTab: Tab;
  openSheet: "create" | "welcomeBack" | "runResults" | null;
  setTab: (t: Tab) => void;
  setSheet: (s: UiSlice["openSheet"]) => void;
};
```

## 8. Full store type

```ts
// store/index.ts
export type FullState =
  ChannelSlice & UpgradesSlice & SkillsSlice & CatalogSlice &
  RunSlice & SocialSlice & UiSlice;
```

## 9. Save shape & versioning

```ts
// store/slices/meta.ts
export const SAVE_VERSION = 1;
// Persisted (partialize) — durable slices only:
//   handle, wallet, postPower, passiveCoinsPerSec, multiplier, followerConversion,
//   lastSeenAt, ownedUpgrades, skillLevels, videos
// Excluded: run*, social* (except activeTrend optionally), ui*
export type PersistedV1 = {
  version: 1;
  handle: string;
  wallet: Wallet;
  ownedUpgrades: Record<string, boolean>;
  skillLevels: Record<SkillId, number>;
  videos: VideoPost[];
  lastSeenAt: number;
};
```
