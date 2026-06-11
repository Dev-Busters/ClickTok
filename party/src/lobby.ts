import type * as Party from "partykit/server";

// Types mirrored from client/src/party/types.ts — edit both together.

type AlgorithmTier = "STARVED" | "FED" | "BLESSED";
type AlgorithmState = { meter: number; tier: AlgorithmTier };

type TrendInfo = { topic: string; heat: number };

type LiveStreamSummary = {
  streamId: string;
  handle: string;
  creatorLevel: number;
  topic: string;
  viewers: number;
  realViewers: number;
  hype: number;
  startedAt: number;
};

type ChannelSummary = {
  id: string;
  handle: string;
  followers: number;
  likes: number;
  rank: number;
  live?: boolean;
};

type LobbyClientMessage =
  | { type: "hello"; handle: string; creatorLevel: number }
  | { type: "goLive"; summary: LiveStreamSummary }
  | { type: "liveUpdate"; summary: LiveStreamSummary }
  | { type: "endLive"; streamId: string }
  | { type: "score"; followers: number; likes: number }
  | { type: "feedAlgorithm"; kind: "streamStarted" | "watchSec" | "giftCoins"; amount: number };

type LobbyServerMessage =
  | { type: "directory"; streams: LiveStreamSummary[] }
  | { type: "trends"; trends: TrendInfo[]; rotatesAt: number }
  | { type: "leaderboard"; channels: ChannelSummary[] }
  | { type: "algorithm"; state: AlgorithmState };

// Mirrored from client/src/features/social/trends.ts (04 §6: heat 0..1).
const TREND_POOL = [
  "dancing", "cooking", "gaming", "comedy", "fitness",
  "fashion", "music", "lifehacks", "pets", "trending",
];
const TRENDS_SHOWN = 5;

// 4.4: trend rotation moves server-side (was the client's 90s timer, 3.1).
const TREND_ROTATION_MS = 90 * 1000;
// Going live on a trend pushes its heat for everyone (01 §7.4).
const TREND_HEAT_BUMP = 0.05;

// 04 §12.5 — The Algorithm
const ALGO = {
  feedStreamStarted: 5,
  feedPerWatchSec: 0.05,
  feedPerGiftCoin: 1 / 25,
  halfLifeHours: 1,
  fedThreshold: 100,
  blessedThreshold: 400,
};

// Periodic alarm so decay/rotation progress even with no live messages.
const ALARM_INTERVAL_MS = 30 * 1000;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateTrends(): TrendInfo[] {
  return shuffle(TREND_POOL).slice(0, TRENDS_SHOWN).map(topic => ({ topic, heat: Math.random() }));
}

export default class LobbyServer implements Party.Server {
  // streamId → summary for all currently-live streams
  private streams = new Map<string, LiveStreamSummary>();
  // connection id → streamId, so we can clean up on disconnect
  private streamerConns = new Map<string, string>();
  // connection id → leaderboard entry (4.4: leaderboard moves into the lobby)
  private channels = new Map<string, ChannelSummary>();

  private trends: TrendInfo[] = generateTrends();
  private rotatesAt = Date.now() + TREND_ROTATION_MS;

  private algoMeter = 0;
  private algoLastUpdate = Date.now();

  constructor(readonly party: Party.Room) {}

  async onStart() {
    await this.party.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
  }

  async onAlarm() {
    const now = Date.now();
    this.decayAlgo(now);
    const rotated = this.maybeRotateTrends(now);
    this.broadcastAlgorithm();
    if (rotated) this.broadcastTrends();
    await this.party.storage.setAlarm(now + ALARM_INTERVAL_MS);
  }

  async onConnect(conn: Party.Connection) {
    const now = Date.now();
    this.decayAlgo(now);
    this.maybeRotateTrends(now);

    // Send the current world state immediately so the new client has a picture.
    conn.send(JSON.stringify({
      type: "directory",
      streams: [...this.streams.values()],
    } satisfies LobbyServerMessage));
    conn.send(JSON.stringify({
      type: "trends",
      trends: this.trends,
      rotatesAt: this.rotatesAt,
    } satisfies LobbyServerMessage));
    conn.send(JSON.stringify({
      type: "algorithm",
      state: this.algoState(),
    } satisfies LobbyServerMessage));
    if (this.channels.size > 0) {
      conn.send(JSON.stringify({
        type: "leaderboard",
        channels: this.rankedChannels(),
      } satisfies LobbyServerMessage));
    }
  }

