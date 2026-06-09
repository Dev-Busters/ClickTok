// Shared types between client and PartyKit server — keep in sync with party/src/trend.ts

export type ChannelSummary = {
  id: string;
  handle: string;
  followers: number;
  likes: number;
  rank: number;
};

export type ClientMessage =
  | { type: "join"; handle: string }
  | { type: "score"; followers: number; likes: number };

export type ServerMessage =
  | { type: "state"; room: { topic: string; startsAt: number; endsAt: number; channels: Record<string, ChannelSummary> } }
  | { type: "leaderboard"; channels: ChannelSummary[] };
