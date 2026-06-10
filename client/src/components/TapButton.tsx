import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../store/gameStore";
import { formatCount } from "../lib/format";

type Floater = { id: number; x: number; y: number; value: number };

let nextId = 0;

export function TapButton() {
  const tap = useGameStore(s => s.tap);
  const tapPower = useGameStore(s => s.tapPower);
  const multiplier = useGameStore(s => s.multiplier);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [pressed, setPressed] = useState(false);

  const handleTap = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    tap();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const value = Math.floor(tapPower * multiplier);
    setFloaters(prev => [...prev.slice(-10), { id: nextId++, x, y, value }]);
  }, [tap, tapPower, multiplier]);

  return (
    <div style={{ position: 'relative', width: 224, height: 224, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

      {/* Slowly rotating outer ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '1px dashed rgba(255,31,75,0.3)',
        }}
      />

      {/* Static inner accent ring */}
      <div style={{
        position: 'absolute',
        inset: '14px',
        borderRadius: '50%',
        border: '1px solid rgba(255,255,255,0.05)',
      }} />

      {/* Corner crosshair brackets */}
      {(['tl','tr','bl','br'] as const).map(corner => (
        <div
          key={corner}
          style={{
            position: 'absolute',
            width: '14px',
            height: '14px',
            top:    corner.startsWith('t') ? 0 : undefined,
            bottom: corner.startsWith('b') ? 0 : undefined,
            left:   corner.endsWith('l')   ? 0 : undefined,
            right:  corner.endsWith('r')   ? 0 : undefined,
            borderTop:    corner.startsWith('t') ? '2px solid var(--red)' : undefined,
            borderBottom: corner.startsWith('b') ? '2px solid var(--red)' : undefined,
            borderLeft:   corner.endsWith('l')   ? '2px solid var(--red)' : undefined,
            borderRight:  corner.endsWith('r')   ? '2px solid var(--red)' : undefined,
          }}
        />
      ))}

      {/* Main tap button */}
      <motion.button
        onPointerDown={e => { setPressed(true); handleTap(e); }}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        animate={{ scale: pressed ? 0.91 : 1 }}
        transition={{ type: "spring", stiffness: 800, damping: 28 }}
        style={{
          width: 175,
          height: 175,
          borderRadius: '50%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          background: 'radial-gradient(circle at 38% 32%, #3d0015 0%, #1a000a 55%, #080005 100%)',
          border: '2px solid rgba(255,31,75,0.28)',
          cursor: 'pointer',
          animation: pressed ? 'none' : 'pulse-glow 2.6s ease-in-out infinite',
          boxShadow: pressed
            ? '0 0 55px rgba(255,31,75,0.85), inset 0 0 24px rgba(255,31,75,0.18)'
            : undefined,
          userSelect: 'none',
        }}
      >
        <svg width="54" height="54" viewBox="0 0 64 64" fill="none">
          <path d="M46 14c0 8.8-7.2 16-16 16V14h16z" fill="white" opacity="0.85"/>
          <path d="M30 30v20a10 10 0 1 1-10-10h10" fill="white"/>
        </svg>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.22em',
        }}>
          POST NOW
        </span>
      </motion.button>

      {/* Floating +N indicators */}
      <AnimatePresence>
        {floaters.map(f => (
          <motion.div
            key={f.id}
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -85, scale: 1.15 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: "easeOut" }}
            onAnimationComplete={() => setFloaters(prev => prev.filter(p => p.id !== f.id))}
            style={{
              position: 'absolute',
              left: f.x + 24 - 18,
              top: f.y + 24,
              fontFamily: 'var(--font-display)',
              fontSize: '28px',
              color: 'var(--red)',
              filter: 'drop-shadow(0 0 10px rgba(255,31,75,0.9))',
              pointerEvents: 'none',
              userSelect: 'none',
              lineHeight: 1,
            }}
          >
            +{formatCount(f.value)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
