import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimationFrame } from "framer-motion";
import { useGameStore } from "../store";
import { armProgress, isFlowed } from "../features/elements/duetLoop";
import { BALANCE } from "../features/economy/balance";
import { formatCount } from "../lib/format";
import type { ElementWave } from "../features/elements/types";
import type { FeedModId } from "../party/types";
import { pushFloatText } from "./fx/FloatingTextLayer";

const POD_SIZE = 50;

type DuetLoopWaveT = Extract<ElementWave, { element: "duet_loop" }>;

export function DuetLoopWave({ wave, onFlow }: { wave: DuetLoopWaveT; onFlow: () => void }) {
  const tapDuetPod = useGameStore(s => s.tapDuetPod);
  // 04 §13.5: the active video's mod (if any) widens duet_loop's flow/arm windows.
  const activeMod = useGameStore(s => s.deck[s.deckIndex]?.mod ?? null);
  // Shared wave clock (01 §8.2 / 06 §3, same precedent as BeatSyncWave): re-render
  // every frame so the armed-pod glow gutter derives from the same clock as the
  // slice's armTimeoutSec check.
  const [, forceTick] = useState(0);
  useAnimationFrame(() => forceTick(t => (t + 1) % 1_000_000));

  const cfg = BALANCE.elements.duetLoop;
  const flowed = wave.completed >= cfg.pods && isFlowed(wave.firstArmedAt, wave.completed, activeMod);

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
  // activeMod and wave.firstArmedAt are needed for isFlowed inside the effect
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
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 40,
      paddingBottom: 6,
    }}>
      {Array.from({ length: BALANCE.elements.duetLoop.pods }, (_, i) => (
        <DuetPod
          key={i}
          armed={wave.armedIndex === i}
          armedAt={wave.armedIndex === i ? wave.armedAt : null}
          done={i < wave.completed}
          flowed={flowed}
          activeMod={activeMod}
          onTap={() => tapDuetPod()}
        />
      ))}
    </div>
  );
}

function DuetPod({ armed, armedAt, done, flowed, activeMod, onTap }: {
  armed: boolean;
  armedAt: number | null;
  done: boolean;
  flowed: boolean;
  activeMod: FeedModId | null;
  onTap: () => void;
}) {
  // 04 §13.2: armed pod untapped for armTimeoutSec gutters back to dormant —
  // glow fades out as the timeout approaches (no harsh fail signal).
  const progress = armed && armedAt ? armProgress(armedAt, activeMod) : 0;
  const glow = armed ? Math.max(0.15, 1 - progress) : 0;

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {/* Energy beam / afterglow link toward the core below */}
      <div style={{
        width: 3, height: 34,
        borderRadius: 2,
        background: done
          ? (flowed ? 'var(--gold)' : 'var(--cyan)')
          : armed
            ? 'linear-gradient(180deg, var(--red), var(--cyan))'
            : 'transparent',
        opacity: done ? (flowed ? 0.9 : 0.45) : armed ? glow : 0,
        boxShadow: done
          ? (flowed ? '0 0 10px var(--gold)' : '0 0 6px var(--cyan)')
          : armed ? '0 0 8px var(--cyan)' : 'none',
        transition: 'opacity 0.2s, background 0.2s, box-shadow 0.2s',
      }} />

      <motion.button
        onPointerDown={e => { e.stopPropagation(); if (armed) onTap(); }}
        animate={!armed && !done ? { opacity: [0.3, 0.6, 0.3] } : { opacity: 1 }}
        transition={!armed && !done ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : undefined}
        style={{
          position: 'relative',
          width: POD_SIZE, height: POD_SIZE,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.45)',
          border: `2px solid ${done ? (flowed ? 'var(--gold)' : 'var(--cyan)') : armed ? 'var(--cyan)' : 'rgba(255,255,255,0.22)'}`,
          boxShadow: armed
            ? `0 0 ${6 + 10 * glow}px var(--cyan)`
            : done
              ? (flowed ? '0 0 14px var(--gold)' : '0 0 8px var(--cyan)')
              : undefined,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: armed ? 'pointer' : 'default',
          flexShrink: 0,
          padding: 0,
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
      >
        {/* Armed ring flare */}
        <AnimatePresence>
          {armed && (
            <motion.div
              initial={{ scale: 0.6, opacity: 0.9 }}
              animate={{ scale: [1, 1.18, 1], opacity: glow }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: 'absolute', inset: -4,
                borderRadius: '50%',
                border: '2px solid var(--cyan)',
                boxShadow: '0 0 8px var(--cyan)',
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>

        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '8px',
          letterSpacing: '0.1em',
          color: done ? (flowed ? 'var(--gold)' : 'var(--cyan)') : armed ? 'var(--cyan)' : 'var(--dim)',
          textShadow: armed ? '0 0 6px var(--cyan)' : flowed && done ? '0 0 8px var(--gold)' : undefined,
        }}>
          {done ? '✓' : armed ? 'TAP!' : ''}
        </span>
      </motion.button>
    </div>
  );
}
