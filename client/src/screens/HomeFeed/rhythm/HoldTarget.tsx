import { ApproachTarget } from "./ApproachTarget";
import type { RuntimeNode } from "../../../features/teb/types";

export function HoldTarget({ node, now, activeSince }: { node: RuntimeNode; now: number; activeSince: number | null }) {
  const duration = Math.max(1, (node.releaseAt ?? node.hitAt) - node.hitAt);
  const fill = activeSince === null ? 0 : Math.max(0, Math.min(1, (now - activeSince) / duration));
  return <ApproachTarget node={node} now={now}>
    <div style={{ position: "absolute", inset: 7, borderRadius: "50%", background: `conic-gradient(var(--gold) ${fill * 360}deg,transparent 0)`, opacity: .72 }} />
    <span style={{ zIndex: 1 }}>{activeSince === null ? node.id : fill > .8 ? "UP" : "HOLD"}</span>
    {activeSince !== null && <div style={{ position: "absolute", inset: -10, borderRadius: "50%", border: "2px dashed var(--cyan)", transform: `scale(${1.4 - fill * .4})` }} />}
  </ApproachTarget>;
}
