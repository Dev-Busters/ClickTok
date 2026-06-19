import type { RuntimeNode, RhythmPointer } from "../../../features/teb/types";
import { ApproachTarget } from "./ApproachTarget";

export function TracePath({ node, pointer, now }: { node: RuntimeNode; pointer: RhythmPointer; now: number }) {
  const points = (node.path ?? []).map(p => `${p.x * 100},${p.y * 100}`).join(" ");
  const bead = node.path?.[Math.min((node.path?.length ?? 1) - 1, Math.floor(Math.max(0, Math.min(1, (now - node.hitAt) / Math.max(1, (node.releaseAt ?? node.hitAt) - node.hitAt))) * ((node.path?.length ?? 1) - 1)))];
  return <>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      <polyline points={points} fill="none" stroke="rgba(0,0,0,.78)" strokeWidth="8" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      <polyline points={points} fill="none" stroke="rgba(255,255,255,.72)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      <polyline points={points} fill="none" stroke="var(--cyan)" strokeOpacity=".8" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" pathLength="1" strokeDasharray={`${pointer?.pathCoverage ?? 0} 1`} />
    </svg>
    <ApproachTarget node={node} now={now}>▶</ApproachTarget>
    {bead && <div style={{ position: "absolute", left: `${bead.x * 100}%`, top: `${bead.y * 100}%`, width: 15, height: 15, margin: -7.5, borderRadius: "50%", background: "white", border: "3px solid #111", boxShadow: "0 0 9px var(--gold)", pointerEvents: "none" }} />}
  </>;
}
