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
 * run faster and along one of five motion profiles, because spelling the word in order is
 * the only route to VIRAL and is meant to cost attention.
 *
 * ## Lane geometry (why the store doesn't own the x position)
 *
 * Bubbles must never travel under the creator rail — they'd be hard to hit and a stray
 * tap would fire a rail control instead (playtest 2026-07-25). They must also stay off
 * TEB, or a bubble tap reads as a TEB tap. TEB is centred and ~206px wide, so on a
 * 375–393px phone the only column wide enough for a 46px target is the strip to its
 * *left*; at 320px the gap on the right between TEB and the rail is about 2px.
 *
 * So: every bubble rides a single lane left of TEB, and the lane is computed here from
 * the measured play area rather than in the store, which can't see the viewport. The
 * store only supplies `lane` (0..1 within whatever the lane turns out to be).
 */

// TEB's *button* is 188px inside a 206px container; measuring against the button (94)
// rather than the container buys back ~9px of lane, which matters a lot when the whole
// lane is ~40px on a 375px phone.
const TEB_HALF_WIDTH = 94;
const RAIL_SAFE_PX = 70;      // rail width + margin; a hard backstop on the right
const EDGE_PAD = 5;

// 44px keeps the ambient kinds at Apple's minimum touch target. Letters are a hair
// smaller because they're the one kind that's supposed to take effort to catch.
const SIZE: Record<BubbleKind, number> = { comment: 44, gift: 44, hater: 44, viral_letter: 42 };

/** Colour stops each kind morphs through as it rises — the "flow" the feed was missing. */
const SKIN: Record<BubbleKind, { icon: string; color: string; ring: string[]; glow: string[]; fill: string }> = {
  comment: {
    icon: "💬", color: "var(--cyan)", fill: "rgba(8,14,20,.74)",
    ring: ["rgba(37,244,238,.55)", "rgba(90,170,255,.75)", "rgba(37,244,238,.55)"],
    glow: ["0 0 16px rgba(37,244,238,.45)", "0 0 26px rgba(90,170,255,.7)", "0 0 16px rgba(37,244,238,.45)"],
  },
  gift: {
    icon: "🎁", color: "var(--gold)", fill: "rgba(22,16,4,.76)",
    ring: ["rgba(245,166,35,.6)", "rgba(255,225,90,.85)", "rgba(245,166,35,.6)"],
    glow: ["0 0 16px rgba(245,166,35,.5)", "0 0 28px rgba(255,225,90,.8)", "0 0 16px rgba(245,166,35,.5)"],
  },
  hater: {
    icon: "👺", color: "#b56cff", fill: "rgba(16,8,22,.78)",
    ring: ["rgba(181,108,255,.6)", "rgba(255,80,160,.85)", "rgba(181,108,255,.6)"],
    glow: ["0 0 16px rgba(181,108,255,.5)", "0 0 28px rgba(255,80,160,.75)", "0 0 16px rgba(181,108,255,.5)"],
  },
  viral_letter: {
    icon: "", color: "var(--gold)", fill: "rgba(28,20,2,.86)",
    ring: ["rgba(255,210,0,.8)", "rgba(255,120,60,.95)", "rgba(255,60,140,.9)", "rgba(255,210,0,.8)"],
    glow: ["0 0 22px rgba(255,210,0,.7)", "0 0 34px rgba(255,120,60,.85)", "0 0 30px rgba(255,60,140,.8)", "0 0 22px rgba(255,210,0,.7)"],
  },
};

/**
 * Per-motion travel keyframes. Everything is a transform, so nothing here touches a
 * layout property (06 §3 perf rule).
 *
 * **Every profile keeps moving for its full life.** The first pass gave `bob` two hang
 * frames and faded bubbles out at 85% of their travel, which made them look like they
 * rose to a fixed height and parked there — a free tap. Vertical progress is now strictly
 * monotonic and the fade happens in the last few percent.
 */
