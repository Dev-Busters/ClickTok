import type * as Party from "partykit/server";
import { PostHog } from "posthog-node";

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
  featured?: boolean;  // (6.1) lobby-generated sim filler card
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

// Phase 7 — The Feed (03 §6.5); unused server-side until 7.5b
// 7.5 REWORK: videos modify clicker MECHANICS, not stats (01 §8.3, table 04 §13.5).
type FeedModId =
  | "ring_slow" | "extra_ring" | "wide_window"
  | "duet_flow" | "core_surge" | "wave_rush";

type VideoCard = {
  videoId: string;
  handle: string;
  creatorLevel: number;
  topic: string;
  captionId: string;
  mod: FeedModId;
  postedAt: number;
  tapCount: number;
  npc?: boolean;
};

// (7.3) merge into LobbyClientMessage / LobbyServerMessage when wired
type _LobbyClientMessageFeed =
  | { type: "postVideo"; card: VideoCard }
  | { type: "getFeed" }
  | { type: "engage"; videoId: string; taps: number };

type _LobbyServerMessageFeed =
  | { type: "feed"; cards: VideoCard[] }
  | { type: "videoPosted"; card: VideoCard }
  | { type: "royalty"; videoId: string; fromHandle: string; taps: number };

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

// 04 §12.7 — server hardening clamps (server-side only; not in client BALANCE)
const HARDEN = {
  maxTapsPerMsg: 8,               // tapMaxPerSec × tapBatchSec, ×2 slack for timer jitter
  minQuickChatIntervalMs: 2000,   // client cooldown is 3s; server allows slack (stream room)
  maxFeedWatchSec: 60,            // max watchSec per feedAlgorithm message
  maxFeedGiftCoins: 800,          // = lion, the largest single gift
  minFeedIntervalMs: 1000,        // per-connection feedAlgorithm rate limit
};

// 04 §12.8 — featured sim streams (task 6.1): cold-start filler
const FEATURED_MIN_DIRECTORY = 3;
// Rotate one featured card every this many alarm ticks (30s × 6 = 3 min).
const FEATURED_ROTATE_EVERY = 6;

const FEATURED_HANDLES = [
  "dancer_pro", "cookmaster", "gamezilla", "comedyking", "fitqueen",
  "fashionstar", "musicvibe", "lifehackz", "petlover", "trendwatch",
  "sunsetvibes", "nightowl99",
];

// Periodic alarm so decay/rotation progress even with no live messages.
const ALARM_INTERVAL_MS = 30 * 1000;

// 4.5b: durable leaderboard, persisted to Supabase's `leaderboard_scores` table.
const LEADERBOARD_LOAD_LIMIT = 100;     // rows pulled into memory on startup
const LEADERBOARD_DISPLAY_LIMIT = 10;   // rows sent to clients per view
const PERSIST_MIN_INTERVAL_MS = 10 * 1000; // per-user write-through debounce
// 6.2: at most one leaderboard broadcast per 2s; trailing edge (state read at fire time).
const LEADERBOARD_DEBOUNCE_MS = 2 * 1000;

// 6.6: rough sanity ceiling for goLive/liveUpdate `viewers` at a given creatorLevel —
// 04 §6 startViewers = (baseStartViewers + followerSqrtCoeff*sqrt(F) + gear) × multipliers,
// where F maxes out around 10^creatorLevel (04 §12.0). ×10 leaves slack for gear/charisma/
// trend multipliers while still rejecting forged absurd numbers.
function maxViewersForLevel(creatorLevel: number): number {
  const level = Number.isFinite(creatorLevel) ? Math.max(1, Math.floor(creatorLevel)) : 1;
  const maxFollowers = Math.pow(10, level);
  const baseViewers = 10 + 0.5 * Math.sqrt(maxFollowers);
  return Math.round(baseViewers * 10);
}

