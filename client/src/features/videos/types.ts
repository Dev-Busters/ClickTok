/**
 * Authored videos — the player-created (and dev-authored) osu!-style charts that will
 * eventually populate the FYP. Distinct from `features/teb` charts, which are
 * procedurally generated from fixed sequence definitions; these are hand-placed and
 * serialisable so they can be committed, shared, and later served from the backend.
 */

export const VIDEO_FORMAT_VERSION = 1 as const;

/**
 * `tap`   — press the node when its approach ring closes.
 * `slide` — press-and-drag into this node from the previous one without lifting.
 *            The first node of a chart can never be a slide (nothing to slide from).
 */
export type AuthoredNodeKind = "tap" | "slide";

export type AuthoredNode = {
  /** 1-based play order; also the number rendered on the node. */
  id: number;
  kind: AuthoredNodeKind;
  /** Normalized playfield position, 0..1. Resolution-independent by design. */
  x: number;
  y: number;
  /** Milliseconds from chart start. */
  hitAtMs: number;
};

export type AuthoredVideo = {
  version: typeof VIDEO_FORMAT_VERSION;
  id: string;
  title: string;
  /** Creator handle shown on the FYP card. */
  authorHandle: string;
  description: string;
  /** Authoring aid: default spacing applied to newly placed nodes. */
  beatMs: number;
  nodes: AuthoredNode[];
  createdAt: number;
  updatedAt: number;
};

export type VideoJudgementLabel = "perfect" | "great" | "good" | "miss";

export type VideoJudgement = {
  nodeId: number;
  label: VideoJudgementLabel;
  quality: number;
  /** Signed timing error in ms (negative = early). */
  errorMs: number;
};

export type VideoScore = {
  judgements: VideoJudgement[];
  accuracy: number;
  maxCombo: number;
  counts: Record<VideoJudgementLabel, number>;
};
