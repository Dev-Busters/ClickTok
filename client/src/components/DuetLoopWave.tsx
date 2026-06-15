import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimationFrame } from "framer-motion";
import { useGameStore } from "../store";
import { armProgress, isFlowed } from "../features/elements/duetLoop";
import { BALANCE } from "../features/economy/balance";
import { formatCount } from "../lib/format";
import type { ElementWave } from "../features/elements/types";
import type { FeedModId } from "../party/types";
import { pushFloatText } from "./fx/FloatingTextLayer";
import { TeachCaption } from "./TeachCaption";

const POD_SIZE = 76;

type DuetLoopWaveT = Extract<ElementWave, { element: "duet_loop" }>;

export function DuetLoopWave({ wave, onFlow }: { wave: DuetLoopWaveT; onFlow: () => void }) {
  const tapDuetPod = useGameStore(s => s.tapDuetPod);
  const elementsTeachSeen   = useGameStore(s => s.elementsTeachSeen);
  const setElementTeachSeen = useGameStore(s => s.setElementTeachSeen);
  const activeMod = useGameStore(s => s.deck[s.deckIndex]?.mod ?? null);
  const [, forceTick] = useState(0);
  useAnimationFrame(() => forceTick(t => (t + 1) % 1_000_000));

  const cfg = BALANCE.elements.duetLoop;
  const flowed = wave.completed >= cfg.pods && isFlowed(wave.firstArmedAt, wave.completed, activeMod);
  // Chain awaits a core tap when no pod is armed and there are still pods to complete
  const tebTurn = wave.armedIndex === null && wave.completed < cfg.pods;

  // Push pod payout number when a pod is completed
  const prevCompletedRef = useRef(0);
  useEffect(() => {
    if (wave.completed > prevCompletedRef.current) {
      const s = useGameStore.getState();
      const comboMult = 1 + Math.min(s.combo, BALANCE.feed.comboCap) * BALANCE.feed.comboPerTap;
      const isLast = wave.completed >= cfg.pods;
      const didFlow = isLast && isFlowed(wave.firstArmedAt, wave.completed, activeMod);
      const k = didFlow
        ? (cfg.podPayout + cfg.flowBonus) * comboMult
        : cfg.podPayout * comboMult;
      const coins = s.tapPower * BALANCE.postCoinConversion * s.multiplier * k;
      pushFloatText({ text: `+${formatCount(coins)}`, kind: "coin", magnitude: k });
    }
    prevCompletedRef.current = wave.completed;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wave.completed]);

  const firedRef = useRef(false);
  useEffect(() => {
    if (flowed && !firedRef.current) {
      firedRef.current = true;
      pushFloatText({ text: "FLOW", kind: "flow", magnitude: 0 });
      onFlow();
    }
    if (wave.completed < cfg.pods) firedRef.current = false;
  }, [flowed, wave.completed, onFlow]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* 11.3: pods scattered at seeded positions (07 §C0) */}
      {Array.from({ length: cfg.pods }, (_, i) => {
        const pos = wave.pos[i] ?? { x: 0.5, y: 0.5 };
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `calc(${pos.x * 100}% - ${POD_SIZE / 2}px)`,
              top:  `calc(${pos.y * 100}% - ${POD_SIZE / 2}px)`,
            }}
          >
            <DuetPod
              orderNum={i + 1}
              armed={wave.armedIndex === i}
              armedAt={wave.armedIndex === i ? wave.armedAt : null}
              done={i < wave.completed}
              flowed={flowed}
              tebTurn={tebTurn}
              activeMod={activeMod}
              onTap={() => tapDuetPod()}
            />
          </div>
        );
      })}

      {/* 11.5: "TAP TEB ↓" cue — pulses at the bottom of the play area when chain awaits a core tap */}
      <AnimatePresence>
        {tebTurn && (
          <motion.div
            key="teb-cue"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.65, 1, 0.65], y: [0, 5, 0] }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.85, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
              pointerEvents: 'none',
            }}
          >
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.18em',
              color: 'var(--red)', textShadow: '0 0 10px var(--red)',
              whiteSpace: 'nowrap',
            }}>
              TAP TEB ↓
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 11.3: one-time teach caption (07 §C0) */}
      <TeachCaption
        elementId="duet_loop"
        text="TAP CORE to arm a pod · TAP the glowing pod · alternate to chain"
        seen={!!elementsTeachSeen.duet_loop}
        onDismiss={() => setElementTeachSeen("duet_loop")}
      />
    </div>
  );
}

