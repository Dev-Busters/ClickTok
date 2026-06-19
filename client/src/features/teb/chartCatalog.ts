import type { SequenceDef, SequenceId } from "./types";

export const CHART_CATALOG = {
  tap_three: {
    id: "tap_three", name: "TAP THREE", gestureHint: "tap",
    nodes: [
      { id: 1, kind: "tap", hitAtMs: 900 },
      { id: 2, kind: "tap", hitAtMs: 1450 },
      { id: 3, kind: "tap", hitAtMs: 2000 },
    ],
  },
  hold_pulse: {
    id: "hold_pulse", name: "HOLD THE BEAT", gestureHint: "hold",
    nodes: [
      { id: 1, kind: "hold", hitAtMs: 850, durationMs: 600 },
      { id: 2, kind: "hold", hitAtMs: 1900, durationMs: 1000 },
    ],
  },
  swipe_chain: {
    id: "swipe_chain", name: "CONNECT", gestureHint: "swipe",
    nodes: [
      { id: 1, kind: "swipe", hitAtMs: 850, toId: 2 },
      { id: 2, kind: "swipe", hitAtMs: 1100, toId: 3 },
      { id: 3, kind: "swipe", hitAtMs: 1350, toId: 4 },
      { id: 4, kind: "swipe", hitAtMs: 1600, toId: 4 },
    ],
  },
  trace_arc: {
    id: "trace_arc", name: "RIDE THE LINE", gestureHint: "trace",
    nodes: [{ id: 1, kind: "trace", hitAtMs: 850, durationMs: 2100 }],
  },
} as const satisfies Record<SequenceId, SequenceDef>;

export const ALL_SEQUENCES = Object.keys(CHART_CATALOG) as SequenceId[];

export function refillShuffleBag(previous: SequenceId | null, random: () => number = Math.random, eligible: readonly SequenceId[] = ALL_SEQUENCES): SequenceId[] {
  const bag = [...eligible];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  if (previous && bag.length > 1 && bag[0] === previous) [bag[0], bag[1]] = [bag[1], bag[0]];
  return bag;
}

export function pickSequence(bag: SequenceId[], previous: SequenceId | null, eligible: readonly SequenceId[] = ALL_SEQUENCES): { sequence: SequenceId; bag: SequenceId[] } {
  const allowed = new Set(eligible);
  const nextBag = bag.filter(sequence => allowed.has(sequence));
  if (nextBag.length === 0) nextBag.push(...refillShuffleBag(previous, Math.random, eligible));
  const sequence = nextBag.shift() ?? "tap_three";
  return { sequence, bag: nextBag };
}
