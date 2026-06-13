import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

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
  driftX: number; // px of horizontal drift during rise
}

// ── Module-level event bus ─────────────────────────────────────────────────────
const LANE_OFFSETS = [-70, -25, 25, 70] as const;
let _laneIdx = 0;
let _itemId = 0;

type AddFn = (item: FloatItem) => void;
const _listeners = new Set<AddFn>();

export function pushFloatText(opts: PushFloatOpts): void {
  const isCenter = opts.kind === "callout" || opts.kind === "flow";
  const laneX = isCenter ? 0 : LANE_OFFSETS[_laneIdx++ % 4];
  // ±10px jitter, −8°…+8° tilt, slight horizontal drift
  const jitter = (Math.random() - 0.5) * 20;
  const tilt = (Math.random() - 0.5) * 16;
  const driftX = (Math.random() - 0.5) * 40;

  const item: FloatItem = {
    id: _itemId++,
    text: opts.text,
    kind: opts.kind,
    magnitude: opts.magnitude,
    color: opts.color,
    x: laneX + jitter,
    tilt,
    driftX,
  };
  _listeners.forEach(fn => fn(item));
}

// ── Style helpers ──────────────────────────────────────────────────────────────
function getColor(kind: FloatKind, magnitude: number, override?: string): string {
  if (override) return override;
  if (kind === "perfect") return "var(--gold)";
  if (kind === "good") return "var(--cyan)";
  if (kind === "ok") return "var(--dim)";
  if (kind === "miss") return "var(--red)";
  if (kind === "callout" || kind === "flow") return "var(--gold)";
  // coin: magnitude tier color
  if (magnitude >= 3) return "var(--gold)";
  return "rgba(255,255,255,0.92)";
}

function getFontSize(kind: FloatKind, magnitude: number): number {
  if (kind === "callout" || kind === "flow") return 26;
  if (magnitude >= 10) return 30;
  if (magnitude >= 3) return 22;
  return 16;
}

function getTextShadow(color: string, kind: FloatKind, magnitude: number): string | undefined {
  if (kind === "callout" || kind === "flow")
    return `0 0 18px ${color}, 0 2px 8px rgba(0,0,0,0.9)`;
  if (magnitude >= 10)
    return `0 0 14px ${color}cc, 0 1px 0 rgba(0,0,0,0.85)`;
  if (magnitude >= 3 || kind === "perfect" || kind === "good")
    return `0 0 8px ${color}99, 1px 1px 0 rgba(0,0,0,0.7)`;
  return undefined;
}

// ── FloatNode ─────────────────────────────────────────────────────────────────
function FloatNode({ item, onDone }: { item: FloatItem; onDone: () => void }) {
  const isTier3 = item.magnitude >= 10;
  const isCallout = item.kind === "callout" || item.kind === "flow";
  const color = getColor(item.kind, item.magnitude, item.color);
  const fontSize = getFontSize(item.kind, item.magnitude);
  const textShadow = getTextShadow(color, item.kind, item.magnitude);
  // Tier-3 gets "!" appended unless the callout already ends with "!"
  const displayText =
    isTier3 && !item.text.endsWith("!") ? item.text + "!" : item.text;

  const dur = isCallout ? 1.35 : 1.15;

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
      initial={{ y: 0, opacity: 1, rotate: item.tilt, scale: isTier3 ? 1.3 : 1 }}
      animate={{ y: -130, x: item.driftX, opacity: [1, 1, 0], scale: 1 }}
      exit={{}}
      transition={{
        y: { duration: dur, ease: "easeOut" },
        x: { duration: dur, ease: "easeOut" },
        opacity: { duration: dur, times: [0, 0.55, 1] },
        scale: isTier3
          ? { type: "spring", stiffness: 620, damping: 18 }
          : { duration: 0.05 },
        rotate: { duration: 0 },
      }}
      onAnimationComplete={onDone}
    >
      <span
        style={{
          whiteSpace: "nowrap",
          fontFamily: "var(--font-display)",
          fontSize,
          fontWeight: isTier3 || isCallout ? 700 : 600,
          color,
          textShadow,
          WebkitTextStroke:
            isTier3
              ? "1.5px rgba(0,0,0,0.85)"
              : item.magnitude >= 3
                ? "0.5px rgba(0,0,0,0.6)"
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
export function FloatingTextLayer() {
  const [items, setItems] = useState<FloatItem[]>([]);

  useEffect(() => {
    const add: AddFn = (item) =>
      setItems(prev => [...prev.slice(-(12 - 1)), item]);
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
