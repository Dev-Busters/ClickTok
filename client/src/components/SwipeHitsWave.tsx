import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimationFrame } from "framer-motion";
import { useGameStore } from "../store";
import { traceProgress, isOnTarget } from "../features/elements/swipeHits";
import { BALANCE } from "../features/economy/balance";
import { formatCount } from "../lib/format";
import type { ElementWave } from "../features/elements/types";
import { pushFloatText } from "./fx/FloatingTextLayer";
import { TeachCaption } from "./TeachCaption";

const DOT_R = 20;          // radius of FROM/TO dot (px)
const RING_R = 28;
const RING_CIRC = 2 * Math.PI * RING_R;
const RING_BOX = (RING_R + 6) * 2;  // SVG viewBox size around FROM dot

type SwipeHitsWaveT = Extract<ElementWave, { element: "swipe_hits" }>;

export function SwipeHitsWave({ wave, onAllPerfect }: { wave: SwipeHitsWaveT; onAllPerfect: () => void }) {
  const resolveTrace      = useGameStore(s => s.resolveTrace);
  const elementsTeachSeen = useGameStore(s => s.elementsTeachSeen);
  const setElementTeachSeen = useGameStore(s => s.setElementTeachSeen);

  const stageRef = useRef<HTMLDivElement>(null);

  // Every-frame tick for countdown rings
  const [, forceTick] = useState(0);
  useAnimationFrame(() => forceTick(t => (t + 1) % 1_000_000));

  const firedRef = useRef(false);
  const allPerfect = wave.traces.every(t => t.grade === "perfect");
  useEffect(() => {
    if (allPerfect && !firedRef.current) {
      firedRef.current = true;
      onAllPerfect();
    }
    if (!allPerfect) firedRef.current = false;
  }, [allPerfect, onAllPerfect]);

  return (
    <div
      ref={stageRef}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* SVG overlay: dotted path lines between FROM and TO for each trace */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        preserveAspectRatio="none"
      >
        {wave.traces.map(trace => (
          <PathLine key={trace.id} trace={trace} />
        ))}
      </svg>

      {wave.traces.map(trace => (
        <TracePod
          key={trace.id}
          trace={trace}
          startedAt={wave.startedAt}
          stageRef={stageRef}
          onResolve={(hitTarget) => resolveTrace(trace.id, hitTarget)}
        />
      ))}

      <TeachCaption
        elementId="swipe_hits"
        text="PRESS the FROM dot and drag to the TO dot"
        seen={!!elementsTeachSeen.swipe_hits}
        onDismiss={() => setElementTeachSeen("swipe_hits")}
      />
    </div>
  );
}

// Dotted SVG path between FROM and TO dots, using percentage positions
function PathLine({ trace }: { trace: SwipeHitsWaveT["traces"][number] }) {
  const resolved = trace.grade !== undefined;
  const color = trace.grade === "perfect"
    ? "var(--gold)"
    : trace.grade === "miss"
      ? "var(--red)"
      : "var(--cyan)";

  return (
    <line
      x1={`${trace.from.x * 100}%`}
      y1={`${trace.from.y * 100}%`}
      x2={`${trace.to.x * 100}%`}
      y2={`${trace.to.y * 100}%`}
      stroke={color}
      strokeWidth={2}
      strokeOpacity={resolved ? 0.4 : 0.35}
      strokeDasharray="6 6"
    />
  );
}

