import type * as Party from "partykit/server";

// Types mirrored from client/src/party/types.ts — edit both together.

type GiftTier = "rose" | "heart" | "galaxy" | "lion";

type QuickChatId = "w" | "fire" | "icon" | "ratio" | "cooked" | "real_one";

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

type SpectatorEvent = {
  id: string;
  type: string;
  text?: string;
  giftTier?: GiftTier;
  real?: boolean;
  fromHandle?: string;
};

type RunSnapshot = {
  streamId: string;
  handle: string;
  topic: string;
  clockSec: number;
  durationSec: number;
  viewers: number;
  hype: number;
  modifiers: string[];
  newEvents: SpectatorEvent[];
};

type StreamPoll = {
  pollId: string;
  prompt: string;
  options: string[];
  closesAtSec: number;
};

type Grade = "S" | "A" | "B" | "C" | "D" | "FLOP";

type StreamClientMessage =
  // streamer →
  | { type: "open"; summary: LiveStreamSummary }
  | { type: "snapshot"; snap: RunSnapshot }
  | { type: "pollOpen"; poll: StreamPoll }
  | { type: "pollClose"; pollId: string; winningIndex: number }
  | { type: "shoutout"; handle: string; followers: number }
  | { type: "end"; grade: Grade; peakViewers: number }
  // viewer →
  | { type: "watch"; handle: string; creatorLevel: number }
  | { type: "hypeTap"; taps: number }
  | { type: "quickChat"; preset: QuickChatId }
  | { type: "sendGift"; tier: GiftTier }
  | { type: "vote"; pollId: string; choiceIndex: number };

type StreamServerMessage =
  | { type: "snapshot"; snap: RunSnapshot; realViewers: number }
  | { type: "poll"; poll: StreamPoll }
  | { type: "shoutout"; handle: string; followers: number }
  | { type: "ended"; grade: Grade }
  | { type: "viewerCount"; realViewers: number }
  | { type: "realHype"; fromHandle: string; taps: number }
  | { type: "realChat"; fromHandle: string; preset: QuickChatId }
  | { type: "realGift"; fromHandle: string; tier: GiftTier; atRunSec: number }
  | { type: "voteTally"; pollId: string; tally: number[] };

// 04 §12.7 — server hardening clamps (server-side only; not in client BALANCE)
const HARDEN = {
  maxTapsPerMsg: 8,               // tapMaxPerSec × tapBatchSec, ×2 slack for timer jitter
  minQuickChatIntervalMs: 2000,   // client cooldown is 3s; server allows slack
  maxFeedWatchSec: 60,            // max watchSec per feedAlgorithm message (lobby)
  maxFeedGiftCoins: 800,          // = lion, the largest single gift (lobby)
  minFeedIntervalMs: 1000,        // per-connection feedAlgorithm rate limit (lobby)
};

// Mirrored from BALANCE.social (04 §12.3); used for server-side shoutout recomputation.
const SHOUTOUT_FOLLOWERS_PER_LEVEL = 50;

// 6.6: whitelists for viewer-controlled enum fields — mirror client/src/party/types.ts
// (GiftTier) and client/src/hooks/useStreamRoom.ts QUICK_CHAT_TEXT keys (QuickChatId).
// Keep all three in sync.
const VALID_GIFT_TIERS: readonly GiftTier[] = ["rose", "heart", "galaxy", "lion"];
const VALID_QUICK_CHAT_PRESETS: readonly QuickChatId[] = ["w", "fire", "icon", "ratio", "cooked", "real_one"];

export default class StreamServer implements Party.Server {
  private streamerConnId: string | null = null;
  // Summary from the streamer's `open` message — used to recompute shoutout server-side.
  private streamerSummary: LiveStreamSummary | null = null;
  // connId → viewer handle
  private viewers = new Map<string, string>();
  private lastGrade: Grade | null = null;
  // Latest run clock from streamer snapshots (for atRunSec on real gifts)
  private latestClockSec = 0;
  // pollId → (connId → choiceIndex) — per-voter record for live tally computation
  private votesByPoll = new Map<string, Map<string, number>>();
  // 6.6: pollId → options.length for polls opened by the streamer and not yet closed —
  // bounds vote.choiceIndex and rejects votes for unknown/closed polls.
  private pollOptionCounts = new Map<string, number>();
  // connId → ms epoch of last quickChat (per-connection rate limit, 04 §12.7)
  private lastQuickChatMs = new Map<string, number>();
  // 4.5c-2: connection id → verified Supabase user.id (populated in onConnect via JWT)
  private connUserIds = new Map<string, string>();

