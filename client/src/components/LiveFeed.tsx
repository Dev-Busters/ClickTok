import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "../store";
import { GIFT_ICON } from "../features/livestream/events";
import { formatCount } from "../lib/format";
import type { RunEvent } from "../features/livestream/types";

const TIER_LABEL: Record<string, string> = {
  rose: "Rose",
  heart: "Heart",
  galaxy: "Galaxy",
  lion: "Lion",
};

// Cosmetic chat identities — hashed from the event id so each comment keeps
// a stable username/color while it lives in the feed.
const CHAT_NAMES = [
  "sk8rboi_22", "luvr.gurl", "xX_dr4gon_Xx", "mia.lol", "notyourbf",
  "pixel.pup", "ratio_king", "zoomin_zara", "yeet_lord", "chronically.on",
  "vibes0nly", "g0blincore", "sleepy.steve", "itsgigi", "fr_fr_no_cap",
];

function eventHash(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 9973;
  return hash;
}

function ChatPill({ id, children, danger, real, fromHandle }: { id: string; children: React.ReactNode; danger?: boolean; real?: boolean; fromHandle?: string }) {
  const h = eventHash(id);
  const name = real && fromHandle ? `@${fromHandle}` : CHAT_NAMES[h % CHAT_NAMES.length];
  const hue = h % 360;
  return (
    <div style={{
      alignSelf: "flex-start",
      maxWidth: "80%",
      display: "flex",
      alignItems: "flex-start",
      gap: "7px",
      padding: "6px 12px 6px 7px",
      background: "rgba(0,0,0,0.4)",
      borderRadius: "16px",
      border: real ? "1px solid rgba(37,244,238,0.4)" : "none",
      boxShadow: real ? "0 0 8px rgba(37,244,238,0.2)" : "none",
    }}>
      <div style={{
        width: "22px", height: "22px", flexShrink: 0,
        borderRadius: "50%",
        background: `linear-gradient(135deg, hsl(${hue},65%,50%), hsl(${(hue + 70) % 360},65%,38%))`,
      }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: 0 }}>
        <span style={{
          fontFamily: "var(--font-ui)", fontSize: "11px", fontWeight: 600,
          color: danger ? "var(--red)" : real ? "var(--cyan)" : "rgba(255,255,255,0.55)",
        }}>
          {name}
        </span>
        <span style={{ fontFamily: "var(--font-ui)", fontSize: "13px", color: danger ? "var(--red)" : "#fff", lineHeight: 1.25 }}>
          {children}
        </span>
      </div>
    </div>
  );
}

