// Shared types between client and the PartyKit lobby/stream rooms —
// mirrored in party/src/lobby.ts and party/src/stream.ts — edit both together.

import type { GiftTier, RunEventType, RunModifierId, RunResult } from '../features/livestream/types';
export type { GiftTier };

// ——— Leaderboard (4.4: lives in the lobby room; 4.5b: persisted in Supabase) ———
export type ChannelSummary = {
  id: string;
  handle: string;
  followers: number;
  likes: number;
  rank: number;
  live?: boolean;
  trend?: string;
};

// ——— Shared Phase 4 shapes ———
// creatorLevel = 1 + floor(log10(max(1, totalFollowers)))   // defined in 04 §12.0

export type LiveStreamSummary = {
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
export type AlgorithmState = { meter: number; tier: AlgorithmTier };

export type QuickChatId = "w" | "fire" | "icon" | "ratio" | "cooked" | "real_one";
// display text: W · 🔥🔥🔥 · an icon · ratio · cooked · a real one

export type StreamPoll = {
  pollId: string;
  prompt: string;
  options: string[];
  closesAtSec: number;
};

export type SpectatorEvent = {
  id: string;
  type: RunEventType;
  text?: string;
  giftTier?: GiftTier;
  real?: boolean;
  fromHandle?: string;
};

export type RunSnapshot = {
  streamId: string;
  handle: string;
  topic: string;
  clockSec: number;
  durationSec: number;
  viewers: number;
  hype: number;
  modifiers: RunModifierId[];
  newEvents: SpectatorEvent[];
};

// ——— Lobby room ———
export type LobbyClientMessage =
  | { type: "hello"; handle: string; creatorLevel: number; userId?: string }
  | { type: "goLive"; summary: LiveStreamSummary }
  | { type: "liveUpdate"; summary: LiveStreamSummary }
  | { type: "endLive"; streamId: string }
  | { type: "score"; followers: number; likes: number; userId?: string; trend?: string }  // (4.5b) userId/trend persist + scope the leaderboard
  | { type: "getTrendLeaderboard"; trend: string }                                        // (4.5b)
  | { type: "feedAlgorithm"; kind: "streamStarted" | "watchSec" | "giftCoins"; amount: number };

export type LobbyServerMessage =
  | { type: "directory"; streams: LiveStreamSummary[] }
  | { type: "trends"; trends: { topic: string; heat: number }[]; rotatesAt: number }
  | { type: "leaderboard"; channels: ChannelSummary[] }                       // global, top followers
  | { type: "trendLeaderboard"; trend: string; channels: ChannelSummary[] }   // (4.5b) per-trend
  | { type: "algorithm"; state: AlgorithmState };

// ——— Stream room (streamer and viewers are both clients of the same room) ———
export type StreamClientMessage =
  // streamer →
  | { type: "open"; summary: LiveStreamSummary }
  | { type: "snapshot"; snap: RunSnapshot }
  | { type: "pollOpen"; poll: StreamPoll }
  | { type: "pollClose"; pollId: string; winningIndex: number }
  | { type: "shoutout"; handle: string; followers: number }
  | { type: "end"; grade: RunResult["grade"]; peakViewers: number }
  // viewer →
  | { type: "watch"; handle: string; creatorLevel: number }
  | { type: "hypeTap"; taps: number }
  | { type: "quickChat"; preset: QuickChatId }
  | { type: "sendGift"; tier: GiftTier }
  | { type: "vote"; pollId: string; choiceIndex: number };

export type StreamServerMessage =
  // → spectators
  | { type: "snapshot"; snap: RunSnapshot; realViewers: number }
  | { type: "poll"; poll: StreamPoll }
  | { type: "shoutout"; handle: string; followers: number }
  | { type: "ended"; grade: RunResult["grade"] }
  // → streamer
  | { type: "viewerCount"; realViewers: number }
  | { type: "realHype"; fromHandle: string; taps: number }
  | { type: "realChat"; fromHandle: string; preset: QuickChatId }
  | { type: "realGift"; fromHandle: string; tier: GiftTier; atRunSec: number }
  | { type: "voteTally"; pollId: string; tally: number[] };

// ——— Phase 7 — The Feed (03 §6.5) ———
// 7.5 REWORK: videos modify clicker MECHANICS, not stats (01 §8.3, table 04 §13.5).
export type FeedModId =
  | "ring_slow" | "extra_ring" | "wide_window"   // beat_sync mods
  | "duet_flow" | "core_surge" | "wave_rush";    // duet/core/scheduler mods

export type VideoCard = {
  videoId: string;           // client-generated uuid (like streamId)
  handle: string;            // poster handle (or NPC name)
  creatorLevel: number;
  topic: string;             // trend topic at post time
  captionId: string;         // preset caption template id — NEVER free text
  mod: FeedModId;            // rolled at publish time (was `boost: FeedBoostId` pre-7.5)
  postedAt: number;          // ms epoch — SERVER-stamped on postVideo
  tapCount: number;          // global engagement counter — SERVER-owned
  npc?: boolean;             // server-generated filler (no royalties)
};

// Lobby room — Phase 7 message additions (merge into LobbyClientMessage in 7.3):
export type LobbyClientMessageFeed =
  | { type: "postVideo"; card: VideoCard }
  | { type: "getFeed" }
  | { type: "engage"; videoId: string; taps: number };

export type LobbyServerMessageFeed =
  | { type: "feed"; cards: VideoCard[] }
  | { type: "videoPosted"; card: VideoCard }
  | { type: "royalty"; videoId: string; fromHandle: string; taps: number };
