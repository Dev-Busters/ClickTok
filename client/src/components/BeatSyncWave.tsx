import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimationFrame } from "framer-motion";
import { useGameStore } from "../store";
import { ringScale, GRADE_COLOR } from "../features/elements/beatSync";
import type { BeatGrade, ElementWave } from "../features/elements/types";
import type { FeedModId } from "../party/types";

const POD_SIZE = 50;
const SHARD_ANGLES = [-50, 0, 50].map(d => (d * Math.PI) / 180);

type BeatSyncWaveT = Extract<ElementWave, { element: "beat_sync" }>;

export function BeatSyncWave({ wave, onAllPerfect }: { wave: BeatSyncWaveT; onAllPerfect: () => void }) {
  const tapRing = useGameStore(s => s.tapRing);
  // 04 §13.5: the active video's mod (if any) modifies beat_sync's shrink/grade windows.
  const activeMod = useGameStore(s => s.deck[s.deckIndex]?.mod ?? null);
  // Shared wave clock (01 §8.2 / 06 §3): re-render every frame so each ring's
  // scale — driving BOTH the visual and (via tapRing) the grade — stays in sync.
  const [, forceTick] = useState(0);
  useAnimationFrame(() => forceTick(t => (t + 1) % 1_000_000));

  const allGraded = wave.rings.every(r => r.grade);
  const allPerfect = allGraded && wave.rings.every(r => r.grade === "perfect");
  const firedRef = useRef(false);
  useEffect(() => {
    if (allPerfect && !firedRef.current) {
      firedRef.current = true;
      onAllPerfect();
    }
    if (!allGraded) firedRef.current = false;
  }, [allPerfect, allGraded, onAllPerfect]);

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40,
    }}>
      {wave.rings.map(ring => (
        <BeatPod
          key={ring.id}
          startedAt={wave.startedAt}
          ring={ring}
          activeMod={activeMod}
          onTap={() => tapRing(ring.id)}
        />
      ))}
    </div>
  );
}

function BeatPod({ startedAt, ring, activeMod, onTap }: {
  startedAt: number;
  ring: { id: number; grade?: BeatGrade };
  activeMod: FeedModId | null;
  onTap: () => void;
}) {
  const scale = ringScale(startedAt, ring.id, activeMod);
  const resolved = !!ring.grade;
  const ringVisible = !resolved && scale > 0 && scale <= 2.2;

  return (
    <button
      onPointerDown={(e) => { e.stopPropagation(); if (!resolved) onTap(); }}
      style={{
        position: 'relative',
        width: POD_SIZE, height: POD_SIZE,
        borderRadius: '50%',
        background: 'rgba(0,0,0,0.45)',
        border: `2px solid ${resolved ? GRADE_COLOR[ring.grade!] : 'rgba(255,255,255,0.28)'}`,
        boxShadow: resolved && ring.grade === 'perfect' ? '0 0 16px var(--gold)' : undefined,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: resolved ? 'default' : 'pointer',
        flexShrink: 0,
        padding: 0,
      }}
    >
      {/* Approach ring — scale & timing drive the grade in elementsSlice.tapRing */}
      {ringVisible && (
        <div style={{
          position: 'absolute',
          width: POD_SIZE, height: POD_SIZE,
          borderRadius: '50%',
          border: '2px solid var(--cyan)',
          boxShadow: '0 0 8px var(--cyan)',
          transform: `scale(${Math.max(scale, 0.05)})`,
          opacity: Math.min(1, Math.max(0.15, 2.2 - scale) / 1.2),
          pointerEvents: 'none',
        }} />
      )}

      {/* MISS shards */}
      <AnimatePresence>
        {ring.grade === "miss" && SHARD_ANGLES.map((angle, i) => (
          <motion.div
            key={`shard-${i}`}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * 26, y: Math.sin(angle) * 26, opacity: 0, scale: 0.4 }}
            exit={{}}
            transition={{ duration: 0.35, ease: "easeOut" }}
            style={{
              position: 'absolute',
              width: 14, height: 3,
              background: 'var(--red)',
              borderRadius: 1,
              transform: `rotate(${angle}rad)`,
              pointerEvents: 'none',
            }}
          />
        ))}
      </AnimatePresence>

      {/* Grade label */}
      <AnimatePresence>
        {resolved && (
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={ring.grade === "miss"
              ? { x: [0, -3, 3, -3, 0], opacity: 1, scale: 1 }
              : { scale: [1.4, 1], opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32 }}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '8px',
              letterSpacing: '0.1em',
              color: GRADE_COLOR[ring.grade!],
              textShadow: ring.grade === 'perfect' ? '0 0 10px var(--gold)' : undefined,
              pointerEvents: 'none',
            }}
          >
            {ring.grade!.toUpperCase()}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
