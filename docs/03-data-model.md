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
  // (Phase 4) real-viewer events — typed identically to sim ones, rendered with a glow:
  real?: boolean;
  fromHandle?: string;                 // the real viewer's handle (set iff real)
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

## 6. Social / multiplayer (Phase 4 — real spectator streams; see `01` §7)

> Two PartyKit rooms: one global **lobby** (presence, live directory, trends, leaderboard, The
> Algorithm) and one **stream room per live run** (id = `streamId`; streamer + spectators).
> All numbers referenced here live in `04` §12. The old `goLive`/`raid`/`raided` messages are
> **superseded** — raids were absorbed into spectator interaction.

```ts
// client/src/party/types.ts  (MIRROR in party/src/*.ts — edit both together)

// ——— Existing trend room (implemented; its leaderboard moves into the lobby in 4.4) ———
export type ChannelSummary = {
  id: string;
  handle: string;
  followers: number;
  likes: number;
  rank: number;
  live?: boolean;            // is this player currently streaming
  trend?: string;            // (4.5b) last trend streamed — drives the per-trend view
};

export type ClientMessage =
  | { type: "join"; handle: string }
  | { type: "score"; followers: number; likes: number };

export type ServerMessage =
  | { type: "state"; room: { topic: string; startsAt: number; endsAt: number; channels: Record<string, ChannelSummary> } }
  | { type: "leaderboard"; channels: ChannelSummary[] };

// ——— Shared Phase 4 shapes ———
// creatorLevel = 1 + floor(log10(max(1, totalFollowers)))   // defined in 04 §12.0

export type LiveStreamSummary = {        // a live run as advertised on Discover
  streamId: string;                      // also the stream room id
  handle: string;
  creatorLevel: number;
  topic: string;
  viewers: number;                       // display total (sim + weighted real, 04 §12.3)
  realViewers: number;
  hype: number;                          // 0..100
  startedAt: number;                     // ms epoch
  featured?: boolean;                    // (6.1) lobby-generated sim filler card
};

export type AlgorithmTier = "STARVED" | "FED" | "BLESSED";
export type AlgorithmState = { meter: number; tier: AlgorithmTier }; // thresholds in 04 §12.5

export type QuickChatId = "w" | "fire" | "icon" | "ratio" | "cooked" | "real_one";
// display text: W · 🔥🔥🔥 · an icon · ratio · cooked · a real one

export type StreamPoll = {
  pollId: string;                        // = the choice RunEvent's id
  prompt: string;
  options: string[];                     // RunChoice labels
  closesAtSec: number;                   // run clock
};

export type SpectatorEvent = {           // trimmed RunEvent for the wire
  id: string;
  type: RunEventType;
  text?: string;
  giftTier?: GiftTier;
  real?: boolean;
  fromHandle?: string;
};

export type RunSnapshot = {              // streamer → server → spectators, 2–4×/sec
  streamId: string;
  handle: string;
  topic: string;
  clockSec: number;
  durationSec: number;
  viewers: number;                       // display total
  hype: number;
  modifiers: RunModifierId[];
  newEvents: SpectatorEvent[];           // feed items since the previous snapshot only
};

// ——— Lobby room ———
// (4.5c-2) AUTH: both party sockets append the Supabase access token to the connection URL
// (`?token=<access_token>`, PartySocket `query` option). The server verifies it and binds the
// connection to the verified user id; the `userId` message fields below become advisory-only
// (ignored whenever a verified id exists). Tokenless connections are guests: full gameplay,
// in-memory leaderboard only, never persisted.
export type LobbyClientMessage =
  | { type: "hello"; handle: string; creatorLevel: number; userId?: string }
  | { type: "goLive"; summary: LiveStreamSummary }     // add me to the directory
  | { type: "liveUpdate"; summary: LiveStreamSummary } // refresh viewers/hype on my card
  | { type: "endLive"; streamId: string }
  | { type: "score"; followers: number; likes: number; userId?: string; trend?: string } // (4.4/4.5b)
  | { type: "getTrendLeaderboard"; trend: string }                                       // (4.5b)
  | { type: "feedAlgorithm"; kind: "streamStarted" | "watchSec" | "giftCoins"; amount: number };

export type LobbyServerMessage =
  | { type: "directory"; streams: LiveStreamSummary[] }
  | { type: "trends"; trends: { topic: string; heat: number }[]; rotatesAt: number } // (4.4)
  | { type: "leaderboard"; channels: ChannelSummary[] }                              // (4.4)
  | { type: "trendLeaderboard"; trend: string; channels: ChannelSummary[] }          // (4.5b)
  | { type: "algorithm"; state: AlgorithmState };

// ——— Stream room (streamer and viewers are both clients of the same room) ———
export type StreamClientMessage =
  // streamer →
  | { type: "open"; summary: LiveStreamSummary }
  | { type: "snapshot"; snap: RunSnapshot }
  | { type: "pollOpen"; poll: StreamPoll }
  | { type: "pollClose"; pollId: string; winningIndex: number }
  | { type: "shoutout"; handle: string; followers: number }        // post-run top-gifter
  | { type: "end"; grade: RunResult["grade"]; peakViewers: number }
  // viewer →
  | { type: "watch"; handle: string; creatorLevel: number }
  | { type: "hypeTap"; taps: number }                  // batched, ≤1 msg/sec (04 §12.1)
  | { type: "quickChat"; preset: QuickChatId }
  | { type: "sendGift"; tier: GiftTier }
  | { type: "vote"; pollId: string; choiceIndex: number };

export type StreamServerMessage =
  // → spectators
  | { type: "snapshot"; snap: RunSnapshot; realViewers: number }
  | { type: "poll"; poll: StreamPoll }
  | { type: "shoutout"; handle: string; followers: number }        // claim iff handle is yours
  | { type: "ended"; grade: RunResult["grade"] }
  // → streamer (real interactions to inject as `real: true` RunEvents)
  | { type: "viewerCount"; realViewers: number }
  | { type: "realHype"; fromHandle: string; taps: number }
  | { type: "realChat"; fromHandle: string; preset: QuickChatId }
  | { type: "realGift"; fromHandle: string; tier: GiftTier; atRunSec: number }
  | { type: "voteTally"; pollId: string; tally: number[] };
```

