import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  OPENING_PULSE_CYCLE_MS,
  OPENING_PULSE_GREEN_DEG,
  OPENING_PULSE_YELLOW_DEG,
  openingPulseProgress,
  openingPulseZone,
  type OpeningPulseZone,
} from "../../features/onboarding/helpers";

type PulseFeedback = { id: number; zone: OpeningPulseZone } | null;

type OpeningPulseDialProps = {
  feedback: PulseFeedback;
};

const SIZE = 226;
const CENTER = SIZE / 2;

function wavePath(radius: number, amplitude: number, frequency: number, phase: number): string {
  const points = Array.from({ length: 97 }, (_, index) => {
    const angle = (index / 96) * Math.PI * 2;
    const waveRadius = radius + Math.sin(angle * frequency + phase) * amplitude;
    const x = CENTER + Math.sin(angle) * waveRadius;
    const y = CENTER - Math.cos(angle) * waveRadius;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  });
  return `${points.join(" ")} Z`;
}

export function OpeningPulseDial({ feedback }: OpeningPulseDialProps) {
  const travelerRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<SVGGElement>(null);
  const reducedMotion = useReducedMotion();
  const paths = useMemo(() => [
    wavePath(102, 4.8, 9, 0),
    wavePath(98, 3.4, 7, 1.8),
    wavePath(106, 2.6, 11, 3.2),
  ], []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const now = Date.now();
      const progress = openingPulseProgress(now);
      const angle = progress * 360;
      const zone = openingPulseZone(now);
      const color = zone === "green" ? "#4dff9a" : zone === "yellow" ? "#ffd84d" : "#ff315d";
      const traveler = travelerRef.current;
      if (traveler) {
        traveler.style.transform = `rotate(${angle}deg) translateY(-112px)`;
        traveler.style.background = color;
        traveler.style.boxShadow = `0 0 7px #fff, 0 0 16px ${color}, 0 0 30px ${color}`;
        traveler.dataset.zone = zone;
      }
      const wave = waveRef.current;
      if (wave && !reducedMotion) {
        const breath = 1 + Math.sin(progress * Math.PI * 4) * 0.028;
        wave.setAttribute("transform", `translate(${CENTER} ${CENTER}) scale(${breath}) rotate(${-angle * 0.22}) translate(${-CENTER} ${-CENTER})`);
      }
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion]);

  const greenHalf = OPENING_PULSE_GREEN_DEG / 2;
  const yellowEnd = greenHalf + OPENING_PULSE_YELLOW_DEG;
  const zoneGradient = `conic-gradient(from 0deg,
    #49ff9a 0deg ${greenHalf}deg,
    #ffd84d ${greenHalf}deg ${yellowEnd}deg,
    #ff315d ${yellowEnd}deg ${360 - yellowEnd}deg,
    #ffd84d ${360 - yellowEnd}deg ${360 - greenHalf}deg,
    #49ff9a ${360 - greenHalf}deg 360deg)`;

  return (
    <div aria-hidden style={{ position: "absolute", inset: -10, pointerEvents: "none" }}>
      <motion.svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        animate={reducedMotion ? undefined : { opacity: [.68, 1, .68] }}
        transition={{ duration: OPENING_PULSE_CYCLE_MS / 1000, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", inset: 0, overflow: "visible", filter: "drop-shadow(0 0 8px rgba(37,244,238,.28))" }}
      >
        <defs>
          <linearGradient id="opening-wave-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#25f4ee" />
            <stop offset=".48" stopColor="#b44dff" />
            <stop offset="1" stopColor="#ff1f6a" />
          </linearGradient>
          <linearGradient id="opening-wave-b" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe45c" />
            <stop offset=".5" stopColor="#ff3c8f" />
            <stop offset="1" stopColor="#25f4ee" />
          </linearGradient>
        </defs>
        <g ref={waveRef}>
          <path d={paths[0]} fill="none" stroke="url(#opening-wave-a)" strokeWidth="2.8" opacity=".95" />
          <path d={paths[1]} fill="none" stroke="url(#opening-wave-b)" strokeWidth="1.6" opacity=".64" />
          <path d={paths[2]} fill="none" stroke="#fff" strokeWidth=".8" opacity=".25" />
        </g>
      </motion.svg>

      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: zoneGradient, mask: "radial-gradient(farthest-side,transparent calc(100% - 7px),#000 0)", WebkitMask: "radial-gradient(farthest-side,transparent calc(100% - 7px),#000 0)", filter: "drop-shadow(0 0 8px rgba(255,31,75,.38))" }} />
      <div style={{ position: "absolute", left: "50%", top: -15, translate: "-50% 0", padding: "3px 7px", borderRadius: 999, background: "rgba(5,9,9,.9)", border: "1px solid rgba(73,255,154,.65)", color: "#6dffad", fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 900, letterSpacing: ".14em", boxShadow: "0 0 12px rgba(73,255,154,.25)" }}>HIT THE CREST</div>
      <div data-pulse-traveler ref={travelerRef} style={{ position: "absolute", left: "calc(50% - 6px)", top: "calc(50% - 6px)", width: 12, height: 12, borderRadius: "50%", transformOrigin: "6px 6px", willChange: "transform" }}>
        <span style={{ position: "absolute", inset: 3, borderRadius: "50%", background: "white" }} />
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.div
            key={feedback.id}
            initial={{ opacity: .95, scale: .74 }}
            animate={{ opacity: 0, scale: feedback.zone === "green" ? 1.34 : 1.18 }}
            exit={{ opacity: 0 }}
            transition={{ duration: feedback.zone === "green" ? .48 : .34, ease: "easeOut" }}
            style={{ position: "absolute", inset: feedback.zone === "green" ? -5 : 1, borderRadius: "50%", border: `3px solid ${feedback.zone === "green" ? "#75ffb5" : feedback.zone === "yellow" ? "#ffd84d" : "#ff315d"}`, boxShadow: `0 0 28px ${feedback.zone === "green" ? "#4dff9a" : feedback.zone === "yellow" ? "#ffd84d" : "#ff315d"}, inset 0 0 18px currentColor` }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
