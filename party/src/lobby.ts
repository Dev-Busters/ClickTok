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
  trend?: string;
};

type LobbyClientMessage =
  | { type: "hello"; handle: string; creatorLevel: number; userId?: string }
  | { type: "goLive"; summary: LiveStreamSummary }
  | { type: "liveUpdate"; summary: LiveStreamSummary }
  | { type: "endLive"; streamId: string }
  | { type: "score"; followers: number; likes: number; userId?: string; trend?: string }
  | { type: "getTrendLeaderboard"; trend: string }
  | { type: "feedAlgorithm"; kind: "streamStarted" | "watchSec" | "giftCoins"; amount: number };

type LobbyServerMessage =
  | { type: "directory"; streams: LiveStreamSummary[] }
  | { type: "trends"; trends: TrendInfo[]; rotatesAt: number }
  | { type: "leaderboard"; channels: ChannelSummary[] }
  | { type: "trendLeaderboard"; trend: string; channels: ChannelSummary[] }
  | { type: "algorithm"; state: AlgorithmState };

// 4.5b: a channel entry, keyed by the Supabase `userId` when known (durable
// across reconnects/restarts) or the PartyKit connection id for guests
// (ephemeral, dropped on disconnect like pre-4.5b behavior).
type ChannelEntry = ChannelSummary & { userId?: string };

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