```ts
// store/slices/socialSlice.ts
export type SocialSlice = {
  activeTrend: string | null;     // replaces hardcoded DEFAULT_TREND
  trendsAvailable: { topic: string; heat: number }[]; // Discover list
  leaderboard: ChannelSummary[];
  setActiveTrend: (t: string) => void;
  setLeaderboard: (l: ChannelSummary[]) => void;
  setTrends: (t: { topic: string; heat: number }[]) => void;
  // Phase 4:
  liveDirectory: LiveStreamSummary[];       // Discover "LIVE NOW" rail
  algorithm: AlgorithmState | null;
  setLiveDirectory: (s: LiveStreamSummary[]) => void;
  setAlgorithm: (a: AlgorithmState) => void;
};
```

```ts
// store/slices/spectateSlice.ts (Phase 4 — EPHEMERAL, never persisted)
export type WatchDrop = {
  watchSec: number;
  coins: number; diamonds: number; followers: number; likes: number;
  jackpotCoins: number;        // early-backer payout (0 if none), 04 §12.2
  shoutoutFollowers: number;   // 0 unless you were the shouted-out top gifter
};

export type SpectateSlice = {
  spectating: LiveStreamSummary | null;    // null = not watching
  liveSnapshot: RunSnapshot | null;
  spectateFeed: SpectatorEvent[];          // rolling feed from snapshots (cap ~40)
  realViewers: number;
  watchStartedAt: number | null;           // ms epoch
  myGiftCoinsSent: number;                 // this stream (jackpot/shoutout basis)
  myEarlyGiftCoins: number;                // sent within the early-backer window
  activePoll: StreamPoll | null;
  pendingDrop: WatchDrop | null;           // drives the viewer result sheet
  joinStream: (s: LiveStreamSummary) => void;
  leaveStream: () => void;                 // compute + grant WatchDrop (04 §12.4)
  applySnapshot: (snap: RunSnapshot, realViewers: number) => void;
};
```

```ts
// runSlice — Phase 4 additions (streamer side, ephemeral like the rest of RunSlice)
//   realViewers: number;
//   realTapsLast5s: number;   // sliding window for hype-decay relief (04 §12.3)
//   realGiftLog: { handle: string; coins: number; atRunSec: number }[]; // top gifter + jackpot

## 6.5 The Feed & the Element system (Phase 7 — see `01` §8; numbers in `04` §13)

```ts
// features/elements/types.ts (Phase 7.3+ — the clicker element framework, client-only)
export type ElementId = "beat_sync" | "duet_loop";   // extensible — new elements = new id here

export type BeatGrade = "perfect" | "good" | "ok" | "miss";

export type ElementDef = {
  id: ElementId;
  name: string;              // display name, e.g. "BEAT SYNC"
  tagline: string;           // one-line pitch shown on the locked pod / unlock sheet
  requires: { coins: number; followers: number }; // coins SPENT to unlock; followers = gate
};

// One in-flight wave (ephemeral). Discriminated per element:
export type ElementWave =
  | { element: "beat_sync"; startedAt: number;   // ms epoch — THE shared clock; ring scale and
      rings: { id: number; grade?: BeatGrade }[] } //  grading both derive from (now - startedAt)
  | { element: "duet_loop"; startedAt: number;
      armedIndex: number | null;                  // pod lit and waiting for its tap
      completed: number };                        // pods finished (0..duetCircles)

