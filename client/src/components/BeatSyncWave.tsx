import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useAnimationFrame } from "framer-motion";
import { useGameStore } from "../store";
import { ringScale, GRADE_COLOR, GRADE_MULT } from "../features/elements/beatSync";
import type { BeatGrade, ElementWave } from "../features/elements/types";
import type { FeedModId } from "../party/types";
import { pushFloatText } from "./fx/FloatingTextLayer";
import { TeachCaption } from "./TeachCaption";

const POD_SIZE = 76;
const SHARD_ANGLES = [-50, 0, 50].map(d => (d * Math.PI) / 180);

type BeatSyncWaveT = Extract<ElementWave, { element: "beat_sync" }>;

export function BeatSyncWave({ wave, onAllPerfect }: { wave: BeatSyncWaveT; onAllPerfect: () => void }) {
  const tapRing = useGameStore(s => s.tapRing);
  const elementsTeachSeen   = useGameStore(s => s.elementsTeachSeen);
  const setElementTeachSeen = useGameStore(s => s.setElementTeachSeen);
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
      pushFloatText({ text: "ALL PERFECT!", kind: "callout", magnitude: 0 });
      onAllPerfect();
    }
    if (!allGraded) firedRef.current = false;
  }, [allPerfect, allGraded, onAllPerfect]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* 11.3: pods scattered at seeded positions (07 §C0) */}
      {wave.rings.map((ring, i) => {
        const pos = wave.pos[i] ?? { x: 0.5, y: 0.5 };
        return (
          <div
            key={ring.id}
            style={{
              position: 'absolute',
              left: `calc(${pos.x * 100}% - ${POD_SIZE / 2}px)`,
              top:  `calc(${pos.y * 100}% - ${POD_SIZE / 2}px)`,
            }}
          >
            <BeatPod
              orderNum={i + 1}
              startedAt={wave.startedAt}
              ring={ring}
              activeMod={activeMod}
              onTap={() => tapRing(ring.id)}
            />
          </div>
        );
      })}

      {/* 11.3: one-time teach caption (07 §C0) */}
      <TeachCaption
        elementId="beat_sync"
        text="TAP THE RING · closer to center = more coins"
        seen={!!elementsTeachSeen.beat_sync}
        onDismiss={() => setElementTeachSeen("beat_sync")}
      />
    </div>
  );
}

function BeatPod({ orderNum, startedAt, ring, activeMod, onTap }: {
  orderNum: number;
  startedAt: number;
  ring: { id: number; grade?: BeatGrade };
  activeMod: FeedModId | null;
  onTap: () => void;
}) {
  const scale = ringScale(startedAt, ring.id, activeMod);
  const resolved = !!ring.grade;

  // Push grade word through the shared FX layer when a grade first appears
  const prevGradeRef = useRef<BeatGrade | undefined>(undefined);
  useEffect(() => {
    if (ring.grade && !prevGradeRef.current) {
      const kind = ring.grade;
      pushFloatText({ text: ring.grade.toUpperCase(), kind, magnitude: GRADE_MULT[ring.grade] });
    }
    prevGradeRef.current = ring.grade;
  }, [ring.grade]);
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
      {/* Approach ring */}
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

      {/* 11.3: order number (07 §C0) — bold, tucked into top-left of pod */}
      {!resolved && (
        <span style={{
          position: 'absolute', top: 4, left: 7,
          fontFamily: 'var(--font-display)',
          fontSize: '13px', fontWeight: 700,
          color: 'rgba(255,255,255,0.55)',
          pointerEvents: 'none',
          lineHeight: 1,
        }}>
          {orderNum}
        </span>
      )}

      {/* TAP hint */}
      {!resolved && !ringVisible && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.12em',
          color: 'rgba(255,255,255,0.35)',
          pointerEvents: 'none',
        }}>
          TAP
        </span>
      )}

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
