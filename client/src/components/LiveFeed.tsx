import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "../store";
import { GIFT_ICON } from "../features/livestream/events";
import type { RunEvent } from "../features/livestream/types";

const TIER_LABEL: Record<string, string> = {
  rose: "ROSE",
  heart: "HEART",
  galaxy: "GALAXY",
  lion: "LION",
};

function FeedItem({ event }: { event: RunEvent }) {
  const collectGift = useGameStore(s => s.collectGift);
  const ttl = event.expiresAt - event.spawnedAt;

  if (event.type === "gift" && event.giftTier) {
    return (
      <motion.button
        layout
        initial={{ opacity: 0, scale: 0.8, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.8 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => collectGift(event.id)}
        style={{
          alignSelf: "flex-end",
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 14px",
          background: "rgba(245,166,35,0.16)",
          border: "1px solid var(--gold)",
          borderRadius: "999px",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: "20px" }}>{GIFT_ICON[event.giftTier]}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.14em", color: "var(--gold)" }}>
          {TIER_LABEL[event.giftTier]} · TAP
        </span>
      </motion.button>
    );
  }

  if (event.type === "troll") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        style={{
          alignSelf: "flex-start",
          maxWidth: "78%",
          padding: "6px 10px",
          background: "rgba(255,31,75,0.12)",
          border: "1px solid var(--red)",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        <div style={{ fontFamily: "var(--font-ui)", fontSize: "12px", color: "var(--red)" }}>
          😡 {event.text}
        </div>
        <motion.div
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: ttl, ease: "linear" }}
          style={{ height: "2px", background: "var(--red)", marginTop: "4px" }}
        />
      </motion.div>
    );
  }

  // comment
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      style={{
        alignSelf: "flex-start",
        maxWidth: "78%",
        padding: "6px 10px",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "4px",
        fontFamily: "var(--font-ui)",
        fontSize: "12px",
        color: "var(--text)",
      }}
    >
      {event.text}
    </motion.div>
  );
}

export function LiveFeed() {
  const events = useGameStore(s => s.events);
  const rideWave = useGameStore(s => s.rideWave);

  const wave = events.find(e => e.type === "hype_wave" && !e.resolved);
  const feedItems = events.filter(e => e.type !== "hype_wave");

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <AnimatePresence>
        {wave && (
          <motion.button
            key={wave.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => rideWave(wave.id)}
            style={{
              position: "absolute",
              top: "8px",
              left: "12px",
              right: "12px",
              pointerEvents: "auto",
              padding: "10px",
              textAlign: "center",
              background: "linear-gradient(90deg, rgba(255,31,75,0.25), rgba(37,244,238,0.25))",
              border: "1px solid var(--cyan)",
              fontFamily: "var(--font-display)",
              fontSize: "16px",
              letterSpacing: "0.1em",
              color: "var(--text)",
              cursor: "pointer",
            }}
          >
            🌊 RIDE THE WAVE — TAP
          </motion.button>
        )}
      </AnimatePresence>

      <div style={{
        position: "absolute",
        left: "12px",
        right: "12px",
        bottom: "8px",
        maxHeight: "65%",
        display: "flex",
        flexDirection: "column-reverse",
        gap: "6px",
        overflow: "hidden",
      }}>
        <AnimatePresence initial={false}>
          {[...feedItems].reverse().map(event => (
            <FeedItem key={event.id} event={event} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