  constructor(readonly party: Party.Room) {}

  // Mirrored from lobby.ts (04 §12.7); falls back to in-memory-only if unset.
  private supabaseConfig(): { url: string; key: string } | null {
    const env = this.party.env as Record<string, string | undefined>;
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    return url && key ? { url, key } : null;
  }

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // 4.5c-2: verify Supabase JWT if present — bind verified user.id to this connection.
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
        } catch {
          // token verification failed — connection continues as guest
        }
      }
    }
    // Client sends open/watch first; nothing else to push on bare connect.
  }

  private computeTally(pollId: string): number[] {
    const voterMap = this.votesByPoll.get(pollId);
    if (!voterMap) return [];
    const tally: number[] = [];
    for (const [, idx] of voterMap) {
      tally[idx] = (tally[idx] ?? 0) + 1;
    }
    return tally;
  }

  async onMessage(message: string, sender: Party.Connection) {
    try {
      const msg: StreamClientMessage = JSON.parse(message);
      const isStreamer = sender.id === this.streamerConnId;

      switch (msg.type) {

        // ——— Role pinning ————————————————————————————————————————————————————

        case "open":
          // First open wins until that connection closes.
          if (this.streamerConnId === null) {
            this.streamerConnId = sender.id;
            this.streamerSummary = msg.summary;
          } else if (this.streamerConnId === sender.id) {
            // Same connection re-opening — update summary (e.g., updated viewers).
            this.streamerSummary = msg.summary;
          }
          // else: a viewer attempting to hijack — silently drop.
          break;

        // ——— Streamer-only messages ——————————————————————————————————————————

        case "snapshot": {
          if (!isStreamer) break;
          this.latestClockSec = msg.snap.clockSec;
          const realViewers = this.viewers.size;
          const out: StreamServerMessage = { type: "snapshot", snap: msg.snap, realViewers };
          // Broadcast to all spectators (exclude the streamer).
          this.party.broadcast(JSON.stringify(out), [sender.id]);
          // Echo the current real-viewer count back to the streamer.
          sender.send(JSON.stringify({ type: "viewerCount", realViewers } satisfies StreamServerMessage));
          break;
        }

        case "end": {
          if (!isStreamer) break;
          this.lastGrade = msg.grade;
          // Clear poll state so stale votes from the ended run can't affect the next run.
          this.votesByPoll.clear();
          this.pollOptionCounts.clear();
          const out: StreamServerMessage = { type: "ended", grade: msg.grade };
          this.party.broadcast(JSON.stringify(out), [sender.id]);
          break;
        }

        case "pollOpen": {
          if (!isStreamer) break;
          // 6.6: record option count so `vote` can bound choiceIndex against this poll.
          this.pollOptionCounts.set(msg.poll.pollId, msg.poll.options.length);
          const out: StreamServerMessage = { type: "poll", poll: msg.poll };
          this.party.broadcast(JSON.stringify(out), [sender.id]);
          break;
        }

        case "pollClose": {
          if (!isStreamer) break;
          // Send final tally to ALL so spectators can claim vote-win rewards
          // (deviation from 03 §6 voteTally → streamer only; see 4.3 note).
          const tally = this.computeTally(msg.pollId);
          this.party.broadcast(JSON.stringify({
            type: "voteTally",
            pollId: msg.pollId,
            tally,
          } satisfies StreamServerMessage));
          this.votesByPoll.delete(msg.pollId);
          this.pollOptionCounts.delete(msg.pollId);
          break;
        }

        case "shoutout": {
          if (!isStreamer) break;
          // Recompute followers server-side from the pinned open summary (04 §12.7).
          // The client-sent `followers` value is ignored.
          const creatorLevel = this.streamerSummary?.creatorLevel ?? 1;
          const followers = SHOUTOUT_FOLLOWERS_PER_LEVEL * creatorLevel;
          const out: StreamServerMessage = { type: "shoutout", handle: msg.handle, followers };
          this.party.broadcast(JSON.stringify(out), [sender.id]);
          break;
        }

        // ——— Viewer-only messages ————————————————————————————————————————————

        case "watch": {
          if (isStreamer) break;
          this.viewers.set(sender.id, msg.handle);
          const streamer = this.streamerConnId
            ? this.party.getConnection(this.streamerConnId)
            : null;
          streamer?.send(
            JSON.stringify({ type: "viewerCount", realViewers: this.viewers.size } satisfies StreamServerMessage)
          );
          break;
        }

        case "hypeTap": {
          if (isStreamer) break;
          const streamer = this.streamerConnId
            ? this.party.getConnection(this.streamerConnId)
            : null;
          if (streamer) {
            // Clamp taps to prevent a forged high-tap message from flooding hype (04 §12.7).
            const taps = Math.min(Math.max(1, msg.taps), HARDEN.maxTapsPerMsg);
            streamer.send(JSON.stringify({
              type: "realHype",
              fromHandle: this.viewers.get(sender.id) ?? "?",
              taps,
            } satisfies StreamServerMessage));
          }
          break;
        }

        case "quickChat": {
          if (isStreamer) break;
          // 6.6: drop forged presets — only the known QUICK_CHAT_TEXT ids may be relayed.
          if (!VALID_QUICK_CHAT_PRESETS.includes(msg.preset)) break;
          const now = Date.now();
          const lastChat = this.lastQuickChatMs.get(sender.id) ?? 0;
          if (now - lastChat < HARDEN.minQuickChatIntervalMs) break;
          this.lastQuickChatMs.set(sender.id, now);
          const streamer = this.streamerConnId
            ? this.party.getConnection(this.streamerConnId)
            : null;
          if (streamer) {
            streamer.send(JSON.stringify({
              type: "realChat",
              fromHandle: this.viewers.get(sender.id) ?? "?",
              preset: msg.preset,
            } satisfies StreamServerMessage));
          }
          break;
        }

        case "sendGift": {
          if (isStreamer) break;
          // 6.6: drop forged tiers — an invented tier produces NaN coins client-side.
          if (!VALID_GIFT_TIERS.includes(msg.tier)) break;
          const streamer = this.streamerConnId
            ? this.party.getConnection(this.streamerConnId)
            : null;
          if (streamer) {
            streamer.send(JSON.stringify({
              type: "realGift",
              fromHandle: this.viewers.get(sender.id) ?? "?",
              tier: msg.tier,
              atRunSec: this.latestClockSec,
            } satisfies StreamServerMessage));
          }
          break;
        }

        case "vote": {
          if (isStreamer) break;
          // 6.6: only accept votes for polls opened by the streamer and not yet closed,
          // and bound choiceIndex against that poll's option count (prevents a
          // ~billion-slot sparse array in computeTally from a forged choiceIndex).
          const optionCount = this.pollOptionCounts.get(msg.pollId);
          if (optionCount === undefined) break;
          if (!Number.isInteger(msg.choiceIndex) || msg.choiceIndex < 0 || msg.choiceIndex >= optionCount) break;
          if (!this.votesByPoll.has(msg.pollId)) {
            this.votesByPoll.set(msg.pollId, new Map());
          }
          this.votesByPoll.get(msg.pollId)!.set(sender.id, msg.choiceIndex);
          const tally = this.computeTally(msg.pollId);
          // Deviation from 03 §6: broadcast to ALL (not streamer only) so spectators
          // see live tally bars and receive vote-win coin rewards.
          this.party.broadcast(JSON.stringify({
            type: "voteTally",
            pollId: msg.pollId,
            tally,
          } satisfies StreamServerMessage));
          break;
        }
      }
    } catch {
      // Malformed message — silently drop.
    }
  }

  async onClose(conn: Party.Connection) {
    this.connUserIds.delete(conn.id); // 4.5c-2: clean up verified identity
    this.lastQuickChatMs.delete(conn.id);
    if (conn.id === this.streamerConnId) {
      // Streamer disconnected — notify spectators with the last known grade or FLOP.
      const grade = this.lastGrade ?? "FLOP";
      this.party.broadcast(JSON.stringify({ type: "ended", grade } satisfies StreamServerMessage));
      this.streamerConnId = null;
      this.streamerSummary = null;
    } else if (this.viewers.has(conn.id)) {
      this.viewers.delete(conn.id);
      const streamer = this.streamerConnId
        ? this.party.getConnection(this.streamerConnId)
        : null;
      streamer?.send(
        JSON.stringify({ type: "viewerCount", realViewers: this.viewers.size } satisfies StreamServerMessage)
      );
    }
  }
}

StreamServer satisfies Party.Worker;
