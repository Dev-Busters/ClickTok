import type { RuntimeNode, RhythmPointer } from "../../../features/teb/types";
import { ApproachTarget } from "./ApproachTarget";

export function SwipeChain({ nodes, pointer, now }: { nodes: RuntimeNode[]; pointer: RhythmPointer; now: number }) {
  const points = nodes.map(n => `${n.pos.x * 100},${n.pos.y * 100}`).join(" ");
  return <>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      <polyline points={points} fill="none" stroke="rgba(0,0,0,.75)" strokeWidth="3.8" vectorEffect="non-scaling-stroke" />
      <polyline points={points} fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {pointer && pointer.visitedNodeIds.length > 1 && <polyline points={nodes.slice(0, pointer.visitedNodeIds.length).map(n => `${n.pos.x * 100},${n.pos.y * 100}`).join(" ")} fill="none" stroke="var(--cyan)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />}
    </svg>
    {nodes.map(n => <ApproachTarget key={n.id} node={n} now={now}>{pointer?.visitedNodeIds.includes(n.id) ? "✓" : n.id}</ApproachTarget>)}
  </>;
}