function FeedItem({ event }: { event: RunEvent }) {
  const collectGift = useGameStore(s => s.collectGift);
  const resolveChoice = useGameStore(s => s.resolveChoice);
  const ttl = event.expiresAt - event.spawnedAt;

  if (event.choices && event.choices.length > 0) {
    const accent = event.type === "sponsor" ? "var(--gold)" : "var(--cyan)";
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        style={{
          alignSelf: "stretch",
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          padding: "10px 12px",
          background: "rgba(0,0,0,0.55)",
          border: `1px solid ${accent}`,
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        <div style={{ fontFamily: "var(--font-ui)", fontSize: "13px", color: "#fff" }}>
          {event.text}
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          {event.choices.map((choice, i) => (
            <motion.button
              key={choice.label}
              whileTap={{ scale: 0.95 }}
              onClick={() => resolveChoice(event.id, i)}
              style={{
                flex: 1,
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.08em",
                color: accent,
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${accent}`,
                borderRadius: "999px",
                padding: "7px 8px",
                cursor: "pointer",
              }}
            >
              {choice.label}
            </motion.button>
          ))}
        </div>
        <motion.div
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: ttl, ease: "linear" }}
          style={{ height: "2px", background: accent, borderRadius: "1px" }}
        />
      </motion.div>
    );
  }

  if (event.type === "gift" && event.giftTier) {
    const accent = event.real ? "var(--cyan)" : "var(--gold)";
    return (
      <motion.button
        layout
        initial={{ opacity: 0, scale: 0.7, x: 24 }}
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
          background: "rgba(0,0,0,0.55)",
          border: `1px solid ${accent}`,
          borderRadius: "999px",
          boxShadow: event.real ? "0 0 18px rgba(37,244,238,0.35)" : "0 0 18px rgba(245,166,35,0.35)",
          cursor: "pointer",
        }}
      >
        <motion.span
          animate={{ scale: [1, 1.18, 1] }}
          transition={{ duration: 0.9, repeat: Infinity }}
          style={{ fontSize: "22px", lineHeight: 1 }}
        >
          {GIFT_ICON[event.giftTier]}
        </motion.span>
        <span style={{ fontFamily: "var(--font-ui)", fontSize: "13px", fontWeight: 700, color: "#fff" }}>
          {TIER_LABEL[event.giftTier]}
        </span>
        {event.real && event.fromHandle && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--cyan)" }}>
            @{event.fromHandle}
          </span>
        )}
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.14em", color: accent }}>
          TAP
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
        style={{ alignSelf: "flex-start", maxWidth: "80%", display: "flex", flexDirection: "column", gap: "3px" }}
      >
        <ChatPill id={event.id} danger>😡 {event.text}</ChatPill>
        <motion.div
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: ttl, ease: "linear" }}
          style={{ height: "2px", background: "var(--red)", borderRadius: "1px", marginLeft: "8px" }}
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
      style={{ alignSelf: "flex-start", maxWidth: "80%" }}
    >
      <ChatPill id={event.id} real={event.real} fromHandle={event.fromHandle}>{event.text}</ChatPill>
    </motion.div>
  );
}

// ── Ambient live-stage layer ───────────────────────────────────────────────────

type Mote = { id: number; x: number; y: number; dx: number; label: string; color: string };

const MOTE_CHOICES = [
  { label: "+follower", color: "var(--cyan)" },
  { label: "+coin",     color: "var(--gold)" },
  { label: "♥",         color: "var(--red)"  },
] as const;

function LiveAmbient() {
  const viewers = useGameStore(s => s.viewers);
  const hype    = useGameStore(s => s.hype);
  const [motes, setMotes] = useState<Mote[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    const iv = setInterval(() => {
      const c = MOTE_CHOICES[Math.floor(Math.random() * MOTE_CHOICES.length)];
      const id = nextId.current++;
      const mote: Mote = {
        id,
        x:  52 + Math.random() * 38,
        y:  50 + Math.random() * 35,
        dx: (Math.random() - 0.5) * 24,
        label: c.label,
        color: c.color,
      };
      setMotes(prev => [...prev.slice(-5), mote]);
      setTimeout(() => setMotes(prev => prev.filter(m => m.id !== id)), 2500);
    }, 1300);
    return () => clearInterval(iv);
  }, []);

  return (
    <>
      {/* Economy motes drifting up from right / gift zone */}
      {motes.map(m => (
        <motion.span
          key={m.id}
          initial={{ opacity: 0, y: 0, x: 0 }}
          animate={{ opacity: [0, 0.75, 0], y: -68, x: m.dx }}
          transition={{ duration: 2.5, ease: "easeOut" }}
          style={{
            position:      "absolute",
            left:          `${m.x}%`,
            top:           `${m.y}%`,
            fontFamily:    "var(--font-mono)",
            fontSize:      "11px",
            letterSpacing: "0.04em",
            color:         m.color,
            textShadow:    `0 0 8px ${m.color}`,
            pointerEvents: "none",
            whiteSpace:    "nowrap",
            userSelect:    "none",
          }}
        >
          {m.label}
        </motion.span>
      ))}

      {/* Right-edge live stats ticker */}
      <div style={{
        position:      "absolute",
        right:         6,
        top:           "22%",
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        gap:           "10px",
        opacity:       0.50,
        pointerEvents: "none",
        userSelect:    "none",
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(255,255,255,0.8)">
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6Z" />
          </svg>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "#fff" }}>
            {formatCount(viewers)}
          </span>
        </div>
        <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.15)" }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "7px", letterSpacing: "0.12em", color: "var(--red)" }}>
            HYPE
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--red)" }}>
            {Math.round(hype)}
          </span>
        </div>
      </div>
    </>
  );
}

// ── Main feed component ────────────────────────────────────────────────────────

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
            animate={{ opacity: 1, y: 0, scale: [1, 1.02, 1] }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ scale: { duration: 0.8, repeat: Infinity } }}
            whileTap={{ scale: 0.97 }}
            onClick={() => rideWave(wave.id)}
            style={{
              position: "absolute",
              top: "8px",
              left: "12px",
              right: "12px",
              pointerEvents: "auto",
              padding: "12px",
              textAlign: "center",
              background: "linear-gradient(90deg, rgba(255,31,75,0.35), rgba(37,244,238,0.35))",
              border: "1px solid var(--cyan)",
              borderRadius: "14px",
              fontFamily: "var(--font-display)",
              fontSize: "17px",
              letterSpacing: "0.1em",
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 0 24px rgba(37,244,238,0.25)",
            }}
          >
            🌊 RIDE THE WAVE — TAP
          </motion.button>
        )}
      </AnimatePresence>

      {/* Comments column: bottom-left, TikTok LIVE style. Leaves the right side
          clear for the heart rain + gift pills land flex-end above it. */}
      <div style={{
        position: "absolute",
        left: "12px",
        right: "64px",
        bottom: "8px",
        maxHeight: "62%",
        display: "flex",
        flexDirection: "column-reverse",
        gap: "7px",
        overflow: "hidden",
        maskImage: "linear-gradient(180deg, transparent 0%, black 18%)",
        WebkitMaskImage: "linear-gradient(180deg, transparent 0%, black 18%)",
      }}>
        <AnimatePresence initial={false}>
          {[...feedItems].reverse().map(event => (
            <FeedItem key={event.id} event={event} />
          ))}
        </AnimatePresence>
      </div>

      {/* Ambient layer: economy motes + right-edge stats ticker */}
      <LiveAmbient />
    </div>
  );
}
