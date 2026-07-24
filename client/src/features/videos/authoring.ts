import { VIDEO_FORMAT_VERSION, type AuthoredNode, type AuthoredVideo, type VideoJudgementLabel } from "./types";

export const DEFAULT_BEAT_MS = 600;
/** Node radius as a fraction of the smaller playfield axis — keeps targets tappable. */
export const NODE_RADIUS_PX = 30;
/** Minimum gap between two nodes so numbers stay readable and taps unambiguous. */
export const MIN_NODE_GAP_PX = 68;

export const HIT_WINDOWS = { perfect: 60, great: 120, good: 200 } as const;

export function judgeVideoTiming(errorMs: number): { label: VideoJudgementLabel; quality: number } {
  const e = Math.abs(errorMs);
  if (e <= HIT_WINDOWS.perfect) return { label: "perfect", quality: 1 };
  if (e <= HIT_WINDOWS.great) return { label: "great", quality: 0.75 };
  if (e <= HIT_WINDOWS.good) return { label: "good", quality: 0.4 };
  return { label: "miss", quality: 0 };
}

export function emptyVideo(authorHandle: string, now: number): AuthoredVideo {
  return {
    version: VIDEO_FORMAT_VERSION,
    id: `vid_${now.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`,
    title: "untitled",
    authorHandle,
    description: "",
    beatMs: DEFAULT_BEAT_MS,
    nodes: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Re-numbers nodes to match their time order so ids are always the play order. */
export function renumber(nodes: AuthoredNode[]): AuthoredNode[] {
  return [...nodes]
    .sort((a, b) => a.hitAtMs - b.hitAtMs)
    .map((node, index) => ({
      ...node,
      id: index + 1,
      // A chart can't open on a slide — there is no previous node to slide from.
      kind: index === 0 && node.kind === "slide" ? "tap" : node.kind,
    }));
}

export function appendNode(video: AuthoredVideo, x: number, y: number): AuthoredVideo {
  const last = video.nodes[video.nodes.length - 1];
  const node: AuthoredNode = {
    id: video.nodes.length + 1,
    kind: "tap",
    x: clamp01(x),
    y: clamp01(y),
    hitAtMs: last ? last.hitAtMs + video.beatMs : video.beatMs,
  };
  return touch({ ...video, nodes: renumber([...video.nodes, node]) });
}

export function updateNode(video: AuthoredVideo, id: number, patch: Partial<AuthoredNode>): AuthoredVideo {
  const nodes = video.nodes.map(node => node.id === id ? { ...node, ...patch } : node);
  return touch({ ...video, nodes: renumber(nodes) });
}

export function removeNode(video: AuthoredVideo, id: number): AuthoredVideo {
  return touch({ ...video, nodes: renumber(video.nodes.filter(node => node.id !== id)) });
}

export function videoDurationMs(video: AuthoredVideo): number {
  const last = video.nodes[video.nodes.length - 1];
  return (last?.hitAtMs ?? 0) + HIT_WINDOWS.good + 600;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function touch(video: AuthoredVideo): AuthoredVideo {
  return { ...video, updatedAt: Date.now() };
}

export type VideoIssue = { level: "error" | "warning"; message: string };

/**
 * Authoring-time validation. Overlap is measured in pixels against the *actual*
 * playfield so a chart authored on a phone can't produce unhittable stacks on a tablet.
 */
export function validateVideo(video: AuthoredVideo, rect: { width: number; height: number }): VideoIssue[] {
  const issues: VideoIssue[] = [];
  if (video.nodes.length === 0) issues.push({ level: "error", message: "Chart has no nodes." });
  if (!video.title.trim()) issues.push({ level: "warning", message: "Give the video a title." });

  for (let i = 0; i < video.nodes.length; i++) {
    for (let j = i + 1; j < video.nodes.length; j++) {
      const a = video.nodes[i], b = video.nodes[j];
      // Only nodes that are on screen at the same time can actually collide.
      if (Math.abs(a.hitAtMs - b.hitAtMs) > 900) continue;
      const dist = Math.hypot((a.x - b.x) * rect.width, (a.y - b.y) * rect.height);
      if (dist < MIN_NODE_GAP_PX) {
        issues.push({ level: "warning", message: `Nodes ${a.id} and ${b.id} overlap.` });
      }
    }
  }

  for (let i = 1; i < video.nodes.length; i++) {
    const gap = video.nodes[i].hitAtMs - video.nodes[i - 1].hitAtMs;
    if (gap < 90) issues.push({ level: "error", message: `Nodes ${video.nodes[i - 1].id}→${video.nodes[i].id} are too close in time.` });
  }
  return issues;
}

export function serializeVideo(video: AuthoredVideo): string {
  return JSON.stringify(video, null, 2);
}

export function parseVideo(raw: string): AuthoredVideo | null {
  try {
    const parsed = JSON.parse(raw) as AuthoredVideo;
    if (parsed.version !== VIDEO_FORMAT_VERSION || !Array.isArray(parsed.nodes)) return null;
    return { ...parsed, nodes: renumber(parsed.nodes) };
  } catch {
    return null;
  }
}
