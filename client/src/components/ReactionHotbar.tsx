import { motion } from "framer-motion";
import { useGameStore } from "../store";
import { REACTION_CATALOG, REACTION_ICON } from "../features/livestream/reactions";

export function ReactionHotbar() {
  const reactions = useGameStore(s => s.params?.reactions ?? []);
  const cooldowns = useGameStore(s => s.cooldowns);
  const useReaction = useGameStore(s => s.useReaction);

  return (
    <div style={{ display: "flex", justifyContent: "center", gap: "10px", padding: "10px 16px 18px" }}>
      {reactions.map(id => {
        const cooldown = cooldowns[id];
        const ready = cooldown <= 0;
        return (
          <motion.button
            key={id}
            whileTap={ready ? { scale: 0.9 } : undefined}
            onClick={() => useReaction(id)}
            disabled={!ready}
            title={REACTION_CATALOG[id].description}
            style={{
              width: "52px",
              height: "52px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "2px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--dim)",
              borderRadius: "8px",
              opacity: ready ? 1 : 0.4,
              cursor: ready ? "pointer" : "default",
              color: "var(--text)",
            }}
          >
            <span style={{ fontSize: "20px" }}>{REACTION_ICON[id]}</span>
            {!ready && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--dim)" }}>
                {Math.ceil(cooldown)}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
