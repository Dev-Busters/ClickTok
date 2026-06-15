import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimationFrame } from "framer-motion";
import { useGameStore } from "../store";
import { chargeProgress } from "../features/elements/holdDrop";
import { BALANCE } from "../features/economy/balance";
import { formatCount } from "../lib/format";
import type { ElementWave } from "../features/elements/types";
import { pushFloatText } from "./fx/FloatingTextLayer";

const POD_SIZE = 100;
const RING_R = 42;
const RING_CIRC = 2 * Math.PI * RING_R;
const CENTER = POD_SIZE / 2;

// Segments of the target window on the ring (windowStart–windowEnd)
const { windowStart, windowEnd } = BALANCE.elements.holdDrop;
const WINDOW_DASH = (windowEnd - windowStart) * RING_CIRC;
const WINDOW_OFFSET = -(windowStart * RING_CIRC); // negative = shift the dash forward on the path

type HoldDropWaveT = Extract<ElementWave, { element: "hold_drop" }>;

export function HoldDropWave({ wave }: { wave: HoldDropWaveT }) {
  const pointerDownHold = useGameStore(s => s.pointerDownHold);
  const pointerUpHold   = useGameStore(s => s.pointerUpHold);

  // Drive every-frame update so the charge ring stays in sync with the real clock
  const [, forceTick] = useState(0);
  useAnimationFrame(() => forceTick(t => (t + 1) % 1_000_000));

  const progress = wave.pressedAt !== null ? chargeProgress(wave.pressedAt) : 0;
  const inWindow = progress >= windowStart && progress <= windowEnd;
  const chargeDash = progress * RING_CIRC;

  // Push float text on grade assignment (once per grade)
  const prevGradeRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (wave.grade && !prevGradeRef.current) {
      const s = useGameStore.getState();
      const comboMult = 1 + Math.min(s.combo, BALANCE.feed.comboCap) * BALANCE.feed.comboPerTap;
      const payout = wave.grade === "perfect"
        ? BALANCE.elements.holdDrop.perfectPayout
        : BALANCE.elements.holdDrop.weakPayout;
      const coins = s.tapPower * BALANCE.postCoinConversion * s.multiplier * payout * comboMult;
      if (wave.grade === "perfect") {
        pushFloatText({ text: "PERFECT DROP!", kind: "perfect", magnitude: payout });
        pushFloatText({ text: `+${formatCount(coins)}`, kind: "coin", magnitude: payout });
      } else {
        pushFloatText({ text: wave.grade === "weak" ? "WEAK" : "MISS", kind: "miss", magnitude: 0 });
      }
    }
    prevGradeRef.current = wave.grade;
  }, [wave.grade]);

  const resolved = wave.grade !== undefined;
  const gradeColor = wave.grade === "perfect" ? "var(--gold)" : wave.grade === "weak" ? "var(--dim)" : undefined;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.6, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: 'relative', width: POD_SIZE, height: POD_SIZE, flexShrink: 0 }}
      >
        {/* Charge ring (SVG) — rotated so fill starts at 12 o'clock */}
        <svg
          width={POD_SIZE} height={POD_SIZE}
          style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)', pointerEvents: 'none' }}
        >
          {/* Track */}
          <circle
            cx={CENTER} cy={CENTER} r={RING_R}
            fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5}
          />
          {/* Target window (gold zone) */}
          <circle
            cx={CENTER} cy={CENTER} r={RING_R}
            fill="none" stroke="var(--gold)" strokeWidth={5} strokeOpacity={0.45}
            strokeDasharray={`${WINDOW_DASH} ${RING_CIRC}`}
            strokeDashoffset={WINDOW_OFFSET}
            strokeLinecap="round"
          />
          {/* Charge fill */}
          {wave.pressedAt !== null && !resolved && (
            <circle
              cx={CENTER} cy={CENTER} r={RING_R}
              fill="none"
              stroke={inWindow ? "var(--gold)" : "var(--cyan)"}
              strokeWidth={5}
              strokeDasharray={`${chargeDash} ${RING_CIRC}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              style={{ transition: 'stroke 0.1s' }}
            />
          )}
          {/* Resolved ring */}
          {resolved && (
            <circle
              cx={CENTER} cy={CENTER} r={RING_R}
              fill="none"
              stroke={gradeColor ?? "var(--dim)"} strokeWidth={5} strokeOpacity={0.7}
              strokeDasharray={`${RING_CIRC} 0`}
            />
          )}
        </svg>

        {/* Pod button */}
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            if (resolved) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            pointerDownHold();
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            if (resolved) return;
            e.currentTarget.releasePointerCapture(e.pointerId);
            pointerUpHold();
          }}
          style={{
            position: 'absolute', inset: 8,
            borderRadius: '50%',
            background: wave.pressedAt !== null && !resolved
              ? (inWindow ? 'rgba(255,200,0,0.12)' : 'rgba(0,255,255,0.08)')
              : 'rgba(0,0,0,0.45)',
            border: `2px solid ${resolved ? (gradeColor ?? 'var(--dim)') : wave.pressedAt !== null ? (inWindow ? 'var(--gold)' : 'var(--cyan)') : 'rgba(255,255,255,0.22)'}`,
            boxShadow: resolved && wave.grade === "perfect"
              ? '0 0 20px var(--gold)'
              : wave.pressedAt !== null && inWindow
                ? '0 0 14px var(--gold)'
                : wave.pressedAt !== null
                  ? '0 0 8px var(--cyan)'
                  : undefined,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: resolved ? 'default' : 'pointer',
            padding: 0,
            transition: 'background 0.1s, border-color 0.1s, box-shadow 0.1s',
          }}
        >
          <AnimatePresence mode="wait">
            {resolved ? (
              <motion.span
                key="grade"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [1.3, 1], opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28 }}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.1em',
                  color: gradeColor ?? 'var(--dim)',
                  textShadow: wave.grade === 'perfect' ? '0 0 12px var(--gold)' : undefined,
                  pointerEvents: 'none',
                }}
              >
                {wave.grade === "perfect" ? "PERFECT" : "WEAK"}
              </motion.span>
            ) : wave.pressedAt !== null ? (
              <motion.span
                key="holding"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '8px',
                  letterSpacing: '0.12em',
                  color: inWindow ? 'var(--gold)' : 'var(--cyan)',
                  pointerEvents: 'none',
                }}
              >
                {inWindow ? "DROP!" : "HOLD"}
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.12em',
                  color: 'rgba(255,255,255,0.35)',
                  pointerEvents: 'none',
                }}
              >
                HOLD
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Window markers — tick marks at the target zone edges */}
        {!resolved && (
          <>
            <WindowTick fraction={windowStart} />
            <WindowTick fraction={windowEnd} />
          </>
        )}
      </motion.div>
    </div>
  );
}

function WindowTick({ fraction }: { fraction: number }) {
  const angle = fraction * 360 - 90; // -90 so 0% is at 12 o'clock
  const RAD = (angle * Math.PI) / 180;
  const OUTER = CENTER + 2; // just outside the ring track
  const INNER = CENTER - 6;
  const x1 = CENTER + Math.cos(RAD) * (RING_R + OUTER - CENTER);
  const y1 = CENTER + Math.sin(RAD) * (RING_R + OUTER - CENTER);
  const x2 = CENTER + Math.cos(RAD) * (RING_R + INNER - CENTER);
  const y2 = CENTER + Math.sin(RAD) * (RING_R + INNER - CENTER);
  return (
    <svg width={POD_SIZE} height={POD_SIZE} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--gold)" strokeWidth={2} strokeOpacity={0.7} />
    </svg>
  );
}
