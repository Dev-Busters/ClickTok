import type * as Party from "partykit/server";

export type ChannelSummary = {
  id: string;
  handle: string;
  followers: number;
  likes: number;
  rank: number;
};

export type TrendRoom = {
  topic: string;
  startsAt: number;
  endsAt: number;
  channels: Record<string, ChannelSummary>;
};

export type ClientMessage =
  | { type: "join"; handle: string }
  | { type: "score"; followers: number; likes: number };

export type ServerMessage =
  | { type: "state"; room: TrendRoom }
  | { type: "leaderboard"; channels: ChannelSummary[] };

const TREND_DURATION_MS = 5 * 60 * 1000; // 5 minutes per trend cycle

export default class TrendServer implements Party.Server {
  room: TrendRoom;

  constructor(readonly party: Party.Room) {
    const now = Date.now();
    this.room = {
      topic: party.id,
      startsAt: now,
      endsAt: now + TREND_DURATION_MS,
      channels: {},
    };
  }

  async onConnect(conn: Party.Connection) {
    conn.send(JSON.stringify({ type: "state", room: this.room } satisfies ServerMessage));
  }

  async onMessage(message: string, sender: Party.Connection) {
    const msg: ClientMessage = JSON.parse(message);

    if (msg.type === "join") {
      this.room.channels[sender.id] = {
        id: sender.id,
        handle: msg.handle,
        followers: 0,
        likes: 0,
        rank: 0,
      };
    }

    if (msg.type === "score") {
      const ch = this.room.channels[sender.id];
      if (!ch) return;
      ch.followers = msg.followers;
      ch.likes = msg.likes;
    }

    // Recompute ranks and broadcast leaderboard
    const ranked = Object.values(this.room.channels)
      .sort((a, b) => b.followers - a.followers)
      .map((ch, i) => ({ ...ch, rank: i + 1 }));

    // Persist updated ranks back
    for (const ch of ranked) this.room.channels[ch.id] = ch;

    const leaderboard: ServerMessage = { type: "leaderboard", channels: ranked };
    this.party.broadcast(JSON.stringify(leaderboard));
  }

  async onClose(conn: Party.Connection) {
    delete this.room.channels[conn.id];
  }
}

TrendServer satisfies Party.Worker;
