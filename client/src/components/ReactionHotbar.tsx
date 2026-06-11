import { motion } from "framer-motion";
import { useGameStore } from "../store";
import { REACTION_CATALOG, REACTION_ICON } from "../features/livestream/reactions";

export function ReactionHotbar() {
  const reactions = useGameStore(s => s.params?.reactions ?? []);
  const cooldowns = useGameStore(s => s.cooldowns);
  const useReaction = useGameStore(s => s.useReaction);

  return (
    <div style={{ display: "flex", justifyContent: "center", gap: "12px", padding: "10px 16px 18px" }}>
      {reactions.map(id => {
        const cooldown = cooldowns[id];
        const total = REACTION_CATALOG[id].cooldownSec;
        const ready = cooldown <= 0;
        const frac = ready ? 0 : Math.min(1, cooldown / total);
        return (
          <motion.button
            key={id}
            whileTap={ready ? { scale: 0.85 } : undefined}
            onClick={() => useReaction(id)}
            disabled={!ready}
            title={REACTION_CATALOG[id].description}
            style={{
              position: "relative",
              width: "54px",
              height: "54px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.1)",
              border: ready ? "1.5px solid rgba(255,255,255,0.25)" : "1.5px solid transparent",
              borderRadius: "50%",
              cursor: ready ? "pointer" : "default",
              boxShadow: ready ? "0 0 14px rgba(255,255,255,0.08)" : "none",
              overflow: "hidden",
            }}
          >
            <span style={{ fontSize: "24px", lineHeight: 1, opacity: ready ? 1 : 0.45 }}>
              {REACTION_ICON[id]}
            </span>
            {!ready && (
              <>
                {/* Radial cooldown sweep */}
                <div style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: `conic-gradient(rgba(0,0,0,0.72) ${frac * 360}deg, transparent 0deg)`,
                }} />
                <span style={{
                  position: "absolute",
                  fontFamily: "var(--font-mono)",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#fff",
                  textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                }}>
                  {Math.ceil(cooldown)}
                </span>
              </>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
