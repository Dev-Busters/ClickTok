import { motion } from "framer-motion";
import type { RhythmJudgement } from "../../../features/teb/types";

export function JudgementBurst({ judgement }: { judgement: RhythmJudgement }) {
  const color = judgement.label === "perfect" ? "var(--gold)" : judgement.label === "great" ? "var(--cyan)" : judgement.label === "good" ? "white" : "rgba(255,255,255,.58)";
  return <motion.span initial={{ opacity: 1, scale: .75 }} animate={{ opacity: 0, scale: 1.18, y: -18 }} transition={{ duration: .42 }}
    style={{ position: "absolute", left: `${judgement.pos.x * 100}%`, top: `${judgement.pos.y * 100}%`, transform: "translate(-50%,-50%)", color,
      fontFamily: "var(--font-display)", fontSize: 17, letterSpacing: ".1em", textShadow: "0 2px 4px #000", pointerEvents: "none" }}>
    {judgement.label.toUpperCase()}
  </motion.span>;
}
