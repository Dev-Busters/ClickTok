import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useGameStore } from "../../store";
import { avatarGradient } from "../../lib/avatar";
import { formatCount } from "../../lib/format";

/**
 * The TikTok chrome around the opening chapter: creator rail on the right, handle and
 * description bottom-left. In this chapter the "video" the player is watching is their
 * own tutorial post, so the avatar and handle are the player's.
 *
 * This is deliberately the same furniture a real FYP card will need, so when the feed
 * pager lands the only thing that changes is which video's data feeds it.
 */

const DESCRIPTION = "welcome to your first post — tap THE ENGAGEMENT BUTTON to grow. keep tapping to go viral, and grab the likes and comments floating by.";

function RailButton({ icon, label, onClick, active, disabled }: {
  icon: string;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
        background: "transparent", border: 0, padding: 0,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        touchAction: "manipulation",
      }}
    >
      <span style={{
        fontSize: 30, lineHeight: 1,
        filter: active ? "drop-shadow(0 0 10px var(--red))" : "drop-shadow(0 1px 3px rgba(0,0,0,.7))",
        transition: "filter .25s",
      }}>{icon}</span>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
        color: "rgba(255,255,255,.9)", textShadow: "0 1px 3px rgba(0,0,0,.8)",
      }}>{label}</span>
    </button>
  );
}

export function FypFrame() {
  const handle = useGameStore(s => s.handle);
  const followers = useGameStore(s => s.wallet.followers);
  const viewsTotal = useGameStore(s => s.viewsTotal);
  const [liked, setLiked] = useState(false);
  const reduced = useReducedMotion();
  const initials = (handle || "?").slice(0, 2).toUpperCase();

  // Cosmetic counters that read off real progress, so the card feels like *your* post.
  const likeCount = liked ? viewsTotal + 1 : viewsTotal;

  return (
    <>
      {/* ── Right creator rail ─────────────────────────────────────────────── */}
      <div
        data-fyp-rail
        style={{
          position: "absolute", right: 10, bottom: 116, zIndex: 7,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
          pointerEvents: "auto",
        }}
      >
        {/* Avatar + follow badge */}
        <div style={{ position: "relative", marginBottom: 4 }}>
          <div style={{
            width: 46, height: 46, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: avatarGradient(handle || "creator"),
            border: "2px solid rgba(255,255,255,.9)",
            boxShadow: "0 2px 8px rgba(0,0,0,.5)",
          }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "#fff" }}>{initials}</span>
          </div>
          <div style={{
            position: "absolute", bottom: -7, left: "50%", transform: "translateX(-50%)",
            width: 18, height: 18, borderRadius: "50%",
            background: "var(--red)", border: "1.5px solid rgba(7,8,12,.9)",
            display: "grid", placeItems: "center",
            fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 900, color: "#fff", lineHeight: 1,
          }}>+</div>
        </div>

        <motion.div
          animate={liked && !reduced ? { scale: [1, 1.35, 1] } : { scale: 1 }}
          transition={{ duration: .35, ease: "easeOut" }}
        >
          <RailButton
            icon={liked ? "❤️" : "🤍"}
            label={formatCount(likeCount)}
            active={liked}
            onClick={() => setLiked(v => !v)}
          />
        </motion.div>

        {/* Reserved for the real feed: inert until videos and comments exist. */}
        <RailButton icon="💬" label={formatCount(Math.floor(followers / 12))} disabled />
        <RailButton icon="↪" label="SHARE" disabled />
      </div>

      {/* ── Bottom-left creator info ───────────────────────────────────────── */}
      <div
        data-fyp-caption
        style={{
          position: "absolute", left: 14, right: 78, bottom: 116, zIndex: 7,
          display: "flex", flexDirection: "column", gap: 6,
          pointerEvents: "none",
        }}
      >
        <span style={{
          fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 800, color: "#fff",
          textShadow: "0 1px 4px rgba(0,0,0,.85)",
        }}>@{handle}</span>
        <span style={{
          fontFamily: "var(--font-ui)", fontSize: 12.5, lineHeight: 1.45,
          color: "rgba(255,255,255,.94)", textShadow: "0 1px 4px rgba(0,0,0,.85)",
        }}>{DESCRIPTION}</span>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginTop: 1,
          fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,.85)",
          textShadow: "0 1px 4px rgba(0,0,0,.85)",
        }}>
          <span style={{ fontSize: 12 }}>♪</span>
          <span>original sound — @{handle}</span>
        </span>
      </div>
    </>
  );
}
