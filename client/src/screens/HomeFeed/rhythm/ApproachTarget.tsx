import { motion, useReducedMotion } from "framer-motion";
import { BALANCE } from "../../../features/economy/balance";
import type { RuntimeNode } from "../../../features/teb/types";

export function ApproachTarget({ node, now, children }: { node: RuntimeNode; now: number; children?: React.ReactNode }) {
  const reduced = useReducedMotion();
  const r = BALANCE.teb.rhythm;
  const approach = Math.max(0, Math.min(1, 1 - (node.hitAt - now) / r.approachMs));
  const scale = r.approachStartScale + (1 - r.approachStartScale) * approach;
  const active = node.state === "active";
  return (
    <motion.div
      data-rhythm-node
      initial={{ opacity: 0, scale: reduced ? 1 : .8 }} animate={{ opacity: node.state === "missed" ? .28 : 1, scale: node.state === "resolved" ? .78 : 1 }}
      style={{ position: "absolute", left: `${node.pos.x * 100}%`, top: `${node.pos.y * 100}%`,
        width: r.targetDiameterPx, height: r.targetDiameterPx, marginLeft: -r.targetDiameterPx / 2, marginTop: -r.targetDiameterPx / 2,
        borderRadius: "50%", display: "grid", placeItems: "center", color: "white", fontFamily: "var(--font-display)", fontSize: 22,
        background: "radial-gradient(circle,rgba(255,255,255,.12),rgba(0,0,0,.72))", border: `2px solid ${active ? "white" : "rgba(255,255,255,.42)"}`,
        boxShadow: `${active ? "-3px 0 var(--cyan),3px 0 var(--red),0 0 18px rgba(255,210,0,.35)" : "-2px 0 rgba(37,244,238,.5),2px 0 rgba(255,31,75,.5)"}`,
        pointerEvents: "none", userSelect: "none" }}
    >
      {active && now <= node.hitAt + r.goodWindowMs && (
        <div style={{ position: "absolute", inset: -3, border: "2px solid var(--gold)", borderRadius: "50%", transform: `scale(${scale})`, opacity: .9, willChange: "transform" }} />
      )}
      {children ?? node.id}
    </motion.div>
  );
}
