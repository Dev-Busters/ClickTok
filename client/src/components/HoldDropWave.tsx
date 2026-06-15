import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useAnimationFrame } from "framer-motion";
import { useGameStore } from "../store";
import { chargeProgress, crestPos } from "../features/elements/holdDrop";
import { BALANCE } from "../features/economy/balance";
import { formatCount } from "../lib/format";
import type { ElementWave } from "../features/elements/types";
import { pushFloatText } from "./fx/FloatingTextLayer";
import { TeachCaption } from "./TeachCaption";

const POD_SIZE = 100;
const RING_R = 42;
const RING_CIRC = 2 * Math.PI * RING_R;
const CENTER = POD_SIZE / 2;

// Length of the golden crest zone arc
const CREST_ZONE_DASH = BALANCE.elements.holdDrop.crestHalfWidth * 2 * RING_CIRC;

type HoldDropWaveT = Extract<ElementWave, { element: "hold_drop" }>;

// SVG uses rotate(-90deg) so progress=0 is at 12 o'clock.
// dashOffset = -(arcStart * RING_CIRC) shifts the dash to start at the right angle.
function crestDashOffset(crest: number): number {
  const start = crest - BALANCE.elements.holdDrop.crestHalfWidth;
  return -(start * RING_CIRC);
}

