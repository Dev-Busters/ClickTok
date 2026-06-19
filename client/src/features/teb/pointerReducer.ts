import { BALANCE } from "../economy/balance";
import type { NodePos, PointerInput, RhythmPointer } from "./types";

export type PointerAction =
  | { type: "down"; input: PointerInput; nodeId: number }
  | { type: "move"; input: PointerInput }
  | { type: "visit"; input: PointerInput; nodeId: number }
  | { type: "coverage"; input: PointerInput; coverage: number }
  | { type: "up"; pointerId: number }
  | { type: "cancel"; pointerId: number };

function thin<T>(samples: T[], cap: number): T[] {
  if (samples.length <= cap) return samples;
  return samples.filter((_, i) => i % 2 === 0).slice(-cap);
}

export function pointerReducer(pointer: RhythmPointer, action: PointerAction): RhythmPointer {
  if (action.type === "down") {
    if (pointer) return pointer;
    const { input, nodeId } = action;
    return { pointerId: input.pointerId, inputKind: input.inputKind ?? "pointer", nodeId, startedAt: input.at,
      start: input.pos, current: input.pos, visitedNodeIds: [nodeId], pathCoverage: 0, samples: [{ pos: input.pos, at: input.at }] };
  }
  if (!pointer) return pointer;
  if (action.type === "up" || action.type === "cancel") return pointer.pointerId === action.pointerId ? null : pointer;
  if (pointer.pointerId !== action.input.pointerId) return pointer;
  const samples = thin([...pointer.samples, { pos: action.input.pos, at: action.input.at }], BALANCE.teb.rhythm.maxPointerSamples);
  if (action.type === "visit") return { ...pointer, current: action.input.pos, samples,
    visitedNodeIds: pointer.visitedNodeIds.includes(action.nodeId) ? pointer.visitedNodeIds : [...pointer.visitedNodeIds, action.nodeId] };
  if (action.type === "coverage") return { ...pointer, current: action.input.pos, samples, pathCoverage: Math.max(pointer.pathCoverage, action.coverage) };
  return { ...pointer, current: action.input.pos, samples };
}

export function normalizedDistancePx(a: NodePos, b: NodePos, rect: { width: number; height: number }): number {
  return Math.hypot((a.x - b.x) * rect.width, (a.y - b.y) * rect.height);
}
