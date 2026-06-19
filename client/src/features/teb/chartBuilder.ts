import { BALANCE } from "../economy/balance";
import { CHART_CATALOG } from "./chartCatalog";
import type { NodePos, PlayfieldRect, RhythmChart, RuntimeNode, SequenceId } from "./types";

const FALLBACKS: Record<SequenceId, NodePos[]> = {
  tap_three: [{ x: .25, y: .3 }, { x: .72, y: .5 }, { x: .34, y: .73 }],
  hold_pulse: [{ x: .28, y: .38 }, { x: .7, y: .67 }],
  swipe_chain: [{ x: .2, y: .68 }, { x: .38, y: .38 }, { x: .62, y: .62 }, { x: .8, y: .32 }],
  trace_arc: [{ x: .16, y: .67 }],
};

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function distancePx(a: NodePos, b: NodePos, rect: PlayfieldRect): number {
  return Math.hypot((a.x - b.x) * rect.width, (a.y - b.y) * rect.height);
}

export function isValidGeometry(points: NodePos[], rect: PlayfieldRect): boolean {
  const radius = Math.max(32, BALANCE.teb.rhythm.targetDiameterPx / 2);
  const xPad = (radius + 12) / rect.width;
  const yTop = (52 + radius) / rect.height;
  const yBottom = 1 - (28 + radius) / rect.height;
  return points.every((p, i) => p.x >= xPad && p.x <= 1 - xPad && p.y >= yTop && p.y <= yBottom &&
    points.every((q, j) => i === j || distancePx(p, q, rect) >= BALANCE.teb.rhythm.targetDiameterPx + 18));
}

function tracePath(seed: number): NodePos[] {
  const rand = mulberry32(seed ^ 0x51f15e);
  const flip = rand() > .5 ? 1 : -1;
  const count = BALANCE.teb.rhythm.traceSampleCount;
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return { x: .14 + .72 * t, y: .5 + flip * .22 * Math.sin(t * Math.PI * 2) };
  });
}

export function buildChart(sequence: SequenceId, seed: number, rect: PlayfieldRect): RhythmChart {
  const def = CHART_CATALOG[sequence];
  const rand = mulberry32(seed);
  let points: NodePos[] = [];
  for (let attempt = 0; attempt < BALANCE.teb.rhythm.layoutAttempts; attempt++) {
    points = def.nodes.map(() => ({ x: .14 + rand() * .72, y: .16 + rand() * .7 }));
    if (sequence === "trace_arc" || isValidGeometry(points, rect)) break;
  }
  if (sequence !== "trace_arc" && !isValidGeometry(points, rect)) points = FALLBACKS[sequence];
  if (sequence === "trace_arc") points = FALLBACKS.trace_arc;

  const nodes: RuntimeNode[] = def.nodes.map((node, index) => ({
    id: node.id,
    kind: node.kind,
    pos: points[index] ?? FALLBACKS[sequence][index] ?? { x: .5, y: .5 },
    hitAt: node.hitAtMs,
    releaseAt: "durationMs" in node ? node.hitAtMs + node.durationMs : null,
    path: node.kind === "trace" ? tracePath(seed) : node.kind === "swipe" ? points : null,
    state: index === 0 ? "active" : "upcoming",
    quality: null,
    completedAt: null,
  }));
  const durationMs = Math.max(...nodes.map(n => n.releaseAt ?? n.hitAt)) + BALANCE.teb.rhythm.goodWindowMs + 350;
  return { sequence, seed, durationMs, nodes };
}

export function offsetChart(chart: RhythmChart, epoch: number): RhythmChart {
  return { ...chart, nodes: chart.nodes.map(n => ({ ...n, hitAt: n.hitAt + epoch, releaseAt: n.releaseAt === null ? null : n.releaseAt + epoch })) };
}