  async onMessage(message: string, sender: Party.Connection) {
    const msg: LobbyClientMessage = JSON.parse(message);
    const now = Date.now();

    switch (msg.type) {
      case "hello":
        if (this.channels.has(sender.id)) {
          this.channels.get(sender.id)!.handle = msg.handle;
        } else {
          this.channels.set(sender.id, { id: sender.id, handle: msg.handle, followers: 0, likes: 0, rank: 0 });
        }
        break;

      case "goLive": {
        this.streams.set(msg.summary.streamId, msg.summary);
        this.streamerConns.set(sender.id, msg.summary.streamId);
        const ch = this.channels.get(sender.id);
        if (ch) ch.live = true;
        this.broadcastDirectory();
        this.bumpTrendHeat(now, msg.summary.topic);
        break;
      }

      case "liveUpdate":
        if (this.streams.has(msg.summary.streamId)) {
          this.streams.set(msg.summary.streamId, msg.summary);
          this.broadcastDirectory();
        }
        break;

      case "endLive": {
        this.streams.delete(msg.streamId);
        this.streamerConns.delete(sender.id);
        const ch = this.channels.get(sender.id);
        if (ch) ch.live = false;
        this.broadcastDirectory();
        break;
      }

      case "score": {
        const ch = this.channels.get(sender.id) ?? { id: sender.id, handle: "", followers: 0, likes: 0, rank: 0 };
        ch.followers = msg.followers;
        ch.likes = msg.likes;
        this.channels.set(sender.id, ch);
        this.broadcastLeaderboard();
        break;
      }

      case "feedAlgorithm":
        this.feedAlgorithm(now, msg.kind, msg.amount);
        break;
    }
  }

  async onClose(conn: Party.Connection) {
    const streamId = this.streamerConns.get(conn.id);
    if (streamId) {
      this.streams.delete(streamId);
      this.streamerConns.delete(conn.id);
      this.broadcastDirectory();
    }
    if (this.channels.delete(conn.id)) {
      this.broadcastLeaderboard();
    }
  }

  // 04 §12.5: meter ×0.5 every algoHalfLifeHours, applied lazily.
  private decayAlgo(now: number) {
    const elapsedHours = (now - this.algoLastUpdate) / 3_600_000;
    if (elapsedHours <= 0) return;
    this.algoMeter *= Math.pow(0.5, elapsedHours / ALGO.halfLifeHours);
    this.algoLastUpdate = now;
  }

  private feedAlgorithm(now: number, kind: "streamStarted" | "watchSec" | "giftCoins", amount: number) {
    this.decayAlgo(now);
    switch (kind) {
      case "streamStarted":
        this.algoMeter += ALGO.feedStreamStarted;
        break;
      case "watchSec":
        this.algoMeter += amount * ALGO.feedPerWatchSec;
        break;
      case "giftCoins":
        this.algoMeter += amount * ALGO.feedPerGiftCoin;
        break;
    }
    this.broadcastAlgorithm();
  }

  private algoState(): AlgorithmState {
    const meter = this.algoMeter;
    const tier: AlgorithmTier =
      meter >= ALGO.blessedThreshold ? "BLESSED" :
      meter >= ALGO.fedThreshold ? "FED" : "STARVED";
    return { meter: Math.round(meter * 10) / 10, tier };
  }

  private maybeRotateTrends(now: number): boolean {
    if (now < this.rotatesAt) return false;
    this.trends = generateTrends();
    this.rotatesAt = now + TREND_ROTATION_MS;
    return true;
  }

  private bumpTrendHeat(now: number, topic: string) {
    this.maybeRotateTrends(now);
    const idx = this.trends.findIndex(t => t.topic === topic);
    if (idx === -1) return;
    this.trends = this.trends.map((t, i) =>
      i === idx ? { ...t, heat: Math.min(1, t.heat + TREND_HEAT_BUMP) } : t
    );
    this.broadcastTrends();
  }

  private rankedChannels(): ChannelSummary[] {
    const ranked = [...this.channels.values()]
      .sort((a, b) => b.followers - a.followers)
      .map((ch, i) => ({ ...ch, rank: i + 1 }));
    for (const ch of ranked) {
      const existing = this.channels.get(ch.id);
      if (existing) existing.rank = ch.rank;
    }
    return ranked;
  }

  private broadcastDirectory() {
    this.party.broadcast(JSON.stringify({
      type: "directory",
      streams: [...this.streams.values()],
    } satisfies LobbyServerMessage));
  }

  private broadcastTrends() {
    this.party.broadcast(JSON.stringify({
      type: "trends",
      trends: this.trends,
      rotatesAt: this.rotatesAt,
    } satisfies LobbyServerMessage));
  }

  private broadcastAlgorithm() {
    this.party.broadcast(JSON.stringify({
      type: "algorithm",
      state: this.algoState(),
    } satisfies LobbyServerMessage));
  }

  private broadcastLeaderboard() {
    this.party.broadcast(JSON.stringify({
      type: "leaderboard",
      channels: this.rankedChannels(),
    } satisfies LobbyServerMessage));
  }
}

LobbyServer satisfies Party.Worker;
