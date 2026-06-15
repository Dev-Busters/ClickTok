import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────────────────────
export type FloatKind =
  | "coin"
  | "perfect"
  | "good"
  | "ok"
  | "miss"
  | "callout"
  | "flow";

export interface PushFloatOpts {
  text: string;
  kind: FloatKind;
  /** Ratio vs base tap gain (gainPerPost × 1). Drives font-size tier. */
  magnitude: number;
  /** Explicit color override — pass the ring color for 'coin' items. */
  color?: string;
}

interface FloatItem {
  id: number;
  text: string;
  kind: FloatKind;
  magnitude: number;
  color?: string;
  x: number;     // px from screen center (lane + jitter)
  tilt: number;  // degrees
  driftX: number; // px of horizontal scatter during rise
  riseY: number;  // px of vertical rise (arc height)
}

// ── Module-level event bus ─────────────────────────────────────────────────────
// 6 lanes for a denser cascade without items overlapping mid-flight.
const LANE_OFFSETS = [-95, -57, -19, 19, 57, 95] as const;
let _laneIdx = 0;
let _itemId = 0;

type AddFn = (item: FloatItem) => void;
const _listeners = new Set<AddFn>();

export function pushFloatText(opts: PushFloatOpts): void {
  const isCenter = opts.kind === "callout" || opts.kind === "flow";
  const laneX = isCenter ? 0 : LANE_OFFSETS[_laneIdx++ % LANE_OFFSETS.length];
  // jitter + tilt + wide scatter drift for an arc-and-scatter rise
  const jitter = (Math.random() - 0.5) * 28;
  const tilt = (Math.random() - 0.5) * 24;
  const driftX = (Math.random() - 0.5) * 140;
  const riseY = 120 + Math.random() * 50;

  const item: FloatItem = {
    id: _itemId++,
    text: opts.text,
    kind: opts.kind,
    magnitude: opts.magnitude,
    color: opts.color,
    x: laneX + jitter,
    tilt,
    driftX,
    riseY,
  };
  _listeners.forEach(fn => fn(item));
}

// ── Style helpers ──────────────────────────────────────────────────────────────
// Tier 0: small/plain · Tier 1: bold accent · Tier 2: big payoff · Tier 3: mega/jackpot
function getTier(kind: FloatKind, magnitude: number): 0 | 1 | 2 | 3 {
  if (kind === "callout" || kind === "flow") return 2;
  if (magnitude >= 25) return 3;
  if (magnitude >= 10) return 2;
  if (magnitude >= 3) return 1;
  return 0;
}

const TIER_SIZE = [18, 26, 35, 46] as const;

function getColor(kind: FloatKind, magnitude: number, override?: string): string {
  if (override) return override;
  if (kind === "perfect") return "var(--gold)";
  if (kind === "good") return "var(--cyan)";
  if (kind === "ok") return "var(--dim)";
  if (kind === "miss") return "var(--red)";
  if (kind === "callout" || kind === "flow") return "var(--gold)";
  // coin: magnitude tier color
  const tier = getTier(kind, magnitude);
  if (tier >= 2) return "var(--gold)";
  if (tier === 1) return "var(--cyan)";
  return "rgba(255,255,255,0.92)";
}

function getFontSize(kind: FloatKind, magnitude: number): number {
  if (kind === "callout" || kind === "flow") return 32;
  return TIER_SIZE[getTier(kind, magnitude)];
}

function getTextShadow(color: string, kind: FloatKind, magnitude: number): string | undefined {
  const tier = getTier(kind, magnitude);
  if (kind === "callout" || kind === "flow")
    return `0 0 22px ${color}, 0 0 8px ${color}, 0 2px 8px rgba(0,0,0,0.9)`;
  if (tier === 3)
    return `0 0 24px ${color}, 0 0 10px #fff, 0 2px 0 rgba(0,0,0,0.9)`;
  if (tier === 2)
    return `0 0 16px ${color}cc, 0 1px 0 rgba(0,0,0,0.85)`;
  if (tier === 1 || kind === "perfect" || kind === "good")
    return `0 0 9px ${color}99, 1px 1px 0 rgba(0,0,0,0.7)`;
  return undefined;
}

