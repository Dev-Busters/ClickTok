import type * as Party from "partykit/server";

// Types mirrored from client/src/party/types.ts — edit both together.

type GiftTier = "rose" | "heart" | "galaxy" | "lion";

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
  | { type: "quickChat"; preset: string }
  | { type: "sendGift"; tier: GiftTier }
  | { type: "vote"; pollId: string; choiceIndex: number };

type StreamServerMessage =
  | { type: "snapshot"; snap: RunSnapshot; realViewers: number }
  | { type: "poll"; poll: StreamPoll }
  | { type: "shoutout"; handle: string; followers: number }
  | { type: "ended"; grade: Grade }
  | { type: "viewerCount"; realViewers: number }
  | { type: "realHype"; fromHandle: string; taps: number }
  | { type: "realChat"; fromHandle: string; preset: string }
  | { type: "realGift"; fromHandle: string; tier: GiftTier; atRunSec: number }
  | { type: "voteTally"; pollId: string; tally: number[] };

export default class StreamServer implements Party.Server {
  private streamerConnId: string | null = null;
  // connId → viewer handle
  private viewers = new Map<string, string>();
  private lastGrade: Grade | null = null;
  // Latest run clock from streamer snapshots (for atRunSec on real gifts)
  private latestClockSec = 0;
  // pollId → (connId → choiceIndex) — per-voter record for live tally computation
  private votesByPoll = new Map<string, Map<string, number>>();

  constructor(readonly party: Party.Room) {}

  async onConnect(_conn: Party.Connection) {
    // Client sends open/watch first; nothing to push on bare connect.
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
    const msg: StreamClientMessage = JSON.parse(message);

    switch (msg.type) {
      case "open":
        this.streamerConnId = sender.id;
        break;

      case "snapshot": {
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
        this.lastGrade = msg.grade;
        const out: StreamServerMessage = { type: "ended", grade: msg.grade };
        this.party.broadcast(JSON.stringify(out), [sender.id]);
        break;
      }

      case "watch": {
        this.viewers.set(sender.id, msg.handle);
        const streamer = this.streamerConnId
          ? this.party.getConnection(this.streamerConnId)
          : null;
        streamer?.send(
          JSON.stringify({ type: "viewerCount", realViewers: this.viewers.size } satisfies StreamServerMessage)
        );
        break;
      }

      // ——— Viewer interaction (4.3) ————————————————————————————————————————

      case "hypeTap": {
        const streamer = this.streamerConnId
          ? this.party.getConnection(this.streamerConnId)
          : null;
        if (streamer) {
          streamer.send(JSON.stringify({
            type: "realHype",
            fromHandle: this.viewers.get(sender.id) ?? "?",
            taps: msg.taps,
          } satisfies StreamServerMessage));
        }
        break;
      }

      case "quickChat": {
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
        if (!this.votesByPoll.has(msg.pollId)) {
          this.votesByPoll.set(msg.pollId, new Map());
        }
        this.votesByPoll.get(msg.pollId)!.set(sender.id, msg.choiceIndex);
        const tally = this.computeTally(msg.pollId);
        // Deviation from 03 §6 (voteTally → streamer only): broadcast to ALL so
        // spectators can display live tally bars and receive vote-win rewards.
        this.party.broadcast(JSON.stringify({
          type: "voteTally",
          pollId: msg.pollId,
          tally,
        } satisfies StreamServerMessage));
        break;
      }

      case "pollOpen": {
        // Streamer opened a choice event as a poll — broadcast to spectators only.
        const out: StreamServerMessage = { type: "poll", poll: msg.poll };
        this.party.broadcast(JSON.stringify(out), [sender.id]);
        break;
      }

      case "pollClose": {
        // Streamer resolved the choice. Send final tally to ALL so spectators can
        // claim vote-win rewards (deviation: spec sends voteTally → streamer only).
        const tally = this.computeTally(msg.pollId);
        this.party.broadcast(JSON.stringify({
          type: "voteTally",
          pollId: msg.pollId,
          tally,
        } satisfies StreamServerMessage));
        this.votesByPoll.delete(msg.pollId);
        break;
      }

      case "shoutout": {
        // Streamer shouts out top gifter — broadcast to all spectators.
        const out: StreamServerMessage = { type: "shoutout", handle: msg.handle, followers: msg.followers };
        this.party.broadcast(JSON.stringify(out), [sender.id]);
        break;
      }
    }
  }

  async onClose(conn: Party.Connection) {
    if (conn.id === this.streamerConnId) {
      // Streamer disconnected — notify spectators with the last known grade or FLOP.
      const grade = this.lastGrade ?? "FLOP";
      this.party.broadcast(JSON.stringify({ type: "ended", grade } satisfies StreamServerMessage));
      this.streamerConnId = null;
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