// 6.6: clamp/sanitize a viewer-supplied LiveStreamSummary before it's stored and broadcast
// to the directory — a forged card otherwise shows absurd numbers (NaN, 1e9, etc.).
function sanitizeSummary(summary: LiveStreamSummary): LiveStreamSummary {
  const viewers = Number.isFinite(summary.viewers)
    ? Math.max(0, Math.min(summary.viewers, maxViewersForLevel(summary.creatorLevel)))
    : 0;
  const hype = Number.isFinite(summary.hype) ? Math.max(0, Math.min(100, summary.hype)) : 0;
  return { ...summary, viewers, hype };
}

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
  // 4.5c-2: connection id → verified Supabase user.id (populated in onConnect via JWT)
  private connUserIds = new Map<string, string>();
  // userId → ms epoch of last Supabase write (debounce)
  private lastPersist = new Map<string, number>();
  // connection id → ms epoch of last feedAlgorithm message (rate limit, 04 §12.7)
  private feedAlgoLastMs = new Map<string, number>();
  // 6.2: trailing-edge debounce for leaderboard broadcasts
  private leaderboardTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingTrendBroadcasts = new Set<string>();
  private trendLeaderboardTimer: ReturnType<typeof setTimeout> | null = null;

  private trends: TrendInfo[] = generateTrends();
  private rotatesAt = Date.now() + TREND_ROTATION_MS;

  private algoMeter = 0;
  private algoLastUpdate = Date.now();

  // (6.1) featured filler cards — generated at startup, drifted each alarm tick.
  private featuredCards: LiveStreamSummary[] = [];
  private alarmCount = 0;
  private ph: PostHog | null = null;

  constructor(readonly party: Party.Room) {
    const env = party.env as Record<string, string | undefined>;
    const apiKey = env.POSTHOG_API_KEY;
    if (apiKey) {
      this.ph = new PostHog(apiKey, {
        host: env.POSTHOG_HOST ?? "https://us.i.posthog.com",
        enableExceptionAutocapture: true,
      });
    }
  }

  async onStart() {
    this.featuredCards = this.generateFeaturedCards(FEATURED_MIN_DIRECTORY);
    await this.party.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
    await this.loadLeaderboard();
  }

  async onAlarm() {
    const now = Date.now();
    this.decayAlgo(now);
    const rotated = this.maybeRotateTrends(now);
    this.broadcastAlgorithm();
    if (rotated) this.broadcastTrends();

    // (6.1) Drift featured cards and occasionally rotate one out.
    this.alarmCount += 1;
    this.driftFeaturedCards();
    if (this.alarmCount % FEATURED_ROTATE_EVERY === 0) this.rotateFeaturedCard();
    this.broadcastDirectory();

    await this.party.storage.setAlarm(now + ALARM_INTERVAL_MS);
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // 4.5c-2: verify Supabase JWT if present — bind verified user.id to this connection.
    // Tokenless connections are guests: full gameplay, in-memory leaderboard only, never persisted.
    const token = new URL(ctx.request.url).searchParams.get("token");
    if (token) {
      const config = this.supabaseConfig();
      if (config) {
        try {
          const res = await fetch(`${config.url}/auth/v1/user`, {
            headers: { apikey: config.key, Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const user = await res.json() as { id: string };
            if (user.id) this.connUserIds.set(conn.id, user.id);
          }
        } catch (err) {
          this.ph?.captureException(err, conn.id);
          // token verification failed — connection continues as guest
        }
      }
    }
    const now = Date.now();
    this.decayAlgo(now);
    this.maybeRotateTrends(now);

    // Send the current world state immediately so the new client has a picture.
    conn.send(JSON.stringify({
      type: "directory",
      streams: this.buildDirectory(),
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
    try {
      const msg: LobbyClientMessage = JSON.parse(message);
      const now = Date.now();

      switch (msg.type) {
        case "hello": {
          // 4.5c-2: use the JWT-verified id if present; never trust client-sent userId.
          // Key is bound once at hello; subsequent score messages cannot change it.
          const verifiedId = this.connUserIds.get(sender.id);
          const key = verifiedId ?? sender.id;
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
            userId: verifiedId,  // only set if JWT-verified; never from msg.userId
          });
          if (verifiedId) {
            this.ph?.identify({
              distinctId: verifiedId,
              properties: {
                $set: { handle: msg.handle, creator_level: msg.creatorLevel },
              },
            });
          }
          this.ph?.capture({
            distinctId: key,
            event: "player connected",
            properties: {
              handle: msg.handle,
              creator_level: msg.creatorLevel,
              authenticated: !!verifiedId,
            },
          });
          break;
        }

        case "goLive": {
          // Reject if this streamId is already owned by a different connection (04 §12.7).
          if (this.streams.has(msg.summary.streamId)) {
            const ownerConnId = [...this.streamerConns.entries()]
              .find(([, sid]) => sid === msg.summary.streamId)?.[0];
            if (ownerConnId && ownerConnId !== sender.id) break; // hijack attempt — drop
          }
          this.streams.set(msg.summary.streamId, sanitizeSummary(msg.summary));
          this.streamerConns.set(sender.id, msg.summary.streamId);
          const ch = this.channels.get(this.connKeys.get(sender.id) ?? sender.id);
          if (ch) ch.live = true;
          this.broadcastDirectory();
          this.bumpTrendHeat(now, msg.summary.topic);
          this.ph?.capture({
            distinctId: this.connUserIds.get(sender.id) ?? sender.id,
            event: "lobby stream started",
            properties: {
              stream_id: msg.summary.streamId,
              topic: msg.summary.topic,
              creator_level: msg.summary.creatorLevel,
              start_viewers: msg.summary.viewers,
            },
          });
          break;
        }

        case "liveUpdate":
          // Honor only when the sender owns this streamId (04 §12.7).
          if (this.streamerConns.get(sender.id) === msg.summary.streamId) {
            this.streams.set(msg.summary.streamId, sanitizeSummary(msg.summary));
            this.broadcastDirectory();
          }
          break;

        case "endLive": {
          // Honor only when the sender owns this streamId (04 §12.7).
          if (this.streamerConns.get(sender.id) !== msg.streamId) break;
          this.streams.delete(msg.streamId);
          this.streamerConns.delete(sender.id);
          const ch = this.channels.get(this.connKeys.get(sender.id) ?? sender.id);
          if (ch) ch.live = false;
          this.broadcastDirectory();
          this.ph?.capture({
            distinctId: this.connUserIds.get(sender.id) ?? sender.id,
            event: "lobby stream ended",
            properties: { stream_id: msg.streamId },
          });
          break;
        }

        case "score": {
          // 6.6: non-numeric followers/likes would become NaN in the leaderboard,
          // sort, and Supabase writes — drop the whole message.
          if (!Number.isFinite(msg.followers) || !Number.isFinite(msg.likes)) break;
          // Use the key bound at hello; ignore any score.userId switch attempt (04 §12.7).
          // 4.5c-2: ground-truth identity comes from the verified JWT, not client-sent fields.
          const key = this.connKeys.get(sender.id) ?? sender.id;
          const verifiedId = this.connUserIds.get(sender.id);
          const existing = this.channels.get(key);
          const ch: ChannelEntry = {
            id: key,
            handle: existing?.handle ?? "",
            followers: msg.followers,
            likes: msg.likes,
            rank: existing?.rank ?? 0,
            live: existing?.live,
            trend: msg.trend ?? existing?.trend,
            userId: verifiedId,  // 4.5c-2: only the JWT-verified id; never from msg.userId
          };
          this.channels.set(key, ch);
          this.broadcastLeaderboard();
          if (ch.trend) this.broadcastTrendLeaderboard(ch.trend);
          if (verifiedId) await this.persistScore(verifiedId, ch); // 4.5c-2: persist only verified
          break;
        }

        case "getTrendLeaderboard":
          sender.send(JSON.stringify({
            type: "trendLeaderboard",
            trend: msg.trend,
            channels: this.trendRankedChannels(msg.trend),
          } satisfies LobbyServerMessage));
          break;

        case "feedAlgorithm": {
          // 6.6: a non-numeric amount would poison Math.min into NaN below.
          if (!Number.isFinite(msg.amount)) break;
          // Per-connection rate limit (04 §12.7): drop excess messages.
          const lastFeed = this.feedAlgoLastMs.get(sender.id) ?? 0;
          if (now - lastFeed < HARDEN.minFeedIntervalMs) break;
          this.feedAlgoLastMs.set(sender.id, now);
          // Clamp unbounded amounts (04 §12.7).
          const rawAmount = msg.amount;
          const amount =
            msg.kind === "watchSec" ? Math.min(rawAmount, HARDEN.maxFeedWatchSec) :
            msg.kind === "giftCoins" ? Math.min(rawAmount, HARDEN.maxFeedGiftCoins) :
            rawAmount; // "streamStarted" — fixed value on the server, no exploit surface
          if (amount > 0) this.feedAlgorithm(now, msg.kind, amount);
          break;
        }
      }
    } catch {
      // Malformed message — silently drop.
    }
  }

  async onClose(conn: Party.Connection) {
    this.connUserIds.delete(conn.id); // 4.5c-2: clean up verified identity
    this.feedAlgoLastMs.delete(conn.id);

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
      // 6.2: flush any score skipped by the debounce so disconnect never drops the final values.
      await this.persistScore(ch.userId, ch, true);
    } else {
      // Guest entry, no stable identity — drop it like pre-4.5b behavior.
      this.channels.delete(key);
      this.broadcastLeaderboard();
    }
  }

  // (6.1) Generate a set of featured filler cards from the handle/topic pools.
  private generateFeaturedCards(count: number): LiveStreamSummary[] {
    const handles = shuffle(FEATURED_HANDLES);
    const topics = shuffle(TREND_POOL);
    return Array.from({ length: count }, (_, i) => {
      const creatorLevel = 2 + Math.floor(Math.random() * 3); // 2..4
      const startViewers = Math.round(10 * Math.pow(10, (creatorLevel - 1) * 0.5));
      return {
        streamId: `featured-${i}-${Math.random().toString(36).slice(2, 8)}`,
        handle: handles[i % handles.length],
        creatorLevel,
        topic: topics[i % topics.length],
        viewers: startViewers + Math.floor(Math.random() * startViewers),
        realViewers: 0,
        hype: 30 + Math.floor(Math.random() * 50),
        startedAt: Date.now() - Math.floor(Math.random() * 120_000),
        featured: true,
      };
    });
  }

  // (6.1) Slightly drift viewers/hype each alarm tick so the rail feels alive.
  private driftFeaturedCards() {
    this.featuredCards = this.featuredCards.map(c => ({
      ...c,
      hype: Math.min(90, Math.max(10, c.hype + (Math.random() - 0.45) * 6)),
      viewers: Math.max(5, Math.round(c.viewers * (1 + (Math.random() - 0.45) * 0.08))),
    }));
  }

  // (6.1) Replace the oldest card with a fresh one (keeps the pool rotating).
  private rotateFeaturedCard() {
    if (this.featuredCards.length === 0) return;
    const fresh = this.generateFeaturedCards(1);
    // Replace the first card (longest-standing) with the fresh one.
    this.featuredCards = [...this.featuredCards.slice(1), fresh[0]];
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
  // 6.2: force=true bypasses the debounce (used in onClose to flush trailing writes).
  private async persistScore(userId: string, ch: ChannelEntry, force = false) {
    const config = this.supabaseConfig();
    if (!config) return;
    const now = Date.now();
    const last = this.lastPersist.get(userId) ?? 0;
    if (!force && now - last < PERSIST_MIN_INTERVAL_MS) return;
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

  // (6.1) Pad real streams with featured fillers up to FEATURED_MIN_DIRECTORY.
  // Real streams always appear first; fillers fill remaining slots.
  private buildDirectory(): LiveStreamSummary[] {
    const real = [...this.streams.values()];
    if (real.length >= FEATURED_MIN_DIRECTORY) return real;
    const needed = FEATURED_MIN_DIRECTORY - real.length;
    return [...real, ...this.featuredCards.slice(0, needed)];
  }

  private broadcastDirectory() {
    this.party.broadcast(JSON.stringify({
      type: "directory",
      streams: this.buildDirectory(),
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

  // 6.2: debounced — at most one broadcast per LEADERBOARD_DEBOUNCE_MS; reads latest state at fire time.
  private broadcastLeaderboard() {
    if (this.leaderboardTimer !== null) return;
    this.leaderboardTimer = setTimeout(() => {
      this.leaderboardTimer = null;
      this.party.broadcast(JSON.stringify({
        type: "leaderboard",
        channels: this.rankedChannels(),
      } satisfies LobbyServerMessage));
    }, LEADERBOARD_DEBOUNCE_MS);
  }

  // 6.2: debounced — accumulates pending trends, fires once per LEADERBOARD_DEBOUNCE_MS.
  private broadcastTrendLeaderboard(trend: string) {
    this.pendingTrendBroadcasts.add(trend);
    if (this.trendLeaderboardTimer !== null) return;
    this.trendLeaderboardTimer = setTimeout(() => {
      this.trendLeaderboardTimer = null;
      for (const t of this.pendingTrendBroadcasts) {
        this.party.broadcast(JSON.stringify({
          type: "trendLeaderboard",
          trend: t,
          channels: this.trendRankedChannels(t),
        } satisfies LobbyServerMessage));
      }
      this.pendingTrendBroadcasts.clear();
    }, LEADERBOARD_DEBOUNCE_MS);
  }
}

LobbyServer satisfies Party.Worker;