// store/slices/elementsSlice.ts
export type ElementsSlice = {
  ownedElements: Partial<Record<ElementId, boolean>>; // ⚠ PERSISTED — SAVE_VERSION bump +
                                                      // migration (default {}), per `02` §4
  activeWave: ElementWave | null;     // ephemeral
  nextWaveAt: number;                 // ephemeral scheduler clock (ms epoch)
  unlockElement: (id: ElementId) => boolean; // false if can't afford / follower gate unmet
  spawnWave: (id: ElementId) => void;
  tapRing: (ringId: number) => void;  // beat_sync: grade = f(now - startedAt) vs 04 §13.2 windows
  tapDuetPod: () => void;             // duet_loop: pays iff armedIndex is this pod
  expireOrResolveWave: () => void;    // payout, clear, schedule nextWaveAt (+ idle gap)
};
```

```ts
// client/src/party/types.ts  (MIRROR in party/src/lobby.ts — edit both together)
// ⚠ 7.5 REWORK: `FeedBoostId`/`boost` (shipped in 7.1) become `FeedModId`/`mod` when the video
// system integrates — videos modify clicker MECHANICS, not stats (01 §8.3, mods table 04 §13.5).
export type FeedModId =
  | "ring_slow" | "extra_ring" | "wide_window"   // beat_sync mods
  | "duet_flow" | "core_surge" | "wave_rush";    // duet/core/scheduler mods

export type VideoCard = {
  videoId: string;           // client-generated uuid (like streamId)
  handle: string;            // poster handle (or NPC name)
  creatorLevel: number;
  topic: string;             // trend topic at post time
  captionId: string;         // preset caption template id — NEVER free text (moderation)
  mod: FeedModId;            // rolled at publish time (was `boost: FeedBoostId` pre-7.5)
  postedAt: number;          // ms epoch — SERVER-stamped on postVideo
  tapCount: number;          // global engagement counter — SERVER-owned, client value ignored
  npc?: boolean;             // server-generated filler (no royalties)
};

// Lobby room — Phase 7 message additions:
export type LobbyClientMessageFeed =                 // merge into LobbyClientMessage
  | { type: "postVideo"; card: VideoCard }           // server stamps postedAt, zeroes tapCount
  | { type: "getFeed" }                              // request/response (like getTrendLeaderboard)
  | { type: "engage"; videoId: string; taps: number }; // batched on swipe-away (clamped, 04 §13)

export type LobbyServerMessageFeed =                 // merge into LobbyServerMessage
  | { type: "feed"; cards: VideoCard[] }             // newest-first, NPC-padded to feedMinDeck
  | { type: "videoPosted"; card: VideoCard }         // broadcast on accepted postVideo
  | { type: "royalty"; videoId: string; fromHandle: string; taps: number }; // → poster only
```

```ts
// store/slices/feedSlice.ts (Phase 7 — EPHEMERAL, never persisted)
// 7.2 builds the combo/engageTap half; deck/pager/publish/royalty fields activate at 7.5–7.6.
export type FeedSlice = {
  combo: number;               // consecutive-tap counter; DRAINS when idle (04 §13.1) and
                               // resets on swipe once the pager exists (7.5)
  lastTapAt: number;           // ms epoch — drives combo decay
  deck: VideoCard[];           // (7.5) scroll deck (server feed; NPC-local fallback offline)
  deckIndex: number;           // (7.5)
  tapsThisCard: number;        // (7.6) batched → `engage` on swipe-away/unmount
  publishReadyAt: number;      // (7.5) ms epoch — POST cooldown gate
  engageTap: () => void;       // THE clicker: gainPerPost × comboMult (× mods after 7.5);
                               // also arms duet_loop's next pod when its wave is active
  setDeck: (cards: VideoCard[]) => void;   // (7.5)
  advance: (dir: 1 | -1) => void;          // (7.5) swipe: flush engage batch, reset combo
  publishVideo: () => VideoCard | null;    // (7.5) null if on cooldown; burst (04 §13.3)
  applyRoyalty: (taps: number, fromHandle: string) => void; // (7.6) likes += taps × rate
};
```

```ts
// uiSlice — Phase 7 addition (PERSISTED — the one durable feed-adjacent field):
//   coachMarksSeen: boolean;   // first-run overlay shown once, ever
// ⚠ persisting it requires adding it to `partialize` + a SAVE_VERSION bump + migration
// (default false for old saves), per `02` §4.
```
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
  RunSlice & SocialSlice & UiSlice
  & SpectateSlice  // Phase 4
  & FeedSlice      // Phase 7
  & ElementsSlice; // Phase 7.3+
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