export function HoldDropWave({ wave }: { wave: HoldDropWaveT }) {
  const pointerDownHold     = useGameStore(s => s.pointerDownHold);
  const pointerUpHold       = useGameStore(s => s.pointerUpHold);
  const elementsTeachSeen   = useGameStore(s => s.elementsTeachSeen);
  const setElementTeachSeen = useGameStore(s => s.setElementTeachSeen);

  // Force re-render every frame so the moving crest and charge fill stay live
  const frameRef = useRef(0);
  useAnimationFrame(() => { frameRef.current = (frameRef.current + 1) % 1_000_000; });

  const holding = wave.pressedAt !== null;
  const progress = holding ? chargeProgress(wave.pressedAt!) : 0;
  const crest = holding ? crestPos(wave.pressedAt!) : BALANCE.elements.holdDrop.crestCenter;
  const inCrest = holding && Math.abs(progress - crest) <= BALANCE.elements.holdDrop.crestHalfWidth;
  const overcharging = holding && progress >= BALANCE.elements.holdDrop.overchargeWarn;
  const chargeDash = progress * RING_CIRC;
  const chargeColor = overcharging ? "var(--red)" : inCrest ? "var(--gold)" : "var(--cyan)";

  const resolved = wave.grade !== undefined;
  const gradeColor = wave.grade === "perfect" ? "var(--gold)" : "var(--dim)";

  // Float text once on grade
  const prevGradeRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (wave.grade && !prevGradeRef.current) {
      const s = useGameStore.getState();
      const payout = wave.payout ?? (wave.grade === "perfect" ? BALANCE.elements.holdDrop.perfectPayout : BALANCE.elements.holdDrop.weakPayout);
      if (wave.grade === "perfect") {
        const comboMult = 1 + Math.min(s.combo, BALANCE.feed.comboCap) * BALANCE.feed.comboPerTap;
        const coins = s.tapPower * BALANCE.postCoinConversion * s.multiplier * payout * comboMult;
        pushFloatText({ text: "PERFECT DROP!", kind: "perfect", magnitude: payout });
        pushFloatText({ text: `+${formatCount(coins)}`, kind: "coin", magnitude: payout });
      } else {
        pushFloatText({ text: "WEAK", kind: "miss", magnitude: 0 });
      }
    }
    prevGradeRef.current = wave.grade;
  }, [wave.grade]);

  const pos = wave.pos;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <TeachCaption
        elementId="hold_drop"
        text="HOLD + release at the GOLD peak"
        seen={!!elementsTeachSeen.hold_drop}
        onDismiss={() => setElementTeachSeen("hold_drop")}
      />

      <div style={{
        position: 'absolute',
        left: `calc(${pos.x * 100}% - ${POD_SIZE / 2}px)`,
        top:  `calc(${pos.y * 100}% - ${POD_SIZE / 2}px)`,
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

            {/* Moving golden crest zone — updates every frame */}
            {!resolved && (
              <circle
                cx={CENTER} cy={CENTER} r={RING_R}
                fill="none" stroke="var(--gold)" strokeWidth={6} strokeOpacity={holding ? 0.7 : 0.4}
                strokeDasharray={`${CREST_ZONE_DASH} ${RING_CIRC}`}
                strokeDashoffset={crestDashOffset(crest)}
                strokeLinecap="round"
                style={{ transition: 'stroke-opacity 0.2s' }}
              />
            )}

            {/* Charge fill */}
            {holding && !resolved && (
              <circle
                cx={CENTER} cy={CENTER} r={RING_R}
                fill="none"
                stroke={chargeColor}
                strokeWidth={5}
                strokeDasharray={`${chargeDash} ${RING_CIRC}`}
                strokeDashoffset={0}
                strokeLinecap="round"
                style={{ transition: 'stroke 0.1s' }}
              />
            )}

            {/* Overcharge warning pulse — blinking red ring when near 100% */}
            {overcharging && !resolved && (
              <motion.circle
                cx={CENTER} cy={CENTER} r={RING_R}
                fill="none" stroke="var(--red)" strokeWidth={7} strokeOpacity={0.5}
                strokeDasharray={`${RING_CIRC} 0`}
                animate={{ opacity: [0.25, 0.75, 0.25] }}
                transition={{ duration: 0.35, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            {/* Resolved ring */}
            {resolved && (
              <circle
                cx={CENTER} cy={CENTER} r={RING_R}
                fill="none"
                stroke={gradeColor} strokeWidth={5} strokeOpacity={0.7}
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
            onPointerCancel={(e) => {
              e.stopPropagation();
              if (resolved) return;
              e.currentTarget.releasePointerCapture(e.pointerId);
              pointerUpHold();
            }}
            style={{
              position: 'absolute', inset: 8,
              borderRadius: '50%',
              background: holding && !resolved
                ? (inCrest ? 'rgba(255,200,0,0.14)' : overcharging ? 'rgba(255,60,60,0.10)' : 'rgba(0,255,255,0.08)')
                : 'rgba(0,0,0,0.45)',
              border: `2px solid ${resolved
                ? gradeColor
                : holding
                  ? (inCrest ? 'var(--gold)' : overcharging ? 'var(--red)' : 'var(--cyan)')
                  : 'rgba(255,255,255,0.22)'}`,
              boxShadow: resolved && wave.grade === "perfect"
                ? '0 0 20px var(--gold)'
                : holding && inCrest
                  ? '0 0 16px var(--gold)'
                  : holding && overcharging
                    ? '0 0 12px var(--red)'
                    : holding
                      ? '0 0 8px var(--cyan)'
                      : undefined,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: resolved ? 'default' : 'pointer',
              padding: 0,
              touchAction: 'none',
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
                    color: gradeColor,
                    textShadow: wave.grade === 'perfect' ? '0 0 12px var(--gold)' : undefined,
                    pointerEvents: 'none',
                  }}
                >
                  {wave.grade === "perfect" ? "PERFECT" : "WEAK"}
                </motion.span>
              ) : holding ? (
                <motion.span
                  key="holding"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: overcharging ? 0.25 : 0.5, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '8px',
                    letterSpacing: '0.12em',
                    color: inCrest ? 'var(--gold)' : overcharging ? 'var(--red)' : 'var(--cyan)',
                    pointerEvents: 'none',
                  }}
                >
                  {inCrest ? "DROP!" : overcharging ? "RELEASE!" : "HOLD"}
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
        </motion.div>
      </div>
    </div>
  );
}
