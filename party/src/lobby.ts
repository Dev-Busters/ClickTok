import type * as Party from "partykit/server";

// Types mirrored from client/src/party/types.ts — edit both together.

type AlgorithmTier = "STARVED" | "FED" | "BLESSED";
type AlgorithmState = { meter: number; tier: AlgorithmTier };

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
  | { type: "trends"; trends: { topic: string; heat: number }[]; rotatesAt: number }
  | { type: "leaderboard"; channels: ChannelSummary[] }
  | { type: "algorithm"; state: AlgorithmState };

export default class LobbyServer implements Party.Server {
  // streamId → summary for all currently-live streams
  private streams = new Map<string, LiveStreamSummary>();
  // connection id → streamId, so we can clean up on disconnect
  private streamerConns = new Map<string, string>();

  constructor(readonly party: Party.Room) {}

  async onConnect(conn: Party.Connection) {
    // Send the current directory immediately so the new client has a picture.
    conn.send(JSON.stringify({
      type: "directory",
      streams: [...this.streams.values()],
    } satisfies LobbyServerMessage));
  }

  async onMessage(message: string, sender: Party.Connection) {
    const msg: LobbyClientMessage = JSON.parse(message);

    switch (msg.type) {
      case "hello":
        // Presence acknowledgement; directory already sent in onConnect.
        break;

      case "goLive":
        this.streams.set(msg.summary.streamId, msg.summary);
        this.streamerConns.set(sender.id, msg.summary.streamId);
        this.broadcastDirectory();
        break;

      case "liveUpdate":
        if (this.streams.has(msg.summary.streamId)) {
          this.streams.set(msg.summary.streamId, msg.summary);
          this.broadcastDirectory();
        }
        break;

      case "endLive":
        this.streams.delete(msg.streamId);
        this.streamerConns.delete(sender.id);
        this.broadcastDirectory();
        break;

      // score and feedAlgorithm are for 4.4 — no-op for now.
      case "score":
      case "feedAlgorithm":
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
  }

  private broadcastDirectory() {
    this.party.broadcast(JSON.stringify({
      type: "directory",
      streams: [...this.streams.values()],
    } satisfies LobbyServerMessage));
  }
}

LobbyServer satisfies Party.Worker;
