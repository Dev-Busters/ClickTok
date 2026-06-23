import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  OPENING_PULSE_CYCLE_MS,
  OPENING_PULSE_GREEN_DEG,
  openingPulseAngle,
  openingPulseModifierWidth,
  openingPulseProgress,
  openingPulseZone,
  type OpeningPulseDirection,
  type OpeningPulseZone,
} from "../../features/onboarding/helpers";
import type { OpeningPulseModifier, OpeningPulseModifierId, OpeningPulseModifierKind } from "../../features/onboarding/types";

type PulseFeedback = { id: number; zone: OpeningPulseZone } | null;

type OpeningPulseDialProps = {
  feedback: PulseFeedback;
  modifiers: readonly OpeningPulseModifier[];
  showTimingGuide: boolean;
  direction: OpeningPulseDirection;
  offsetDeg: number;
  passiveArmed: boolean;
  editing?: { id: OpeningPulseModifierId; kind: OpeningPulseModifierKind; centerDeg: number; valid: boolean };
  onPulseFrame?: (now: number) => void;
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

const ZONE_RADIUS = 110;
const ZONE_CIRCUMFERENCE = Math.PI * 2 * ZONE_RADIUS;

function RingArc({ centerDeg, widthDeg, color, strokeWidth = 8, opacity = 1 }: { centerDeg: number; widthDeg: number; color: string; strokeWidth?: number; opacity?: number }) {
  const arcLength = ZONE_CIRCUMFERENCE * widthDeg / 360;
  return <circle cx={CENTER} cy={CENTER} r={ZONE_RADIUS} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={`${arcLength} ${ZONE_CIRCUMFERENCE - arcLength}`} transform={`rotate(${centerDeg - widthDeg / 2 - 90} ${CENTER} ${CENTER})`} opacity={opacity} />;
}

function ModifierZone({ modifier, invalid = false, preview = false }: { modifier: OpeningPulseModifier; invalid?: boolean; preview?: boolean }) {
  const data = preview ? { "data-pulse-modifier-preview": true, "data-placement-valid": invalid ? "false" : "true" } : { "data-pulse-modifier": modifier.id };
  const widthDeg = openingPulseModifierWidth(modifier);
  const color = modifier.kind === "event" ? "#37a6ff" : "#b56cff";
  const glow = modifier.kind === "event" ? "rgba(55,166,255,.78)" : "rgba(181,108,255,.72)";
  return (
    <g {...data} style={{ filter: `drop-shadow(0 0 ${preview ? 10 : 7}px ${invalid ? "rgba(255,49,93,.95)" : glow})` }}>
      <RingArc centerDeg={modifier.centerDeg} widthDeg={widthDeg} color={invalid ? "#ff315d" : color} strokeWidth={preview ? 12 : 8} opacity={invalid ? .78 : preview ? .72 : 1} />
      {!invalid && modifier.kind === "passive" && <RingArc centerDeg={modifier.centerDeg} widthDeg={Math.max(8, widthDeg - 12)} color="#ffffff" strokeWidth={2} opacity={preview ? .58 : .4} />}
    </g>
  );
}

export function OpeningPulseDial({ feedback, modifiers, showTimingGuide, direction, offsetDeg, passiveArmed, editing, onPulseFrame }: OpeningPulseDialProps) {
  const travelerRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<SVGGElement>(null);
  const energyWaveRef = useRef<SVGPathElement>(null);
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
      onPulseFrame?.(now);
      const progress = openingPulseProgress(now, direction, offsetDeg);
      const angle = openingPulseAngle(now, direction, offsetDeg);
      const zone = openingPulseZone(now, modifiers, direction, offsetDeg);
      const color = zone === "green" ? "#4dff9a" : zone === "blue" ? "#37a6ff" : zone === "passive" ? "#b56cff" : "#ff315d";
      const traveler = travelerRef.current;
      if (traveler) {
        traveler.style.transform = `rotate(${angle}deg) translateY(-112px)`;
        traveler.style.background = color;
        traveler.style.boxShadow = `0 0 7px #fff, 0 0 16px ${color}, 0 0 30px ${color}`;
        traveler.dataset.zone = zone;
        traveler.dataset.passiveArmed = passiveArmed ? "true" : "false";
        traveler.style.setProperty("--pulse-color", color);
      }
      const energyWave = energyWaveRef.current;
      if (energyWave) {
        energyWave.setAttribute("stroke", color);
        energyWave.style.strokeDashoffset = `${-progress * 180}px`;
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
  }, [direction, modifiers, offsetDeg, onPulseFrame, passiveArmed, reducedMotion]);

  const greenHalf = OPENING_PULSE_GREEN_DEG / 2;
  const zoneGradient = `conic-gradient(from 0deg,
    #49ff9a 0deg ${greenHalf}deg,
    #ff315d ${greenHalf}deg ${360 - greenHalf}deg,
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
          <path ref={energyWaveRef} d={paths[0]} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="2 17" opacity=".72" style={{ filter: "drop-shadow(0 0 4px currentColor)" }} />
        </g>
      </motion.svg>

      <div style={{ position: "absolute", zIndex: 1, inset: 0, borderRadius: "50%", background: zoneGradient, mask: "radial-gradient(farthest-side,transparent calc(100% - 7px),#000 0)", WebkitMask: "radial-gradient(farthest-side,transparent calc(100% - 7px),#000 0)", filter: "drop-shadow(0 0 8px rgba(255,31,75,.38))" }} />
      <svg aria-hidden width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: "absolute", zIndex: 2, inset: 0, overflow: "visible" }}>
        {modifiers.filter(modifier => modifier.id !== editing?.id).map(modifier => <ModifierZone key={modifier.id} modifier={modifier} />)}
        {editing && <ModifierZone modifier={{ id: editing.id, kind: editing.kind, centerDeg: editing.centerDeg }} invalid={!editing.valid} preview />}
      </svg>

      <AnimatePresence>
        {showTimingGuide && <motion.div data-pulse-timing-guide initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5, scale: .96 }} transition={{ duration: .24 }} style={{ position: "absolute", zIndex: 5, top: -43, left: "50%", translate: "-50% 0", width: 160, display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <span style={{ color: "#75ffb5", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 900, letterSpacing: ".06em", textAlign: "center", textShadow: "0 0 9px rgba(73,255,154,.78)" }}>PERFECT 100%</span>
        </motion.div>}
      </AnimatePresence>

      <div data-pulse-traveler ref={travelerRef} className="opening-electric-pulse" style={{ position: "absolute", zIndex: 4, left: "calc(50% - 6px)", top: "calc(50% - 6px)", width: 12, height: 12, transformOrigin: "6px 6px", willChange: "transform" }}>
        <span className="opening-electric-tail" />
        <span className="opening-electric-ripple" />
        <span className="opening-electric-core" />
        <span className="opening-electric-spark opening-electric-spark-a" />
        <span className="opening-electric-spark opening-electric-spark-b" />
        <span className="opening-electric-spark opening-electric-spark-c" />
      </div>

      <AnimatePresence>
        {feedback && (
          <motion.div
            key={feedback.id}
            initial={{ opacity: .95, scale: .74 }}
            animate={{ opacity: 0, scale: feedback.zone === "green" ? 1.34 : 1.18 }}
            exit={{ opacity: 0 }}
            transition={{ duration: feedback.zone === "green" ? .48 : .34, ease: "easeOut" }}
            style={{ position: "absolute", inset: feedback.zone === "green" ? -5 : 1, borderRadius: "50%", border: `3px solid ${feedback.zone === "green" ? "#75ffb5" : feedback.zone === "blue" ? "#37a6ff" : feedback.zone === "passive" ? "#b56cff" : "#ff315d"}`, boxShadow: `0 0 28px ${feedback.zone === "green" ? "#4dff9a" : feedback.zone === "blue" ? "#37a6ff" : feedback.zone === "passive" ? "#b56cff" : "#ff315d"}, inset 0 0 18px currentColor` }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