function travelKeyframes(motion: BubbleMotion, amp: number, travel: number) {
  switch (motion) {
    // Wide, slow S-curve — reads as "floating past" and is the easiest to read ahead of.
    case "sway":
      return { x: [0, amp, -amp, amp * .6, -amp * .3], y: [0, -travel], ease: "easeInOut" as const, yEase: "linear" as const };
    // Hard left/right steps. Predictable rhythm, but never where it just was.
    case "zigzag":
      return { x: [0, amp, -amp, amp, -amp, amp * .5], y: [0, -travel], ease: "linear" as const, yEase: "linear" as const };
    // Straight line, accelerating away — the one that gets missed.
    case "dart":
      return { x: [0, amp * .15], y: [0, -travel], ease: "linear" as const, yEase: "easeIn" as const };
    // Rises in surges: still climbing throughout, but at a visibly uneven rate, so a
    // stab timed off the last surge lands short.
    case "bob":
      return {
        x: [0, -amp * .7, amp * .5, -amp * .35, amp * .2],
        y: [0, -travel * .30, -travel * .38, -travel * .72, -travel * .80, -travel],
        ease: "easeInOut" as const, yEase: "easeInOut" as const,
      };
    default:
      return { x: [0, amp, -amp * .75, amp * .4], y: [0, -travel], ease: "easeInOut" as const, yEase: "linear" as const };
  }
}

type Pop = { id: number; kind: BubbleKind; text: string; color: string; x: number; y: number };

