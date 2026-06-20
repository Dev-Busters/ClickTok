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
  effect: UpgradeEffect;
  requires?: { followers?: number; upgrades?: string[] }; // unlock gating
  // One-time purchase (present iff repeatable is absent):
  cost?: Partial<Record<Currency, number>>; // usually { coins } or { coins, diamonds }
  // Repeatable/leveled (all three present iff repeatable: true — see `01` §10.4):
  repeatable?: true;
  baseCost?: Partial<Record<Currency, number>>; // cost at level 0 (first buy)
  costGrowth?: number;                          // cost(L) = round(baseCost × costGrowth^L)
  maxLevel?: number;                            // if absent, unlimited
};

// store/slices/upgradesSlice.ts
export type UpgradesSlice = {
  ownedUpgrades: Record<string, boolean>;
  upgradeLevels: Record<string, number>;         // (Phase 9.1) current level per repeatable id
  buyUpgrade: (id: string) => boolean;           // false if locked/can't afford/repeatable
  isUpgradeUnlocked: (id: string) => boolean;    // passes `requires`
  upgradeCost: (id: string) => number;           // coins for next level (0 if maxed/not repeatable)
  levelUpgrade: (id: string) => boolean;         // false if can't afford/maxed/not repeatable
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
export type ElementId = "beat_sync" | "duet_loop" | "hold_drop" | "swipe_hits"; // 10.4 adds latter two

export type BeatGrade = "perfect" | "good" | "ok" | "miss";

// Fractional [0,1] pod position within the element stage (11.3)
export type PodPos = { x: number; y: number };

export type ElementDef = {
  id: ElementId;
  name: string;              // display name, e.g. "BEAT SYNC"
  tagline: string;           // one-line pitch shown on the locked pod / unlock sheet
  requires: { coins: number; followers: number }; // coins SPENT to unlock; followers = gate
};

// One in-flight wave (ephemeral). Discriminated per element:
export type ElementWave =
  | { element: "beat_sync"; startedAt: number;   // ms epoch — THE shared clock; ring scale and
      rings: { id: number; grade?: BeatGrade }[];  //  grading both derive from (now - startedAt)
      pos: PodPos[] }                              // 11.3: seeded scattered positions per pod
  | { element: "duet_loop"; startedAt: number;
      armedIndex: number | null;                  // pod lit and waiting for its tap
      armedAt: number | null;                     // ms when current pod armed (timeout tracking)
      firstArmedAt: number | null;                // ms of first arm (flow window)
      completed: number;                          // pods finished (0..duetCircles)
      pos: PodPos[] }                             // 11.3: seeded scattered positions per pod
  | { element: "hold_drop"; startedAt: number;
      pressedAt: number | null;                   // ms when press started (null = not holding)
      grade: "perfect" | "weak" | "miss" | undefined; // set on release or expiry
      resolvedAt: number | null;                  // ms when grade assigned (for grace period)
      pos: PodPos }                               // 11.3: single pod position (scalar, not array)
  | { element: "swipe_hits"; startedAt: number;
      traces: { id: number; from: { x: number; y: number }; to: { x: number; y: number }; grade?: "perfect" | "miss" }[];
      resolvedAt?: number };                      // 11.4: anchored drag-between-dots (trace mechanic)

// store/slices/elementsSlice.ts
export type ElementsSlice = {
  ownedElements: Partial<Record<ElementId, boolean>>; // ⚠ PERSISTED — SAVE_VERSION bump +
                                                      // migration (default {}), per `02` §4
  elementsTeachSeen: Partial<Record<ElementId, boolean>>; // ⚠ PERSISTED v9 — 11.3
  activeWave: ElementWave | null;     // ephemeral
  nextWaveAt: number;                 // ephemeral scheduler clock (ms epoch)
  unlockElement: (id: ElementId) => boolean; // false if can't afford / follower gate unmet
  spawnWave: (id: ElementId) => void;
  tapRing: (ringId: number) => void;  // beat_sync: grade = f(now - startedAt) vs 04 §13.2 windows
  tapDuetPod: () => void;             // duet_loop: pays iff armedIndex is this pod
  pointerDownHold: () => void;        // hold_drop: starts press timer
  pointerUpHold: () => void;          // hold_drop: grades and pays
  resolveTrace: (id: number, hitTarget: boolean) => void; // swipe_hits: grade one trace (11.4)
  setElementTeachSeen: (id: ElementId) => void;    // 11.3: marks teach seen (persisted)
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

// (Phase 8.5–8.6) rail reactions — once per player per video; counters SERVER-owned
export type ReactionKind = "like" | "comment" | "share" | "follow";

export type VideoCard = {
  videoId: string;           // client-generated uuid (like streamId)
  handle: string;            // poster handle (or NPC name)
  creatorLevel: number;
  topic: string;             // trend topic at post time
  captionId: string;         // preset caption template id — NEVER free text (moderation)
  mod: FeedModId;            // rolled at publish time (was `boost: FeedBoostId` pre-7.5)
  postedAt: number;          // ms epoch — SERVER-stamped on postVideo
  tapCount: number;          // global BINGE-TAP counter — SERVER-owned, client value ignored
  reactions: { likes: number; comments: number; shares: number }; // (8.5) rail counters —
                             //   NPC cards: seeded per `04` §13.7; player cards accrue via
                             //   `engage`; SERVER defaults zeros on legacy pool cards (8.6);
                             //   client defaults zeros on cards from a pre-8.6 server
  npc?: boolean;             // server-generated filler (no royalties)
};

// Lobby room — Phase 7 message additions:
export type LobbyClientMessageFeed =                 // merge into LobbyClientMessage
  | { type: "postVideo"; card: VideoCard }           // server stamps postedAt, zeroes tapCount
  | { type: "getFeed" }                              // request/response (like getTrendLeaderboard)
  | { type: "engage"; videoId: string; taps: number;  // batched on swipe-away (clamped, 04 §13)
      reactions?: Partial<Record<ReactionKind, boolean>> }; // (8.6) boolean-clamped; server
                                                     //   dedupes per connection per videoId

export type LobbyServerMessageFeed =                 // merge into LobbyServerMessage
  | { type: "feed"; cards: VideoCard[] }             // newest-first, NPC-padded to feedMinDeck
  | { type: "videoPosted"; card: VideoCard }         // broadcast on accepted postVideo
  | { type: "royalty"; videoId: string; fromHandle: string; taps: number;
      reactions?: Partial<Record<ReactionKind, boolean>> }; // → poster only (likes/followers
                                                     //   per `04` §13.7 royalty lines)
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
  reactedByVideo: Record<string, Partial<Record<ReactionKind, true>>>; // (8.5) session-ephemeral
                               //   once-per-VIDEO gate (keyed by videoId so re-swiping a card
                               //   can't farm it); current card's entry flushes into `engage`
  viralUntil: number;          // (8.4) ms epoch; > now ⇒ VIRAL: ALL payouts × viralGainMult,
                               //   combo frozen at cap, decay paused (04 §13.8); 0 = idle
  engageTap: () => void;       // THE clicker: gainPerPost × comboMult (× mods after 7.5,
                               // × viralGainMult while viral); arms duet_loop's next pod when
                               // its wave is active; triggers VIRAL when combo hits comboCap
  reactToCard: (kind: ReactionKind) => boolean; // (8.5) false if already reacted on this video;
                               // pays 04 §13.7 × comboMult (× viral), bumps the local card
                               // counter optimistically, fires SUPERFAN sweep when all 4 done
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

## 6.6 The TEB Rhythm Canvas (Phases 16–17 — see `12`/`13`; numbers in `04` §15–16)

> The TEB-launched, full-area rhythm framework. Phase 16 proves charge→tap sequence→reward;
> Phase 17 generalizes it to timed tap, hold, swipe-chain, and trace charts. One **session** at a
> time. Runtime/chart/pointer state is ephemeral; only teach flags persist.

```ts
// features/teb/types.ts (client-only)

export type NodeKind = "tap" | "hold" | "swipe" | "trace";
export type SequenceId = "tap_three" | "hold_pulse" | "swipe_chain" | "trace_arc";

// Fractional [0,1] position measured within RhythmPlayfield's safe rectangle.
export type NodePos = { x: number; y: number };

// Authored timing/interaction definition. Geometry is assigned by buildChart().
export type NodeDef =
  | { id: number; kind: "tap"; hitAtMs: number }
  | { id: number; kind: "hold"; hitAtMs: number; durationMs: number }
  | { id: number; kind: "swipe"; hitAtMs: number; toId: number }
  | { id: number; kind: "trace"; hitAtMs: number; durationMs: number };

export type SequenceDef = {
  id: SequenceId;
  name: string;
  gestureHint: "tap" | "hold" | "swipe" | "trace";
  nodes: NodeDef[];
};

// How the player manipulates TEB to launch. Phase 17 deliberately keeps one unambiguous move.
export type TebMoveId = "hold_charge";

export type RhythmNodeState = "upcoming" | "active" | "resolved" | "missed";

export type RuntimeNode = {
  id: number;
  kind: NodeKind;
  pos: NodePos;
  hitAt: number;                    // ms epoch
  releaseAt: number | null;         // hold/trace end; null for tap/swipe start nodes
  path: NodePos[] | null;           // swipe/trace geometry; null for tap/hold
  state: RhythmNodeState;
  quality: number | null;           // [0,1] after resolution
  completedAt: number | null;
};

export type RhythmJudgementLabel = "perfect" | "great" | "good" | "miss";
export type RhythmJudgement = {
  nodeId: number;
  kind: NodeKind;
  label: RhythmJudgementLabel;
  quality: number;
  at: number;
  pos: NodePos;
};

// Serializable pointer summary only — never store PointerEvent/DOM objects in Zustand.
export type RhythmPointer = {
  pointerId: number;
  inputKind: "pointer" | "keyboard";
  nodeId: number;
  startedAt: number;
  start: NodePos;
  current: NodePos;
  visitedNodeIds: number[];
  pathCoverage: number;
  samples: { pos: NodePos; at: number }[];
} | null;

export type RhythmChart = {
  sequence: SequenceId;
  seed: number;
  durationMs: number;
  nodes: RuntimeNode[];
};

// One in-flight session (ephemeral). Discriminated by phase:
export type TebSession =
  | { phase: "charging"; move: "hold_charge"; pressedAt: number }   // shrinking ring around TEB
  | { phase: "count_in";                                            // TEB hidden; chrome leaving
      chart: RhythmChart;
      chargeQuality: number;
      startsAt: number }
  | { phase: "playing";                                             // full-area rhythm ownership
      chart: RhythmChart;
      chargeQuality: number;
      startedAt: number;
      pointer: RhythmPointer;
      judgements: RhythmJudgement[];
      nextIndex: number;
      rhythmCombo: number;
      maxRhythmCombo: number }
  | { phase: "result";                                              // TEB returned; reward shown
      sequence: SequenceId;
      chargeQuality: number;
      performanceQuality: number;      // weighted judgement quality [0,1]
      completion: number;              // resolved required units / total [0,1]
      maxRhythmCombo: number;
      reward: { coins: number; followers: number; likes: number; k: number }; // k = combined mult
      resolvedAt: number };

// store/slices/tebSlice.ts
export type TebSlice = {
  session: TebSession | null;   // ephemeral — NOT persisted (like activeWave)
  tebReadyAt: number;           // ephemeral launch-cooldown clock (ms epoch; <=now = ready)
  // ⚠ PERSISTED — one-time charge teach (12 §B). Bump SAVE_VERSION 12→13 + migration (default false).
  tebChargeTeachSeen: boolean;
  // ⚠ PERSISTED Phase 17 — per-chart teach flags. Bump SAVE_VERSION 13→14; see `13` §F.
  tebSequenceTeachSeen: Partial<Record<SequenceId, boolean>>;
  setTebChargeTeachSeen: () => void;
  markTebSequenceTeachSeen: (sequence: SequenceId) => void;

  beginCharge: () => void;      // guard: framework unlocked, no session, cooldown elapsed
  releaseCharge: (rect: { width: number; height: number }) => void; // build chart → count_in
  rhythmPointerDown: (input: { pointerId: number; pos: NodePos; at: number }) => void;
  rhythmPointerMove: (input: { pointerId: number; pos: NodePos; at: number }) => void;
  rhythmPointerUp: (input: { pointerId: number; pos: NodePos; at: number }) => void;
  rhythmPointerCancel: (pointerId: number) => void;
  tickTebSession: () => void;   // count-in/start windows/timeouts/result grace
  dismissResult: () => void;    // clear session (cooldown keeps running)
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
  RunSlice & SocialSlice & UiSlice
  & SpectateSlice  // Phase 4
  & FeedSlice      // Phase 7
  & ElementsSlice; // Phase 7.3+
```

## 8.5 Metrics & Creator Insights (Phase 9.2 — data model preview)

```ts
// features/metrics/types.ts  (Phase 9.2 — stub the types now; full impl 9.2)
export type MetricStatId = "views" | "followers" | "likes" | "streams" | "coinsEarned";

export type MetricDef = {
  id: string;
  stat: MetricStatId;
  threshold: number;
  reward: Partial<Record<Currency, number>>;
  unlocks?: string;   // featureId string, consumed by isFeatureUnlocked (9.3)
};

// ⚠ viewsTotal (lifetime TEB taps) is NEW persisted state in Phase 9.2:
//   viewsTotal: number;   — added to ChannelSlice + PersistedVN + migrate (default 0)
//
// metricsReached: string[]  — Phase 9.2, replaces milestonesReached (mapped in migration)
//   When a metric's threshold is crossed, its id is pushed here + reward granted + notif fired.
//
// isFeatureUnlocked(featureId): boolean  — Phase 9.3, derived from metricsReached.
```

## 9. Save shape & versioning

```ts
// store/slices/meta.ts
export const SAVE_VERSION = 16; // Phase 18 reset/deferred-video correction
// v1 → base shape; v2 → wallet/skills/videos; v3 → inbox/milestones;
// v4 → ownedElements (7.3); v5 → upgradeLevels + tebTeachSeen (9.1)
// v6 → metricsReached + lifetime counters (9.2); v7 → affordableNotifiedPillars (10.2)
// v8 → metricsReached id rename follower_100→follower_200 (11.2)
// v9 → elementsTeachSeen (11.3); v10 → metric-id re-derive; v11 → modTeachSeen;
// v12 → catalog activation marker; v13 → tebChargeTeachSeen;
// v14 → tebSequenceTeachSeen; v15 → staged onboarding; v16 → reset/cloud parity + deferred video
// Persisted (partialize) — durable slices only:
//   handle, wallet, comments, tapPower, passiveFollowersPerSec, passiveCoinsPerSec,
//   multiplier, followerConversion, boonMultiplier, lastSeenAt,
//   ownedUpgrades, upgradeLevels (9.1), skillLevels, videos,
//   notifications, lastDailyClaimAt, metricsReached, ownedElements, tebTeachSeen (9.1),
//   viewsTotal, coinsEarned, streams (9.2), affordableNotifiedPillars (10.2),
//   elementsTeachSeen (11.3)
// Excluded: run* (ephemeral), social* (server-owned), ui.activeTab/openSheet (session)
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

## 10. Staged onboarding & opening progression (Phase 18 — see `14`; numbers in `04` §17)

Phase 18 does not delete `MetricDef`; metrics remain achievements and later progression inputs.
The fresh opening is instead driven by an ordered goal state that cannot cascade.

```ts
// features/onboarding/types.ts
export const ONBOARDING_REVISION = 1 as const;

export type OnboardingStepId =
  | "meet_teb"
  | "unlock_studio"
  | "buy_audience_reach"
  | "reach_700"
  | "own_three_fyp_levels"
  | "reach_1200"
  | "unlock_rhythm"
  | "complete_first_rhythm"
  | "unlock_video_fyp";

export type OnboardingFeatureId =
  | "creator_studio"
  | "engagement_meter"
  | "tap_three"
  | "video_fyp";

export type OpeningUpgradeId = "audience_reach" | "engagement_rate";

export type GoalRequirement =
  | { kind: "tap_count"; amount: number }
  | { kind: "total_followers"; amount: number }
  | { kind: "upgrade_level"; id: OpeningUpgradeId; amount: number }
  | { kind: "total_opening_upgrade_levels"; amount: number }
  | { kind: "rhythm_completions"; sequenceId: "tap_three"; amount: number }
  | { kind: "acknowledge_reveal"; feature: OnboardingFeatureId };

export type OnboardingGoalDef = {
  id: OnboardingStepId;
  label: string;
  benefit: string;
  requirement: GoalRequirement;
  reward?: { coins?: number };
  reveals?: OnboardingFeatureId;
  teachId?: string;
};

export type OnboardingReveal = {
  feature: OnboardingFeatureId;
  shownAt: number;
  dismissed: boolean;
};

// store/slices/onboardingSlice.ts
export type OnboardingSlice = {
  onboardingRevision: typeof ONBOARDING_REVISION;
  onboardingStep: OnboardingStepId;
  completedOnboardingGoals: OnboardingStepId[];
  activeOnboardingReveal: OnboardingReveal | null;
  onboardingTeachesSeen: Record<string, true>;
  engagementFill: number; // persisted; clamp 0..BALANCE.onboarding.engagement.cap
  tapThreeCompletions: number;

  checkOnboardingGoal: () => void;
  acknowledgeOnboardingReveal: () => void;
  completeOnboardingTeach: (teachId: string) => void;
  addEngagement: (amount: number) => void;
  consumeEngagementForRhythm: () => boolean;
  resetOnboardingRevision: () => void; // development/release-controlled action
};
```

Opening feature availability derives from completed ordered goals, not `metricsReached`. The old
metric flags must not unlock fresh-opening UI in parallel. Once `video_fyp` is complete, later
chapters may bridge back into authored metrics or additional ordered goal catalogs.

Phase 18 implementation bumps the current code save version **14 → 15** and persists the fields
above. TEB rhythm session geometry, active pointers, and judgement state remain ephemeral.
