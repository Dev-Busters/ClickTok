import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimationFrame } from "framer-motion";
import { useGameStore } from "../store";
import { arrowProgress, detectSwipeDir } from "../features/elements/swipeHits";
import { BALANCE } from "../features/economy/balance";
import { formatCount } from "../lib/format";
import type { ElementWave, SwipeDir } from "../features/elements/types";
import { pushFloatText } from "./fx/FloatingTextLayer";

const POD_SIZE = 80;
const RING_R = 35;
const RING_CIRC = 2 * Math.PI * RING_R;
const CENTER = POD_SIZE / 2;

const DIR_ARROW: Record<SwipeDir, string> = {
  up: "↑", down: "↓", left: "←", right: "→",
};

type SwipeHitsWaveT = Extract<ElementWave, { element: "swipe_hits" }>;

export function SwipeHitsWave({ wave, onAllPerfect }: { wave: SwipeHitsWaveT; onAllPerfect: () => void }) {
  const swipeArrow = useGameStore(s => s.swipeArrow);

  // Drive every-frame so countdown rings update smoothly
  const [, forceTick] = useState(0);
  useAnimationFrame(() => forceTick(t => (t + 1) % 1_000_000));

  // Fire onAllPerfect callback when every arrow is perfect
  const firedRef = useRef(false);
  const allPerfect = wave.arrows.every(a => a.grade === "perfect");
  useEffect(() => {
    if (allPerfect && !firedRef.current) {
      firedRef.current = true;
      onAllPerfect();
    }
    if (!allPerfect) firedRef.current = false;
  }, [allPerfect, onAllPerfect]);

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32,
    }}>
      {wave.arrows.map(arrow => (
        <SwipeArrowPod
          key={arrow.id}
          arrow={arrow}
          startedAt={wave.startedAt}
          onSwipe={(dir) => swipeArrow(arrow.id, dir)}
        />
      ))}
    </div>
  );
}

function SwipeArrowPod({
  arrow, startedAt, onSwipe,
}: {
  arrow: SwipeHitsWaveT["arrows"][number];
  startedAt: number;
  onSwipe: (dir: SwipeDir) => void;
}) {
  const progress = arrowProgress(startedAt, arrow.id);
  const isActive = progress >= 0 && progress <= 1;
  const isPending = progress < 0;
  const resolved = arrow.grade !== undefined;

  // Countdown ring: 1.0 at start → 0.0 at expiry (fills remaining time)
  const remaining = Math.max(0, 1 - progress);
  const countdownDash = remaining * RING_CIRC;

  const gradeColor = arrow.grade === "perfect" ? "var(--gold)" : arrow.grade === "miss" ? "var(--red)" : undefined;

  // Push grade float text on first grade assignment
  const prevGradeRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (arrow.grade && !prevGradeRef.current) {
      if (arrow.grade === "perfect") {
        const s = useGameStore.getState();
        const comboMult = 1 + Math.min(s.combo, BALANCE.feed.comboCap) * BALANCE.feed.comboPerTap;
        const coins = s.tapPower * BALANCE.postCoinConversion * s.multiplier
          * BALANCE.elements.swipeHits.perfectPayout * comboMult;
        pushFloatText({ text: `+${formatCount(coins)}`, kind: "coin", magnitude: BALANCE.elements.swipeHits.perfectPayout });
      } else {
        pushFloatText({ text: "MISS", kind: "miss", magnitude: 0 });
      }
    }
    prevGradeRef.current = arrow.grade;
  }, [arrow.grade]);

  // Swipe gesture tracking via pointer capture
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      {/* Arrow activation hint above pod */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '8px',
        letterSpacing: '0.16em',
        color: isActive ? 'var(--cyan)' : 'rgba(255,255,255,0.18)',
        transition: 'color 0.15s',
        height: 12,
      }}>
        {isActive && !resolved ? 'SWIPE' : ''}
      </div>

      <div style={{ position: 'relative', width: POD_SIZE, height: POD_SIZE }}>
        {/* Countdown ring SVG (rotated so depletion starts at 12 o'clock) */}
        <svg
          width={POD_SIZE} height={POD_SIZE}
          style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)', pointerEvents: 'none' }}
        >
          <circle
            cx={CENTER} cy={CENTER} r={RING_R}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4}
          />
          {isActive && !resolved && (
            <circle
              cx={CENTER} cy={CENTER} r={RING_R}
              fill="none"
              stroke="var(--cyan)" strokeWidth={4} strokeOpacity={0.6}
              strokeDasharray={`${countdownDash} ${RING_CIRC}`}
              strokeDashoffset={0}
              strokeLinecap="round"
            />
          )}
          {resolved && (
            <circle
              cx={CENTER} cy={CENTER} r={RING_R}
              fill="none"
              stroke={gradeColor ?? 'var(--dim)'} strokeWidth={4} strokeOpacity={0.5}
              strokeDasharray={`${RING_CIRC} 0`}
            />
          )}
        </svg>

        {/* Pod button */}
        <motion.button
          onPointerDown={(e) => {
            e.stopPropagation();
            if (resolved || !isActive) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            startPosRef.current = { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (!startPosRef.current || resolved) return;
            const dx = e.clientX - startPosRef.current.x;
            const dy = e.clientY - startPosRef.current.y;
            const dir = detectSwipeDir(dx, dy);
            if (dir) onSwipe(dir);
            startPosRef.current = null;
          }}
          animate={
            resolved ? { scale: 1, opacity: 1 }
            : isActive ? { scale: [1, 1.04, 1], opacity: 1 }
            : isPending ? { opacity: 0.3 }
            : { opacity: 0.5 }
          }
          transition={
            isActive && !resolved
              ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.2 }
          }
          style={{
            position: 'absolute', inset: 6,
            borderRadius: '50%',
            background: resolved
              ? (arrow.grade === "perfect" ? 'rgba(255,200,0,0.1)' : 'rgba(255,0,0,0.06)')
              : isActive
                ? 'rgba(0,255,255,0.06)'
                : 'rgba(0,0,0,0.35)',
            border: `2px solid ${
              resolved ? (gradeColor ?? 'var(--dim)')
              : isActive ? 'var(--cyan)'
              : 'rgba(255,255,255,0.15)'
            }`,
            boxShadow: resolved && arrow.grade === "perfect"
              ? '0 0 16px var(--gold)'
              : isActive && !resolved
                ? '0 0 8px var(--cyan)'
                : undefined,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: isActive && !resolved ? 'pointer' : 'default',
            padding: 0,
            transition: 'border-color 0.15s, background 0.15s',
          }}
        >
          <AnimatePresence mode="wait">
            {resolved ? (
              <motion.span
                key="grade"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [1.35, 1], opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28 }}
                style={{
                  fontSize: '20px',
                  color: gradeColor ?? 'var(--dim)',
                  textShadow: arrow.grade === 'perfect' ? '0 0 12px var(--gold)' : undefined,
                  pointerEvents: 'none',
                }}
              >
                {arrow.grade === "perfect" ? "✓" : "✗"}
              </motion.span>
            ) : (
              <motion.span
                key="arrow"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: isActive ? 1 : 0.25, scale: 1 }}
                transition={{ duration: 0.2 }}
                style={{
                  fontSize: '28px',
                  color: isActive ? 'var(--cyan)' : 'var(--dim)',
                  textShadow: isActive ? '0 0 10px var(--cyan)' : undefined,
                  pointerEvents: 'none',
                  lineHeight: 1,
                }}
              >
                {DIR_ARROW[arrow.dir]}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}
