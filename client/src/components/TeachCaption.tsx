import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ElementId } from "../features/elements/types";

// 11.3 (07 §C0): one-time per-element teach caption. Mirrors the TEB teach pattern
// (TapCore.tsx) — shows on first wave of the element, auto-dismisses after 3s,
// then calls onDismiss() which persists the seen flag via setElementTeachSeen().

type Props = {
  elementId?: ElementId; // optional — mod-perk teach doesn't bind to an element
  text: string;
  seen: boolean;         // already seen in a prior session → skip immediately
  onDismiss: () => void; // called once to mark it seen in persistent store
};

export function TeachCaption({ text, seen, onDismiss }: Props) {
  const [visible, setVisible] = useState(!seen);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (seen) return;
    // Auto-dismiss after 3s and persist
    timerRef.current = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 3000);
    return () => clearTimeout(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="teach"
          initial={{ opacity: 0, y: 6, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          style={{
            position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center',
            padding: '5px 14px', borderRadius: 8,
            background: 'rgba(0,0,0,0.72)',
            border: '1px solid rgba(255,255,255,0.10)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
          onClick={() => { setVisible(false); onDismiss(); }}
        >
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            letterSpacing: '0.12em',
            color: 'var(--dim)',
          }}>
            {text}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