function BubbleView({ bubble, travel, lane, onPop }: {
  bubble: Bubble;
  travel: number;
  lane: { start: number; width: number };
  onPop: (bubble: Bubble, x: number, y: number) => void;
}) {
  const reduced = useReducedMotion();
  const skin = SKIN[bubble.kind];
  const life = bubble.lifeMs / 1000;
  const isHater = bubble.kind === "hater";
  const isLetter = bubble.kind === "viral_letter";
  const size = SIZE[bubble.kind];

  // Sway is clamped to whatever room the lane actually has, so a hard-swinging letter on
  // a 320px screen still can't reach TEB or the rail.
  const amp = Math.min(bubble.sway * lane.width, lane.width) / 2;
  const left = lane.start + bubble.lane * lane.width;
  const path = travelKeyframes(reduced ? "float" : bubble.motion, reduced ? 0 : amp, travel);

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
      initial={{ y: 0, opacity: 0, scale: .6 }}
      animate={{
        y: path.y,
        // Fade only at the very end — anything earlier reads as "it stopped there".
        opacity: [0, 1, 1, 0],
        scale: 1,
        x: reduced ? 0 : path.x,
      }}
      exit={{ opacity: 0, scale: 1.5, transition: { duration: .22 } }}
      transition={{
        y: { duration: life, ease: path.yEase },
        x: { duration: life, ease: path.ease },
        opacity: { duration: life, times: [0, .06, .93, 1] },
        scale: { duration: .3, ease: "backOut" },
      }}
      style={{
        position: "absolute",
        left, bottom: -62,
        width: size, height: size, marginLeft: -size / 2,
        borderRadius: "50%",
        display: "grid", placeItems: "center",
        background: skin.fill,
        backdropFilter: "blur(2px)",
        border: 0,
        cursor: "pointer",
        touchAction: "none",
        pointerEvents: "auto",
        padding: 0,
        willChange: "transform",
      }}
    >
      {/* Trail — a soft streak that hangs below the bubble as it climbs. Sits in the
          button so it inherits the travel transform for free (no second animation). */}
      {!reduced && (
        <motion.span
          aria-hidden
          animate={{ opacity: [0, .55, .55, 0], scaleY: [.5, 1, 1, .7] }}
          transition={{ duration: life, times: [0, .1, .9, 1], ease: "linear" }}
          style={{
            position: "absolute", left: "50%", top: "58%", translate: "-50% 0",
            width: size * .42, height: size * 1.9, borderRadius: "50%",
            transformOrigin: "top center",
            background: `linear-gradient(to bottom, ${skin.color}, transparent 78%)`,
            filter: "blur(7px)", opacity: .5, pointerEvents: "none", zIndex: -1,
          }}
        />
      )}

      {/* The ring itself morphs colour as it rises — the "flow" the flat feed lacked. */}
      <motion.span
        aria-hidden
        animate={reduced ? {} : { borderColor: skin.ring, boxShadow: skin.glow }}
        transition={{ duration: life, ease: "linear", times: skin.ring.map((_, i, a) => i / (a.length - 1)) }}
        style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: `${isLetter ? 2.5 : 2}px solid ${skin.ring[0]}`,
          boxShadow: skin.glow[0],
        }}
      />

      {isLetter ? (
        <span style={{
          fontFamily: "var(--font-display)", fontSize: 24, lineHeight: 1,
          letterSpacing: ".02em", color: "var(--gold)",
          textShadow: "0 0 14px rgba(255,210,0,.9), 0 2px 4px rgba(0,0,0,.9)",
        }}>{bubble.letter}</span>
      ) : (
        <span style={{ fontSize: 23, lineHeight: 1, filter: "drop-shadow(0 1px 3px rgba(0,0,0,.7))" }}>{skin.icon}</span>
      )}

      {/* Haters pulse so the one thing with a downside reads as urgent. */}
      {isHater && !reduced && (
        <motion.span
          aria-hidden
          animate={{ opacity: [.25, .75, .25], scale: [1, 1.22, 1] }}
          transition={{ duration: .9, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `2px solid ${skin.color}` }}
        />
      )}
      {/* Letters get a matching halo so they read as "grab me" against the ambient feed. */}
      {isLetter && !reduced && (
        <motion.span
          aria-hidden
          animate={{ opacity: [.15, .6, .15], scale: [1, 1.3, 1] }}
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

/** Burst of sparks thrown out from a popped bubble. */
function PopParticles({ color, x, y }: { color: string; x: number; y: number }) {
  return (
    <>
      {Array.from({ length: 7 }, (_, i) => {
        const angle = (i / 7) * Math.PI * 2 + 0.4;
        const dist = 26 + (i % 3) * 9;
        return (
          <motion.span
            key={i}
            aria-hidden
            initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            animate={{ opacity: 0, scale: .3, x: Math.cos(angle) * dist, y: Math.sin(angle) * dist }}
            transition={{ duration: .5, ease: "easeOut" }}
            style={{
              position: "fixed", left: x, top: y, zIndex: 39, pointerEvents: "none",
              width: 5, height: 5, borderRadius: "50%",
              background: color, boxShadow: `0 0 8px ${color}`,
            }}
          />
        );
      })}
    </>
  );
}

export function EngagementBubbles() {
  const bubbles = useGameStore(s => s.openingBubbles);
  const popBubble = useGameStore(s => s.popOpeningBubble);
  const [pops, setPops] = useState<Pop[]>([]);
  const [viralBurst, setViralBurst] = useState(0);
  const [travel, setTravel] = useState(760);
  const [lane, setLane] = useState({ start: 30, width: 40 });
  const fieldRef = useRef<HTMLDivElement>(null);
  const popTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextPopId = useRef(0);
  const reduced = useReducedMotion();

  // Measure the play area (and re-measure on resize) so bubbles clear the top edge and
  // ride a lane that provably misses both TEB and the rail. Never animates a layout prop.
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setTravel(rect.height + 150);
      const maxSize = Math.max(...Object.values(SIZE));
      const radius = maxSize / 2;
      // Everything strictly left of TEB, and never within the rail's column.
      const tebLeft = rect.width / 2 - TEB_HALF_WIDTH;
      const start = radius + EDGE_PAD;
      const end = Math.min(tebLeft - radius - EDGE_PAD, rect.width - RAIL_SAFE_PX - radius);
      setLane({ start, width: Math.max(0, end - start) });
    };
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
    setPops(current => [...current.slice(-5), { id, kind: result.kind, text, color: SKIN[result.kind].color, x, y }]);
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
          {bubbles.map(bubble => (
            <BubbleView key={bubble.id} bubble={bubble} travel={travel} lane={lane} onPop={handlePop} />
          ))}
        </AnimatePresence>
      </div>

      {/* Pop payouts are fixed-position so they float from wherever the bubble was tapped. */}
      <AnimatePresence>
        {pops.map(pop => (
          <motion.div key={`pop-${pop.id}`}>
            {!reduced && <PopParticles color={pop.color} x={pop.x} y={pop.y} />}
            <motion.div
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
          </motion.div>
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
