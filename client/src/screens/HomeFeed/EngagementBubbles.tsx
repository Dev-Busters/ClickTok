import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BALANCE } from "../../features/economy/balance";
import type { Bubble, BubbleKind } from "../../features/onboarding/bubbles";
import { formatCount } from "../../lib/format";
import { useGameStore } from "../../store";

/**
 * Renders the engagement feed drifting bottom → top. Targets are large and live for
 * ~5s, so popping one is a glance-and-tap, never a reflex test.
 */

const SKIN: Record<BubbleKind, { icon: string; color: string; ring: string }> = {
  like:    { icon: "❤️", color: "var(--red)",  ring: "rgba(255,31,75,.55)" },
  comment: { icon: "💬", color: "var(--cyan)", ring: "rgba(37,244,238,.5)" },
  gift:    { icon: "🎁", color: "var(--gold)", ring: "rgba(245,166,35,.6)" },
  hater:   { icon: "👺", color: "#b56cff",     ring: "rgba(181,108,255,.6)" },
};

type Pop = { id: number; kind: BubbleKind; text: string; x: number; y: number };

function BubbleView({ bubble, travel, onPop }: { bubble: Bubble; travel: number; onPop: (bubble: Bubble, x: number, y: number) => void }) {
  const reduced = useReducedMotion();
  const skin = SKIN[bubble.kind];
  const life = BALANCE.onboarding.bubbles.lifetimeMs / 1000;
  const isHater = bubble.kind === "hater";

  return (
    <motion.button
      data-bubble={bubble.kind}
      aria-label={`${bubble.kind} — tap to collect`}
      onPointerDown={event => {
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        onPop(bubble, rect.left + rect.width / 2, rect.top);
      }}
      // Transform-only travel (06 §3 perf rule): the bubble is anchored just below the
      // play area and driven upward with `y`, never an animated layout property.
      initial={{ y: 0, opacity: 0, scale: .6 }}
      animate={{
        y: -travel,
        opacity: [0, 1, 1, 1, 0],
        scale: 1,
        x: reduced ? 0 : [0, bubble.sway * 260, -bubble.sway * 200, 0],
      }}
      exit={{ opacity: 0, scale: 1.5, transition: { duration: .22 } }}
      transition={{
        y: { duration: life, ease: "linear" },
        x: { duration: life, ease: "easeInOut" },
        opacity: { duration: life, times: [0, .08, .5, .85, 1] },
        scale: { duration: .3, ease: "backOut" },
      }}
      style={{
        position: "absolute",
        left: `${bubble.x * 100}%`,
        bottom: -62,
        width: 54, height: 54, marginLeft: -27,
        borderRadius: "50%",
        display: "grid", placeItems: "center",
        border: `2px solid ${skin.ring}`,
        background: "rgba(8,10,15,.72)",
        boxShadow: `0 0 18px ${skin.ring}`,
        backdropFilter: "blur(2px)",
        cursor: "pointer",
        touchAction: "none",
        pointerEvents: "auto",
        padding: 0,
        willChange: "transform",
      }}
    >
      <span style={{ fontSize: 25, lineHeight: 1, filter: "drop-shadow(0 1px 3px rgba(0,0,0,.7))" }}>{skin.icon}</span>
      {/* Haters pulse so the one thing with a downside reads as urgent. */}
      {isHater && !reduced && (
        <motion.span
          aria-hidden
          animate={{ opacity: [.25, .75, .25], scale: [1, 1.22, 1] }}
          transition={{ duration: .9, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${skin.color}` }}
        />
      )}
      {bubble.text && (
        <span style={{
          position: "absolute", top: "100%", marginTop: 4, whiteSpace: "nowrap",
          fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: ".04em",
          color: "rgba(255,255,255,.8)", textShadow: "0 1px 3px rgba(0,0,0,.9)",
          pointerEvents: "none",
        }}>{bubble.text}</span>
      )}
    </motion.button>
  );
}

export function EngagementBubbles() {
  const bubbles = useGameStore(s => s.openingBubbles);
  const popBubble = useGameStore(s => s.popOpeningBubble);
  const [pops, setPops] = useState<Pop[]>([]);
  const [travel, setTravel] = useState(760);
  const fieldRef = useRef<HTMLDivElement>(null);
  const popTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const nextPopId = useRef(0);

  // Measure the drift distance once (and on resize) so bubbles clear the top edge
  // regardless of viewport, without animating a layout property.
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const measure = () => setTravel(el.getBoundingClientRect().height + 130);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    popTimers.current.forEach(clearTimeout);
    popTimers.current.clear();
  }, []);

  const handlePop = (bubble: Bubble, x: number, y: number) => {
    const result = popBubble(bubble.id);
    if (!result) return;
    const text = result.coins > 0 ? `+${formatCount(result.coins)} 🪙` : `+${formatCount(result.followers)}`;
    const id = nextPopId.current++;
    setPops(current => [...current.slice(-5), { id, kind: result.kind, text, x, y }]);
    const timer = setTimeout(() => {
      setPops(current => current.filter(pop => pop.id !== id));
      popTimers.current.delete(id);
    }, 900);
    popTimers.current.set(id, timer);
  };

  return (
    <>
      {/* Drift layer sits behind TEB and only takes pointer events on the bubbles themselves. */}
      <div
        ref={fieldRef}
        data-engagement-feed
        aria-hidden={bubbles.length === 0}
        style={{ position: "absolute", inset: 0, zIndex: 4, overflow: "hidden", pointerEvents: "none" }}
      >
        <AnimatePresence>
          {bubbles.map(bubble => <BubbleView key={bubble.id} bubble={bubble} travel={travel} onPop={handlePop} />)}
        </AnimatePresence>
      </div>

      {/* Pop payouts are fixed-position so they float from wherever the bubble was tapped. */}
      <AnimatePresence>
        {pops.map(pop => (
          <motion.div
            key={`pop-${pop.id}`}
            initial={{ opacity: 0, scale: .5, y: 0 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [.5, 1.25, 1.05, 1], y: -54 }}
            exit={{ opacity: 0 }}
            transition={{ duration: .85, ease: "easeOut" }}
            style={{
              position: "fixed", left: pop.x, top: pop.y, translate: "-50% 0",
              zIndex: 40, pointerEvents: "none", whiteSpace: "nowrap",
              fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 900,
              color: SKIN[pop.kind].color,
              textShadow: `0 0 16px currentColor, 0 2px 4px rgba(0,0,0,.9)`,
            }}
          >{pop.text}</motion.div>
        ))}
      </AnimatePresence>
    </>
  );
}