// ── FloatNode ─────────────────────────────────────────────────────────────────
function FloatNode({ item, onDone }: { item: FloatItem; onDone: () => void }) {
  const tier = getTier(item.kind, item.magnitude);
  const isCallout = item.kind === "callout" || item.kind === "flow";
  const color = getColor(item.kind, item.magnitude, item.color);
  const fontSize = getFontSize(item.kind, item.magnitude);
  const textShadow = getTextShadow(color, item.kind, item.magnitude);
  // Tier-2 gets "!"; tier-3 gets "!!" — unless the text already ends with "!"
  const displayText =
    tier >= 3 && !item.text.endsWith("!") ? item.text + "!!"
    : tier === 2 && !item.text.endsWith("!") ? item.text + "!"
    : item.text;

  const dur = isCallout ? 1.4 : tier >= 2 ? 1.3 : 1.15;
  const initialScale = tier >= 3 ? 1.5 : tier === 2 ? 1.25 : 1;

  return (
    <motion.div
      key={item.id}
      style={{
        position: "absolute",
        left: `calc(50% + ${item.x}px)`,
        top: "50%",
        // zero-width flex centers the text span on the lane point
        display: "flex",
        justifyContent: "center",
        width: 0,
        pointerEvents: "none",
        userSelect: "none",
      }}
      initial={{ y: 0, x: 0, opacity: 1, rotate: item.tilt, scale: initialScale }}
      animate={{
        y: [0, -item.riseY * 0.45, -item.riseY],
        x: [0, item.driftX * 0.3, item.driftX],
        rotate: [item.tilt, item.tilt * 1.4, item.tilt * 0.3],
        opacity: [1, 1, 0],
        scale: 1,
      }}
      exit={{}}
      transition={{
        y: { duration: dur, ease: "easeOut", times: [0, 0.45, 1] },
        x: { duration: dur, ease: "easeOut", times: [0, 0.45, 1] },
        rotate: { duration: dur, ease: "easeOut", times: [0, 0.45, 1] },
        opacity: { duration: dur, times: [0, 0.55, 1] },
        scale: tier >= 2
          ? { type: "spring", stiffness: 560, damping: 17 }
          : { duration: 0.05 },
      }}
      onAnimationComplete={onDone}
    >
      <span
        style={{
          whiteSpace: "nowrap",
          fontFamily: "var(--font-display)",
          fontSize,
          fontWeight: tier >= 2 || isCallout ? 800 : tier === 1 ? 700 : 600,
          color,
          textShadow,
          WebkitTextStroke:
            tier >= 3 ? "2px rgba(0,0,0,0.9)"
            : tier === 2 ? "1.5px rgba(0,0,0,0.85)"
            : tier === 1 ? "0.75px rgba(0,0,0,0.6)"
            : undefined,
          letterSpacing: isCallout ? "0.08em" : undefined,
        }}
      >
        {displayText}
      </span>
    </motion.div>
  );
}

// ── FloatingTextLayer — mount once on Home ────────────────────────────────────
const MAX_ITEMS = 18;

export function FloatingTextLayer() {
  const [items, setItems] = useState<FloatItem[]>([]);

  useEffect(() => {
    const add: AddFn = (item) =>
      setItems(prev => [...prev.slice(-(MAX_ITEMS - 1)), item]);
    _listeners.add(add);
    return () => {
      _listeners.delete(add);
      setItems([]);
    };
  }, []);

  const remove = (id: number) =>
    setItems(prev => prev.filter(i => i.id !== id));

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 10,
        overflow: "hidden",
      }}
    >
      <AnimatePresence>
        {items.map(item => (
          <FloatNode key={item.id} item={item} onDone={() => remove(item.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
