import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useGameStore } from "../../store";
import { avatarGradient } from "../../lib/avatar";
import { formatCount } from "../../lib/format";

/**
 * The TikTok chrome around the opening chapter, laid out to mirror the real app:
 * a top tab row (LIVE · Following · For You · search), the creator rail down the right
 * edge, and the handle/caption block anchored hard against the bottom nav.
 *
 * In this chapter the "video" the player is watching is their own tutorial post, so the
 * avatar, handle and counters are the player's. This is deliberately the same furniture
 * a real FYP card will need, so when the feed pager lands the only thing that changes is
 * which video's data feeds it.
 */

// Deliberately promises nothing but the tap: the feed is empty until `meet_teb` unlocks
// comments, and a caption naming bubbles that aren't there yet reads as a broken game.
const DESCRIPTION = "welcome to your first post — tap THE ENGAGEMENT BUTTON to grow. the more you tap, the more the algorithm notices you.";

/* ── Rail glyphs ──────────────────────────────────────────────────────────────
   Filled white shapes, matching TikTok's rail. Sized to ~34px like the real app,
   with the drop shadow that keeps them legible over a bright video. */

const GLYPH_SHADOW = "drop-shadow(0 1px 3px rgba(0,0,0,.55))";

function HeartGlyph({ filled }: { filled: boolean }) {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" style={{ filter: GLYPH_SHADOW }}>
      <path
        d="M12 21s-7.5-4.7-9.5-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.5 12c-2 4.3-9.5 9-9.5 9Z"
        fill={filled ? "var(--red)" : "#fff"}
      />
    </svg>
  );
}

function CommentGlyph() {
  return (
    <svg width="33" height="33" viewBox="0 0 24 24" style={{ filter: GLYPH_SHADOW }}>
      <path d="M12 3c5 0 9 3.3 9 7.4 0 4.1-4 7.4-9 7.4a11 11 0 0 1-2.4-.3l-4.4 2.3a.5.5 0 0 1-.72-.55l.8-3.2C3.2 14.7 3 12.9 3 10.4 3 6.3 7 3 12 3Z" fill="#fff" />
    </svg>
  );
}

function BookmarkGlyph() {
  return (
    <svg width="31" height="31" viewBox="0 0 24 24" style={{ filter: GLYPH_SHADOW }}>
      <path d="M6.5 3h11a1.5 1.5 0 0 1 1.5 1.5v16a.7.7 0 0 1-1.1.58L12 17.1l-5.9 3.98A.7.7 0 0 1 5 20.5v-16A1.5 1.5 0 0 1 6.5 3Z" fill="#fff" />
    </svg>
  );
}

function ShareGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" style={{ filter: GLYPH_SHADOW }}>
      <path d="M13.4 4.3a.8.8 0 0 1 1.34-.58l7.1 6.7a.8.8 0 0 1 0 1.16l-7.1 6.7a.8.8 0 0 1-1.34-.58v-3.2c-4.6.1-7.9 1.5-10.2 4.6-.4.55-1.26.2-1.16-.47C2.9 12.4 6.9 8.6 13.4 8.1V4.3Z" fill="#fff" />
    </svg>
  );
}

function RailButton({ glyph, label, onClick, disabled }: {
  glyph: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
        background: "transparent", border: 0, padding: 0,
        cursor: disabled ? "default" : "pointer",
        touchAction: "manipulation",
      }}
    >
      {glyph}
      <span style={{
        fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 700,
        color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.6)",
      }}>{label}</span>
    </button>
  );
}

/* ── Top tab row ─────────────────────────────────────────────────────────────── */

export function FypTopBar() {
  return (
    <div
      data-fyp-topbar
      style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 48, zIndex: 12,
        display: "flex", alignItems: "center", padding: "0 12px",
        background: "linear-gradient(rgba(0,0,0,.55),transparent)",
        pointerEvents: "none",
      }}
    >
      {/* LIVE entry, top-left, exactly where TikTok puts it */}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ filter: GLYPH_SHADOW, flexShrink: 0 }}>
        <rect x="2.5" y="7" width="19" height="13" rx="2.5" />
        <path d="M7.5 3.5 12 7l4.5-3.5" />
        <path d="M10 11.5v4l3.5-2-3.5-2Z" fill="#fff" stroke="none" />
      </svg>

      {/* Centre tabs. "For You" is the live one; the rest are chrome until the feed lands. */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <TopTab label="Following" />
        <TopTab label="For You" active />
      </div>

      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" style={{ filter: GLYPH_SHADOW, flexShrink: 0 }}>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M20 20l-4.7-4.7" />
      </svg>
    </div>
  );
}