function TracePod({
  trace, startedAt, stageRef, onResolve,
}: {
  trace: SwipeHitsWaveT["traces"][number];
  startedAt: number;
  stageRef: React.RefObject<HTMLDivElement | null>;
  onResolve: (hitTarget: boolean) => void;
}) {
  const progress = traceProgress(startedAt, trace.id);
  const isActive = progress >= 0 && progress <= 1;
  const isPending = progress < 0;
  const resolved = trace.grade !== undefined;

  const remaining = Math.max(0, 1 - progress);
  const countdownDash = remaining * RING_CIRC;

  const gradeColor = trace.grade === "perfect" ? "var(--gold)" : trace.grade === "miss" ? "var(--red)" : undefined;

  const draggingRef = useRef(false);

  // Float text on grade
  const prevGradeRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (trace.grade && !prevGradeRef.current) {
      if (trace.grade === "perfect") {
        const s = useGameStore.getState();
        const comboMult = 1 + Math.min(s.combo, BALANCE.feed.comboCap) * BALANCE.feed.comboPerTap;
        const coins = s.tapPower * BALANCE.postCoinConversion * s.multiplier
          * BALANCE.elements.swipeHits.perfectPayout * comboMult;
        pushFloatText({ text: `+${formatCount(coins)}`, kind: "coin", magnitude: BALANCE.elements.swipeHits.perfectPayout });
      } else {
        pushFloatText({ text: "MISS", kind: "miss", magnitude: 0 });
      }
    }
    prevGradeRef.current = trace.grade;
  }, [trace.grade]);

  // Compute TO dot's screen position from fractional coords + stage bounds
  function getToScreen() {
    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage) return null;
    return {
      x: stage.left + trace.to.x * stage.width,
      y: stage.top  + trace.to.y * stage.height,
    };
  }

  return (
    <>
      {/* FROM dot — draggable; countdown ring around it */}
      <div
        style={{
          position: 'absolute',
          left: `calc(${trace.from.x * 100}% - ${RING_BOX / 2}px)`,
          top:  `calc(${trace.from.y * 100}% - ${RING_BOX / 2}px)`,
          width: RING_BOX,
          height: RING_BOX,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Countdown ring SVG */}
        <svg
          width={RING_BOX} height={RING_BOX}
          style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)', pointerEvents: 'none' }}
        >
          <circle
            cx={RING_BOX / 2} cy={RING_BOX / 2} r={RING_R}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3}
          />
          {isActive && !resolved && (
            <circle
              cx={RING_BOX / 2} cy={RING_BOX / 2} r={RING_R}
              fill="none"
              stroke="var(--cyan)" strokeWidth={3} strokeOpacity={0.7}
              strokeDasharray={`${countdownDash} ${RING_CIRC}`}
              strokeDashoffset={0}
              strokeLinecap="round"
            />
          )}
          {resolved && (
            <circle
              cx={RING_BOX / 2} cy={RING_BOX / 2} r={RING_R}
              fill="none"
              stroke={gradeColor ?? 'var(--dim)'} strokeWidth={3} strokeOpacity={0.5}
              strokeDasharray={`${RING_CIRC} 0`}
            />
          )}
        </svg>

        {/* FROM dot button */}
        <motion.button
          onPointerDown={(e) => {
            e.stopPropagation();
            if (resolved || !isActive) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            draggingRef.current = true;
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (!draggingRef.current || resolved) return;
            draggingRef.current = false;
            const to = getToScreen();
            if (!to) return;
            const hit = isOnTarget(
              { x: e.clientX, y: e.clientY },
              to,
              BALANCE.elements.swipeHits.hitRadiusPx,
            );
            onResolve(hit);
          }}
          onPointerCancel={(e) => {
            e.stopPropagation();
            draggingRef.current = false;
          }}
          animate={
            resolved ? { scale: 1, opacity: 1 }
            : isActive ? { scale: [1, 1.06, 1], opacity: 1 }
            : isPending ? { opacity: 0.25 }
            : { opacity: 0.45 }
          }
          transition={
            isActive && !resolved
              ? { duration: 0.7, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.15 }
          }
          style={{
            position: 'relative',
            width: DOT_R * 2,
            height: DOT_R * 2,
            borderRadius: '50%',
            padding: 0,
            background: resolved
              ? (trace.grade === "perfect" ? 'rgba(255,200,0,0.15)' : 'rgba(255,0,0,0.1)')
              : isActive
                ? 'rgba(0,255,255,0.10)'
                : 'rgba(0,0,0,0.4)',
            border: `2px solid ${
              resolved ? (gradeColor ?? 'var(--dim)')
              : isActive ? 'var(--cyan)'
              : 'rgba(255,255,255,0.15)'
            }`,
            boxShadow: isActive && !resolved ? '0 0 10px var(--cyan)' : undefined,
            cursor: isActive && !resolved ? 'crosshair' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AnimatePresence mode="wait">
            {resolved ? (
              <motion.span
                key="grade"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [1.4, 1], opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                style={{
                  fontSize: '14px',
                  color: gradeColor,
                  textShadow: trace.grade === 'perfect' ? '0 0 10px var(--gold)' : undefined,
                  pointerEvents: 'none',
                }}
              >
                {trace.grade === "perfect" ? "✓" : "✗"}
              </motion.span>
            ) : (
              <motion.span
                key="from-label"
                initial={{ opacity: 0 }}
                animate={{ opacity: isActive ? 1 : 0.2 }}
                style={{
                  fontSize: '9px',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.08em',
                  color: isActive ? 'var(--cyan)' : 'var(--dim)',
                  pointerEvents: 'none',
                }}
              >
                {trace.id + 1}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* TO dot — visual target only, no interaction */}
      <motion.div
        animate={
          resolved
            ? { scale: 1, opacity: 1 }
            : isActive
              ? { scale: [0.95, 1.05, 0.95], opacity: 1 }
              : { opacity: isPending ? 0.2 : 0.4 }
        }
        transition={
          isActive && !resolved
            ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.15 }
        }
        style={{
          position: 'absolute',
          left: `calc(${trace.to.x * 100}% - ${DOT_R}px)`,
          top:  `calc(${trace.to.y * 100}% - ${DOT_R}px)`,
          width: DOT_R * 2,
          height: DOT_R * 2,
          borderRadius: '50%',
          border: `2px dashed ${
            resolved ? (gradeColor ?? 'var(--dim)') : isActive ? 'var(--gold)' : 'rgba(255,255,255,0.2)'
          }`,
          background: resolved && trace.grade === "perfect"
            ? 'rgba(255,200,0,0.15)'
            : 'rgba(0,0,0,0.2)',
          boxShadow: isActive && !resolved ? '0 0 8px var(--gold)' : undefined,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{
          fontSize: '8px',
          fontFamily: 'var(--font-mono)',
          color: isActive ? 'var(--gold)' : 'var(--dim)',
          pointerEvents: 'none',
          opacity: resolved ? 0 : 1,
        }}>
          TO
        </span>
      </motion.div>
    </>
  );
}
