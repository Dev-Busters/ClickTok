import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────────────────────
export interface PushCelebrationOpts {
  icon: string;
  label: string;
  sublabel?: string;
  /** 13.1 (09 §A3): optional stat/effect line shown below sublabel, e.g. "+3 post power". */
  detail?: string;
  /** Ray burst + glow color. Defaults to gold. */
  color?: string;
}

interface CelebrationItem extends PushCelebrationOpts {
  id: number;
}

// ── Module-level event bus (same pattern as FloatingTextLayer) ─────────────────
let _itemId = 0;
type AddFn = (item: CelebrationItem) => void;
const _listeners = new Set<AddFn>();

export function pushCelebration(opts: PushCelebrationOpts): void {
  const item: CelebrationItem = { id: _itemId++, ...opts };
  _listeners.forEach(fn => fn(item));
}

const DISPLAY_MS = 1500;

// ── Radial-ray burst ─────────────────────────────────────────────────────────
function RadialRays({ color }: { color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.3, rotate: 0 }}
      animate={{ opacity: [0, 0.9, 0], scale: 1.7, rotate: 60 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      style={{
        position: "absolute",
        width: 300,
        height: 300,
        borderRadius: "50%",
        background: `repeating-conic-gradient(${color} 0deg 7deg, transparent 7deg 28deg)`,
        filter: `drop-shadow(0 0 28px ${color})`,
        pointerEvents: "none",
      }}
    />
  );
}

// ── One celebration popup ───────────────────────────────────────────────────
function CelebrationNode({ item, onDone }: { item: CelebrationItem; onDone: () => void }) {
  const color = item.color ?? "var(--gold)";

  useEffect(() => {
    const t = setTimeout(onDone, DISPLAY_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <RadialRays color={color} />
      <motion.div
        initial={{ opacity: 0, scale: 0.5, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: -10 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.22, 1] }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          style={{
            fontSize: 56,
            lineHeight: 1,
            filter: `drop-shadow(0 0 18px ${color})`,
          }}
        >
          {item.icon}
        </motion.div>
        <div
          className="chroma"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 24,
            letterSpacing: "0.1em",
            color,
            textShadow: `0 0 18px ${color}`,
            textAlign: "center",
            whiteSpace: "nowrap",
          }}
        >
          {item.label}
        </div>
        {item.sublabel && (
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.26em",
            color: "var(--dim)",
            textAlign: "center",
          }}>
            {item.sublabel}
          </div>
        )}
        {item.detail && (
          <div style={{
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            color: "rgba(255,255,255,0.7)",
            textAlign: "center",
          }}>
            {item.detail}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── CelebrationLayer — mount once at the app shell root ─────────────────────
export function CelebrationLayer() {
  const [queue, setQueue] = useState<CelebrationItem[]>([]);
  const [current, setCurrent] = useState<CelebrationItem | null>(null);

  useEffect(() => {
    const add: AddFn = (item) => setQueue(prev => [...prev, item]);
    _listeners.add(add);
    return () => { _listeners.delete(add); };
  }, []);

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue(prev => prev.slice(1));
    }
  }, [queue, current]);

  return (
    <AnimatePresence>
      {current && (
        <CelebrationNode key={current.id} item={current} onDone={() => setCurrent(null)} />
      )}
    </AnimatePresence>
  );
}