function TopTab({ label, active }: { label: string; active?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <span style={{
        fontFamily: "var(--font-ui)", fontSize: 15.5,
        fontWeight: active ? 800 : 600,
        color: active ? "#fff" : "rgba(255,255,255,.62)",
        textShadow: "0 1px 4px rgba(0,0,0,.7)",
      }}>{label}</span>
      {/* TikTok's short underline under the active tab, not a full-width one. */}
      <span aria-hidden style={{
        width: active ? 22 : 0, height: 2.5, borderRadius: 2,
        background: active ? "#fff" : "transparent",
      }} />
    </div>
  );
}

/* ── Rail + caption ──────────────────────────────────────────────────────────── */

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
          // Sits just above the nav like TikTok's rail — its bottom control (the record)
          // lines up with the caption block rather than floating mid-video.
          position: "absolute", right: 8, bottom: 14, zIndex: 7,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 15,
          pointerEvents: "auto",
        }}
      >
        {/* Avatar + follow badge */}
        <div style={{ position: "relative", marginBottom: 6 }}>
          <div style={{
            width: 46, height: 46, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: avatarGradient(handle || "creator"),
            border: "2px solid rgba(255,255,255,.95)",
            boxShadow: "0 2px 8px rgba(0,0,0,.5)",
          }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "#fff" }}>{initials}</span>
          </div>
          <div style={{
            position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)",
            width: 19, height: 19, borderRadius: "50%",
            background: "var(--red)",
            display: "grid", placeItems: "center",
            fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1,
          }}>+</div>
        </div>

        <motion.div
          animate={liked && !reduced ? { scale: [1, 1.35, 1] } : { scale: 1 }}
          transition={{ duration: .35, ease: "easeOut" }}
        >
          <RailButton
            glyph={<HeartGlyph filled={liked} />}
            label={formatCount(likeCount)}
            onClick={() => setLiked(v => !v)}
          />
        </motion.div>

        {/* Reserved for the real feed: inert until videos and comments exist. */}
        <RailButton glyph={<CommentGlyph />} label={formatCount(Math.floor(followers / 12))} disabled />
        <RailButton glyph={<BookmarkGlyph />} label={formatCount(Math.floor(followers / 40))} disabled />
        <RailButton glyph={<ShareGlyph />} label={formatCount(Math.floor(followers / 90))} disabled />

        {/* Spinning sound record — TikTok's rail always ends on it. */}
        <motion.div
          aria-hidden
          animate={reduced ? {} : { rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          style={{
            width: 42, height: 42, borderRadius: "50%", marginTop: 2,
            background: "radial-gradient(circle at 50% 50%, #2a2a2e 0 32%, #0a0a0c 33% 100%)",
            border: "5px solid #17171b",
            display: "grid", placeItems: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,.6)",
          }}
        >
          <span style={{ fontSize: 13, lineHeight: 1 }}>🎵</span>
        </motion.div>
      </div>

      {/* ── Bottom-left creator info ───────────────────────────────────────── */}
      <div
        data-fyp-caption
        style={{
          // TikTok anchors the handle/caption block hard against the bottom nav, not
          // partway up the video — keep the gap tight so the layout reads correctly.
          position: "absolute", left: 12, right: 76, bottom: 12, zIndex: 7,
          display: "flex", flexDirection: "column", gap: 5,
          pointerEvents: "none",
        }}
      >
        <span style={{
          fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 800, color: "#fff",
          textShadow: "0 1px 4px rgba(0,0,0,.85)",
        }}>@{handle}</span>
        <span style={{
          fontFamily: "var(--font-ui)", fontSize: 13, lineHeight: 1.4,
          color: "rgba(255,255,255,.96)", textShadow: "0 1px 4px rgba(0,0,0,.85)",
        }}>{DESCRIPTION}</span>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginTop: 2,
          fontFamily: "var(--font-ui)", fontSize: 12.5, color: "rgba(255,255,255,.94)",
          textShadow: "0 1px 4px rgba(0,0,0,.85)",
        }}>
          <span style={{ fontSize: 13 }}>♪</span>
          <span>original sound — @{handle}</span>
        </span>
      </div>
    </>
  );
}
