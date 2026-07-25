import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Bubble, BubbleKind, BubbleMotion } from "../../features/onboarding/bubbles";
import { formatCount } from "../../lib/format";
import { useGameStore } from "../../store";

/**
 * Renders the engagement feed drifting bottom → top.
 *
 * Ambient kinds (comment/gift/hater) are large and live for ~5s, so popping one is a
 * glance-and-tap, never a reflex test. VIRAL letters are the deliberate exception: they
 * run faster and along one of five motion profiles, because collecting the whole word is
 * the only route to VIRAL and is meant to cost attention.
 */

const SKIN: Record<Exclude<BubbleKind, "viral_letter">, { icon: string; color: string; ring: string }> = {
  comment: { icon: "💬", color: "var(--cyan)", ring: "rgba(37,244,238,.5)" },
  gift:    { icon: "🎁", color: "var(--gold)", ring: "rgba(245,166,35,.6)" },
  hater:   { icon: "👺", color: "#b56cff",     ring: "rgba(181,108,255,.6)" },
};

const LETTER_SKIN = { color: "var(--gold)", ring: "rgba(255,210,0,.75)" };

function skinFor(kind: BubbleKind) {
  return kind === "viral_letter" ? LETTER_SKIN : SKIN[kind];
}

/**
 * Per-motion travel keyframes. `sway` is the bubble's own amplitude in normalized units;
 * everything is expressed as a transform so nothing here touches a layout property
 * (06 §3 perf rule). Lateral throw is capped well short of TEB's 188px centre disc.
 */
function travelKeyframes(motion: BubbleMotion, sway: number, travel: number) {
  switch (motion) {
    // Wide, slow S-curve — reads as "floating past" and is the easiest to read ahead of.
    case "sway":
      return { x: [0, sway * 300, -sway * 300, sway * 190, 0], y: [0, -travel], ease: "easeInOut" as const, yEase: "linear" as const };
    // Hard left/right steps. Predictable rhythm, but the target is never where it was.
    case "zigzag":
      return { x: [0, 24, -24, 24, -24, 0], y: [0, -travel], ease: "linear" as const, yEase: "linear" as const };
    // Straight line, accelerating away — the one that gets missed.
    case "dart":
      return { x: [0, 0], y: [0, -travel], ease: "linear" as const, yEase: "easeIn" as const };
    // Rises in stutters, hanging twice on the way up. Slow, but hard to time a stab at.
    case "bob":
      return { x: [0, -16, 12, -8, 0], y: [0, -travel * .34, -travel * .30, -travel * .74, -travel * .70, -travel], ease: "easeInOut" as const, yEase: "easeInOut" as const };
    default:
      return { x: [0, sway * 260, -sway * 200, 0], y: [0, -travel], ease: "easeInOut" as const, yEase: "linear" as const };
  }
}

type Pop = { id: number; kind: BubbleKind; text: string; color: string; x: number; y: number };

