import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../store/gameStore";
import { formatCount } from "../lib/format";

type FloatingNumber = { id: number; x: number; y: number; value: number };

let nextId = 0;

export function TapButton() {
  const tap = useGameStore(s => s.tap);
  const tapPower = useGameStore(s => s.tapPower);
  const multiplier = useGameStore(s => s.multiplier);
  const [floaters, setFloaters] = useState<FloatingNumber[]>([]);
  const [pressed, setPressed] = useState(false);

  const handleTap = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    tap();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const value = Math.floor(tapPower * multiplier);
    setFloaters(prev => [...prev.slice(-8), { id: nextId++, x, y, value }]);
  }, [tap, tapPower, multiplier]);

  return (
    <div className="relative select-none">
      <motion.button
        onPointerDown={(e) => { setPressed(true); handleTap(e); }}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        animate={{ scale: pressed ? 0.93 : 1 }}
        transition={{ type: "spring", stiffness: 700, damping: 30 }}
        className="relative w-48 h-48 rounded-full bg-gradient-to-br from-[#fe2c55] to-[#ff6b8a] shadow-[0_0_40px_rgba(254,44,85,0.5)] flex items-center justify-center flex-col gap-1 cursor-pointer border-4 border-white/20"
      >
        {/* TikTok logo-ish icon */}
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <path d="M46 14c0 8.8-7.2 16-16 16V14h16z" fill="white" opacity="0.9"/>
          <path d="M30 30v20a10 10 0 1 1-10-10h10" fill="white"/>
        </svg>
        <span className="text-white text-xs font-bold tracking-wider opacity-80">TAP TO POST</span>
      </motion.button>

      {/* Floating +N popups */}
      <AnimatePresence>
        {floaters.map(f => (
          <motion.div
            key={f.id}
            initial={{ opacity: 1, y: 0, x: f.x - 20, scale: 1 }}
            animate={{ opacity: 0, y: -80, scale: 1.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            onAnimationComplete={() => setFloaters(prev => prev.filter(p => p.id !== f.id))}
            className="absolute top-0 left-0 pointer-events-none font-black text-[#fe2c55] text-lg drop-shadow-[0_0_6px_rgba(254,44,85,0.8)]"
            style={{ top: f.y }}
          >
            +{formatCount(f.value)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
