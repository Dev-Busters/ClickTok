import { AnimatePresence, motion } from "framer-motion";
import type { SpectatorEvent } from "../../party/types";

// ——— Spectator feed (read-only) ——————————————————————————————————————————————

const CHAT_NAMES = [
  "sk8rboi_22", "luvr.gurl", "xX_dr4gon_Xx", "mia.lol", "notyourbf",
  "pixel.pup", "ratio_king", "zoomin_zara", "yeet_lord", "chronically.on",
  "vibes0nly", "g0blincore", "sleepy.steve", "itsgigi", "fr_fr_no_cap",
];

const GIFT_EMOJI: Record<string, string> = {
  rose: "🌹", heart: "💗", galaxy: "🌌", lion: "🦁",
};

function eventHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
  return h;
}

function SpecFeedItem({ ev }: { ev: SpectatorEvent }) {
  const h = eventHash(ev.id);
  const name = ev.fromHandle ?? CHAT_NAMES[h % CHAT_NAMES.length];
  const hue = h % 360;
  const isReal = ev.real;

  if (ev.type === "gift" && ev.giftTier) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        style={{
          alignSelf: "flex-end",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "7px 13px",
          background: "rgba(0,0,0,0.55)",
          border: isReal ? "1px solid var(--cyan)" : "1px solid var(--gold)",
          borderRadius: "999px",
          boxShadow: isReal ? "0 0 12px rgba(37,244,238,0.3)" : "0 0 12px rgba(245,166,35,0.25)",
        }}
      >
        <span style={{ fontSize: "18px" }}>{GIFT_EMOJI[ev.giftTier] ?? "🎁"}</span>
        <span style={{ fontFamily: "var(--font-ui)", fontSize: "12px", color: "#fff" }}>
          {ev.giftTier.charAt(0).toUpperCase() + ev.giftTier.slice(1)}
        </span>
        {isReal && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--cyan)" }}>
            @{name}
          </span>
        )}
      </motion.div>
    );
  }

  const danger = ev.type === "troll";
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      style={{
        alignSelf: "flex-start",
        maxWidth: "80%",
        display: "flex",
        alignItems: "flex-start",
        gap: "7px",
        padding: "6px 12px 6px 7px",
        background: "rgba(0,0,0,0.4)",
        borderRadius: "16px",
        border: isReal ? "1px solid rgba(37,244,238,0.4)" : "none",
        boxShadow: isReal ? "0 0 8px rgba(37,244,238,0.2)" : "none",
      }}
    >
      <div style={{
        width: "22px", height: "22px", flexShrink: 0,
        borderRadius: "50%",
        background: `linear-gradient(135deg, hsl(${hue},65%,50%), hsl(${(hue + 70) % 360},65%,38%))`,
      }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: 0 }}>
        <span style={{
          fontFamily: "var(--font-ui)", fontSize: "11px", fontWeight: 600,
          color: danger ? "var(--red)" : isReal ? "var(--cyan)" : "rgba(255,255,255,0.55)",
        }}>
          {isReal ? `@${name}` : name}
        </span>
        <span style={{
          fontFamily: "var(--font-ui)", fontSize: "13px",
          color: danger ? "var(--red)" : "#fff",
          lineHeight: 1.25,
        }}>
          {danger ? `😡 ${ev.text ?? ""}` : (ev.text ?? "")}
        </span>
      </div>
    </motion.div>
  );
}

export function SpectatorFeed({ events }: { events: SpectatorEvent[] }) {
  const nonWaves = events.filter(e => e.type !== "hype_wave");
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div style={{
        position: "absolute",
        left: "12px",
        right: "12px",
        bottom: "8px",
        maxHeight: "65%",
        display: "flex",
        flexDirection: "column-reverse",
        gap: "7px",
        overflow: "hidden",
        maskImage: "linear-gradient(180deg, transparent 0%, black 18%)",
        WebkitMaskImage: "linear-gradient(180deg, transparent 0%, black 18%)",
      }}>
        <AnimatePresence initial={false}>
          {[...nonWaves].reverse().map(ev => (
            <SpecFeedItem key={ev.id} ev={ev} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
