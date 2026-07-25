# 17 — Authored Video Charts & the Video Studio

> The player-created osu!-style charts that will populate the FYP. This is the **canonical
> format** — anything authoring, storing, serving or playing a video reads it from here.

## §0 — Status (read first)

**Built:** the chart format, the authoring editor, local persistence, JSON export, and a
playback engine that runs inside the Studio.

**Not built:** authored charts are **not wired into the game loop or the FYP**. They play
only in the Studio's own preview. Nothing consumes them yet. Do not assume otherwise.

## §1 — Why a separate system from `features/teb`

`features/teb` charts are *procedurally generated* from fixed `SequenceDef` node timings
with randomised positions. Authored charts are *hand-placed*, serialisable, and carry
per-node slide semantics the procedural engine's whole-chain swipe model cannot express.

**Locked decision:** authored playback lives in `screens/VideoStudio/ChartPreview.tsx`,
deliberately separate from the shipped TEB rhythm engine, so chart work can iterate without
destabilising the minigame that is already in players' hands. Unify only when the authored
format is stable *and* there is a reason to.

## §2 — The format

```ts
export const VIDEO_FORMAT_VERSION = 1;

export type AuthoredNodeKind = "tap" | "slide";

export type AuthoredNode = {
  id: number;        // 1-based play order; also the number drawn on the node
  kind: AuthoredNodeKind;
  x: number;         // normalized 0..1 — resolution-independent by design
  y: number;
  hitAtMs: number;   // ms from chart start
};

export type AuthoredVideo = {
  version: typeof VIDEO_FORMAT_VERSION;
  id: string;
  title: string;
  authorHandle: string;
  description: string;
  beatMs: number;    // authoring aid: spacing applied to newly placed nodes
  nodes: AuthoredNode[];
  createdAt: number;
  updatedAt: number;
};
```

**Node semantics:**

- `tap` — press the node as its approach ring closes.
- `slide` — press-and-drag *into* this node from the previous one without lifting.
  A chart can never open on a slide; `renumber()` coerces node 1 to `tap`.

**Invariants enforced by `authoring.ts`:**

- `renumber()` sorts by `hitAtMs` and reassigns ids, so **id order is always play order**.
- Positions are normalized and clamped to 0..1, so a chart authored on a phone plays
  correctly on any viewport.
- `validateVideo(video, rect)` measures overlap in **pixels against the real playfield**
  (only for nodes within 900ms of each other, since distant nodes cannot collide), and
  errors on sub-90ms gaps.

## §3 — Timing windows

`judgeVideoTiming(errorMs)` — signed error, negative = early:

| Window | Abs. error | Quality |
|---|---|---|
| perfect | ≤ 60ms | 1.0 |
| great | ≤ 120ms | 0.75 |
| good | ≤ 200ms | 0.4 |
| miss | > 200ms | 0 |

Approach rings open at `APPROACH_MS` (900ms) before the hit. Taps earlier than the good
window are **ignored, not punished** — an early stray tap should not eat a node.

## §4 — The Studio

Reachable at `?videoStudio=1`. **Intentionally not dev-gated**: base charts get authored
against the deployed build on a real phone, because touch timing only tells the truth on a
real device.

- Tap empty space to place a node (auto-timed at `previous + beatMs`); tap a node to select.
- Selected node: toggle `TAP`/`SLIDE`, nudge time ±25/±100ms, delete.
- `PLAY` runs the chart with live judgement, combo, and an accuracy summary.
- `SAVE` persists to localStorage; `EXPORT` copies JSON for committing as built-in content.

**Storage:** `clicktok-authored-videos`, a **separate localStorage key** from the save blob.
Charts are content, not progress — this keeps the format free to change without
`SAVE_VERSION` churn, and gives it a clean path to Supabase later.

## §5 — When these reach the FYP

Sequenced deliberately; do not skip ahead:

1. **Author base content first.** A feed of nothing is worse than no feed.
2. **Wire playback into the FYP pager** — the `FypFrame` chrome (`06` §14) already carries
   the per-video furniture; only the data source changes.
3. **Then multiplayer authoring** — player charts served from Supabase.

## §6 — Integrity note

Authored charts are the **strongest anti-cheat surface in the game** (`15` §3). Playback is
deterministic: chart + input trace ⇒ exactly one score. When the competitive ladder runs on
charts, the server can re-simulate a submitted trace and reject mismatches — something no
clicker metric allows. **Keep the judgement pipeline pure and shareable between client and
server; do not couple it to React state.**