// 4.5b: durable leaderboard, persisted to Supabase's `leaderboard_scores` table.
const LEADERBOARD_LOAD_LIMIT = 100;     // rows pulled into memory on startup
const LEADERBOARD_DISPLAY_LIMIT = 10;   // rows sent to clients per view
const PERSIST_MIN_INTERVAL_MS = 10 * 1000; // per-user write-through debounce

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
  // leaderboard key (userId, or connection id for guests) → entry
  // (4.4: leaderboard moves into the lobby; 4.5b: persisted in Supabase)
  private channels = new Map<string, ChannelEntry>();
  // connection id → leaderboard key, so onMessage/onClose can find the entry
  private connKeys = new Map<string, string>();
  // userId → ms epoch of last Supabase write (debounce)
  private lastPersist = new Map<string, number>();

  private trends: TrendInfo[] = generateTrends();
  private rotatesAt = Date.now() + TREND_ROTATION_MS;

  private algoMeter = 0;
  private algoLastUpdate = Date.now();

  constructor(readonly party: Party.Room) {}

  async onStart() {
    await this.party.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
    await this.loadLeaderboard();
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
      case "hello": {
        // 4.5b: key by the stable Supabase userId when known, so a reconnect
        // (or a restart that reloaded from Supabase) finds the same entry.
        const key = msg.userId ?? sender.id;
        this.connKeys.set(sender.id, key);
        const existing = this.channels.get(key);
        this.channels.set(key, {
          id: key,
          handle: msg.handle,
          followers: existing?.followers ?? 0,
          likes: existing?.likes ?? 0,
          rank: existing?.rank ?? 0,
          live: existing?.live,
          trend: existing?.trend,
          userId: msg.userId,
        });
        break;
      }

      case "goLive": {
        this.streams.set(msg.summary.streamId, msg.summary);
        this.streamerConns.set(sender.id, msg.summary.streamId);
        const ch = this.channels.get(this.connKeys.get(sender.id) ?? sender.id);
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
        const ch = this.channels.get(this.connKeys.get(sender.id) ?? sender.id);
        if (ch) ch.live = false;
        this.broadcastDirectory();
        break;
      }

      case "score": {
        const key = msg.userId ?? this.connKeys.get(sender.id) ?? sender.id;
        this.connKeys.set(sender.id, key);
        const existing = this.channels.get(key);
        const ch: ChannelEntry = {
          id: key,
          handle: existing?.handle ?? "",
          followers: msg.followers,
          likes: msg.likes,
          rank: existing?.rank ?? 0,
          live: existing?.live,
          trend: msg.trend ?? existing?.trend,
          userId: msg.userId ?? existing?.userId,
        };
        this.channels.set(key, ch);
        this.broadcastLeaderboard();
        if (ch.trend) this.broadcastTrendLeaderboard(ch.trend);
        if (ch.userId) await this.persistScore(ch.userId, ch);
        break;
      }

      case "getTrendLeaderboard":
        sender.send(JSON.stringify({
          type: "trendLeaderboard",
          trend: msg.trend,
          channels: this.trendRankedChannels(msg.trend),
        } satisfies LobbyServerMessage));
        break;

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

    const key = this.connKeys.get(conn.id);
    this.connKeys.delete(conn.id);
    if (!key) return;
    const ch = this.channels.get(key);
    if (!ch) return;

    if (ch.userId) {
      // Durable entry — keep it in the leaderboard (persisted in Supabase),
      // just mark the channel offline.
      if (ch.live) {
        ch.live = false;
        this.broadcastDirectory();
      }
    } else {
      // Guest entry, no stable identity — drop it like pre-4.5b behavior.
      this.channels.delete(key);
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
      .slice(0, LEADERBOARD_DISPLAY_LIMIT)
      .map((ch, i): ChannelSummary => ({
        id: ch.id, handle: ch.handle, followers: ch.followers, likes: ch.likes,
        rank: i + 1, live: ch.live, trend: ch.trend,
      }));
    for (const ch of ranked) {
      const existing = this.channels.get(ch.id);
      if (existing) existing.rank = ch.rank;
    }
    return ranked;
  }

  // 4.5b: per-trend view (01 §7.4) — top channels currently on `trend`.
  private trendRankedChannels(trend: string): ChannelSummary[] {
    return [...this.channels.values()]
      .filter(ch => ch.trend === trend)
      .sort((a, b) => b.followers - a.followers)
      .slice(0, LEADERBOARD_DISPLAY_LIMIT)
      .map((ch, i): ChannelSummary => ({
        id: ch.id, handle: ch.handle, followers: ch.followers, likes: ch.likes,
        rank: i + 1, live: ch.live, trend: ch.trend,
      }));
  }

  // 4.5b: read-only Supabase REST helpers (service role; falls back to
  // in-memory-only if env vars aren't configured, mirroring `lib/supabase.ts`).
  private supabaseConfig(): { url: string; key: string } | null {
    const env = this.party.env as Record<string, string | undefined>;
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    return url && key ? { url, key } : null;
  }

  private async loadLeaderboard() {
    const config = this.supabaseConfig();
    if (!config) return;
    try {
      const res = await fetch(
        `${config.url}/rest/v1/leaderboard_scores?select=user_id,handle,followers,likes,trend&order=followers.desc&limit=${LEADERBOARD_LOAD_LIMIT}`,
        { headers: { apikey: config.key, Authorization: `Bearer ${config.key}` } },
      );
      if (!res.ok) return;
      const rows = await res.json() as {
        user_id: string; handle: string; followers: number; likes: number; trend: string | null;
      }[];
      for (const row of rows) {
        this.channels.set(row.user_id, {
          id: row.user_id,
          handle: row.handle,
          followers: row.followers,
          likes: row.likes,
          rank: 0,
          trend: row.trend ?? undefined,
          userId: row.user_id,
        });
      }
    } catch {
      // Supabase unreachable — leaderboard stays in-memory-only this session.
    }
  }

  // 4.5b: write-through, debounced per user so a restart never loses more
  // than ~PERSIST_MIN_INTERVAL_MS of progress.
  private async persistScore(userId: string, ch: ChannelEntry) {
    const config = this.supabaseConfig();
    if (!config) return;
    const now = Date.now();
    const last = this.lastPersist.get(userId) ?? 0;
    if (now - last < PERSIST_MIN_INTERVAL_MS) return;
    this.lastPersist.set(userId, now);
    try {
      await fetch(`${config.url}/rest/v1/leaderboard_scores`, {
        method: "POST",
        headers: {
          apikey: config.key,
          Authorization: `Bearer ${config.key}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          user_id: userId,
          handle: ch.handle,
          followers: Math.floor(ch.followers),
          likes: Math.floor(ch.likes),
          trend: ch.trend ?? null,
          updated_at: new Date(now).toISOString(),
        }),
      });
    } catch {
      // best-effort — in-memory leaderboard still works for this session.
    }
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

  private broadcastTrendLeaderboard(trend: string) {
    this.party.broadcast(JSON.stringify({
      type: "trendLeaderboard",
      trend,
      channels: this.trendRankedChannels(trend),
    } satisfies LobbyServerMessage));
  }
}

LobbyServer satisfies Party.Worker;