function BubbleView({ bubble, travel, onPop }: { bubble: Bubble; travel: number; onPop: (bubble: Bubble, x: number, y: number) => void }) {
  const reduced = useReducedMotion();
  const skin = skinFor(bubble.kind);
  const life = bubble.lifeMs / 1000;
  const isHater = bubble.kind === "hater";
  const isLetter = bubble.kind === "viral_letter";
  const path = travelKeyframes(reduced ? "float" : bubble.motion, bubble.sway, travel);
  const size = isLetter ? 50 : 54;

  return (
    <motion.button
      data-bubble={bubble.kind}
      data-letter={bubble.letter ?? undefined}
      aria-label={isLetter ? `Letter ${bubble.letter} — tap to collect` : `${bubble.kind} — tap to collect`}
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
        y: path.y,
        opacity: [0, 1, 1, 1, 0],
        scale: 1,
        x: reduced ? 0 : path.x,
      }}
      exit={{ opacity: 0, scale: 1.5, transition: { duration: .22 } }}
      transition={{
        y: { duration: life, ease: path.yEase },
        x: { duration: life, ease: path.ease },
        opacity: { duration: life, times: [0, .08, .5, .85, 1] },
        scale: { duration: .3, ease: "backOut" },
      }}
      style={{
        position: "absolute",
        left: `${bubble.x * 100}%`,
        bottom: -62,
        width: size, height: size, marginLeft: -size / 2,
        borderRadius: "50%",
        display: "grid", placeItems: "center",
        border: `${isLetter ? 2.5 : 2}px solid ${skin.ring}`,
        background: isLetter ? "rgba(28,20,2,.86)" : "rgba(8,10,15,.72)",
        boxShadow: isLetter ? `0 0 22px ${skin.ring}, inset 0 0 14px rgba(255,210,0,.22)` : `0 0 18px ${skin.ring}`,
        backdropFilter: "blur(2px)",
        cursor: "pointer",
        touchAction: "none",
        pointerEvents: "auto",
        padding: 0,
        willChange: "transform",
      }}
    >
      {isLetter ? (
        <span style={{
          fontFamily: "var(--font-display)", fontSize: 26, lineHeight: 1,
          letterSpacing: ".02em", color: "var(--gold)",
          textShadow: "0 0 14px rgba(255,210,0,.9), 0 2px 4px rgba(0,0,0,.9)",
        }}>{bubble.letter}</span>
      ) : (
        <span style={{ fontSize: 25, lineHeight: 1, filter: "drop-shadow(0 1px 3px rgba(0,0,0,.7))" }}>{SKIN[bubble.kind as Exclude<BubbleKind, "viral_letter">].icon}</span>
      )}
      {/* Haters pulse so the one thing with a downside reads as urgent. */}
      {isHater && !reduced && (
        <motion.span
          aria-hidden
          animate={{ opacity: [.25, .75, .25], scale: [1, 1.22, 1] }}
          transition={{ duration: .9, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${SKIN.hater.color}` }}
        />
      )}
      {/* Letters get a matching halo so they read as "grab me" against the ambient feed. */}
      {isLetter && !reduced && (
        <motion.span
          aria-hidden
          animate={{ opacity: [.15, .6, .15], scale: [1, 1.28, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", inset: -5, borderRadius: "50%", border: "2px solid var(--gold)" }}
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
  const [viralBurst, setViralBurst] = useState(0);
  const [travel, setTravel] = useState(760);
  const fieldRef = useRef<HTMLDivElement>(null);
  const popTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    if (burstTimer.current) clearTimeout(burstTimer.current);
  }, []);

  const handlePop = (bubble: Bubble, x: number, y: number) => {
    const result = popBubble(bubble.id);
    if (!result) return;

    // First letter ever collected is what teaches the mechanic — same shape as the
    // rhythm reveal, which completes on the first hold rather than on a "GOT IT" click.
    if (result.letter) {
      const state = useGameStore.getState();
      const reveal = state.activeOnboardingReveal;
      if (reveal?.feature === "virality" && reveal.dismissed && !state.onboardingTeachesSeen.virality_first_letter) {
        state.completeOnboardingTeach("virality_first_letter");
      }
    }

    const text = result.letter ? result.letter
      : result.coins > 0 ? `+${formatCount(result.coins)} 🪙`
      : `+${formatCount(result.followers)}`;
    const id = nextPopId.current++;
    setPops(current => [...current.slice(-5), { id, kind: result.kind, text, color: skinFor(result.kind).color, x, y }]);
    const timer = setTimeout(() => {
      setPops(current => current.filter(pop => pop.id !== id));
      popTimers.current.delete(id);
    }, 900);
    popTimers.current.set(id, timer);

    if (result.viralStarted) {
      setViralBurst(value => value + 1);
      if (burstTimer.current) clearTimeout(burstTimer.current);
      burstTimer.current = setTimeout(() => setViralBurst(0), 1600);
    }
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
              fontFamily: pop.kind === "viral_letter" ? "var(--font-display)" : "var(--font-mono)",
              fontSize: pop.kind === "viral_letter" ? 24 : 15, fontWeight: 900,
              color: pop.color,
              textShadow: `0 0 16px currentColor, 0 2px 4px rgba(0,0,0,.9)`,
            }}
          >{pop.text}</motion.div>
        ))}
      </AnimatePresence>

      {/* Completing V·I·R·A·L — the payoff moment, so it gets the whole screen. */}
      <AnimatePresence>
        {viralBurst > 0 && (
          <motion.div
            key={`viral-burst-${viralBurst}`}
            data-viral-burst
            initial={{ opacity: 0, scale: .5 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [.5, 1.15, 1, 1.05] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{
              position: "absolute", left: "50%", top: "38%", translate: "-50% -50%",
              zIndex: 45, pointerEvents: "none", textAlign: "center", whiteSpace: "nowrap",
              fontFamily: "var(--font-display)", fontSize: 34, letterSpacing: ".08em",
              color: "var(--gold)",
              textShadow: "0 0 30px currentColor, 0 0 48px rgba(255,210,0,.9), 0 2px 6px rgba(0,0,0,.9)",
            }}
          >
            🔥 GOING VIRAL
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