function DuetPod({ orderNum, armed, armedAt, done, flowed, tebTurn, activeMod, onTap }: {
  orderNum: number;
  armed: boolean;
  armedAt: number | null;
  done: boolean;
  flowed: boolean;
  tebTurn: boolean;
  activeMod: FeedModId | null;
  onTap: () => void;
}) {
  const progress = armed && armedAt ? armProgress(armedAt, activeMod) : 0;
  const glow = armed ? Math.max(0.15, 1 - progress) : 0;

  // Beam: when armed, gradient goes bottom→top (energy flowing from TEB up to pod).
  // When done/flowed, solid color. Otherwise invisible.
  const beamBg = done
    ? (flowed ? 'var(--gold)' : 'var(--red)')
    : armed
      ? 'linear-gradient(0deg, var(--red), rgba(255,31,75,0.1))'
      : 'transparent';

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {/* Energy beam linking pod to core: bottom→top when armed shows TEB→pod flow */}
      <div style={{
        width: 3, height: 34,
        borderRadius: 2,
        background: beamBg,
        opacity: done ? (flowed ? 0.9 : 0.6) : armed ? glow : 0,
        boxShadow: done
          ? (flowed ? '0 0 10px var(--gold)' : '0 0 6px var(--red)')
          : armed ? '0 0 8px var(--red)' : 'none',
        transition: 'opacity 0.2s, background 0.2s, box-shadow 0.2s',
      }} />

      <motion.button
        onPointerDown={e => { e.stopPropagation(); if (armed) onTap(); }}
        // Dim unarmed pods when it's TEB's turn; pulse gently otherwise
        animate={!armed && !done
          ? { opacity: tebTurn ? [0.2, 0.35, 0.2] : [0.3, 0.6, 0.3] }
          : { opacity: 1 }
        }
        transition={!armed && !done
          ? { duration: tebTurn ? 1.2 : 1.8, repeat: Infinity, ease: 'easeInOut' }
          : undefined
        }
        style={{
          position: 'relative',
          width: POD_SIZE, height: POD_SIZE,
          // 11.5: squared rounded-rect (not circle) — visually distinct from BeatSync's circles
          borderRadius: '12px',
          background: 'rgba(0,0,0,0.45)',
          border: `2px solid ${
            done
              ? (flowed ? 'var(--gold)' : 'var(--red)')
              : armed
                ? 'var(--red)'
                : 'rgba(255,31,75,0.22)'
          }`,
          boxShadow: armed
            ? `0 0 ${6 + 10 * glow}px var(--red)`
            : done
              ? (flowed ? '0 0 14px var(--gold)' : '0 0 8px var(--red)')
              : undefined,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: armed ? 'pointer' : 'default',
          flexShrink: 0,
          padding: 0,
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
      >
        {/* Armed ring flare — square to match pod */}
        <AnimatePresence>
          {armed && (
            <motion.div
              initial={{ scale: 0.6, opacity: 0.9 }}
              animate={{ scale: [1, 1.18, 1], opacity: glow }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute', inset: -4,
                borderRadius: '14px',
                border: '2px solid var(--red)',
                boxShadow: '0 0 8px var(--red)',
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>

        {/* 11.3: order number (07 §C0) */}
        {!done && (
          <span style={{
            position: 'absolute', top: 4, left: 7,
            fontFamily: 'var(--font-display)',
            fontSize: '13px', fontWeight: 700,
            color: armed ? 'var(--red)' : 'rgba(255,31,75,0.5)',
            pointerEvents: 'none',
            lineHeight: 1,
          }}>
            {orderNum}
          </span>
        )}

        {/* Center label: ↔ loop glyph when unarmed, TAP! when armed, ✓ when done */}
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: done ? '14px' : armed ? '8px' : '16px',
          letterSpacing: armed ? '0.1em' : '0',
          color: done
            ? (flowed ? 'var(--gold)' : 'var(--red)')
            : armed
              ? 'var(--red)'
              : 'rgba(255,31,75,0.35)',
          textShadow: armed ? '0 0 6px var(--red)' : flowed && done ? '0 0 8px var(--gold)' : undefined,
        }}>
          {done ? '✓' : armed ? 'TAP!' : '↔'}
        </span>
      </motion.button>
    </div>
  );
}
