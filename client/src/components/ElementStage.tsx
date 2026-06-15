import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../store";
import { BeatSyncWave } from "./BeatSyncWave";
import { DuetLoopWave } from "./DuetLoopWave";
import { HoldDropWave } from "./HoldDropWave";
import { SwipeHitsWave } from "./SwipeHitsWave";

export function ElementStage() {
  const activeWave = useGameStore(s => s.activeWave);

  const [bonusFlash, setBonusFlash] = useState(false);
  const [flowFlash, setFlowFlash] = useState(false);

  const handleAllPerfect = () => {
    setBonusFlash(true);
    setTimeout(() => setBonusFlash(false), 700);
  };

  const handleFlow = () => {
    setFlowFlash(true);
    setTimeout(() => setFlowFlash(false), 700);
  };

  return (
    <div style={{ position: 'absolute', top: 88, left: 0, right: 0, height: '30%', pointerEvents: 'none', zIndex: 20 }}>

      {/* ── Active wave ───────────────────────────────────────────────── */}
      {activeWave?.element === "beat_sync" && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
          <BeatSyncWave wave={activeWave} onAllPerfect={handleAllPerfect} />
        </div>
      )}
      {activeWave?.element === "duet_loop" && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
          <DuetLoopWave wave={activeWave} onFlow={handleFlow} />
        </div>
      )}
      {activeWave?.element === "hold_drop" && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
          <HoldDropWave wave={activeWave} />
        </div>
      )}
      {activeWave?.element === "swipe_hits" && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
          <SwipeHitsWave wave={activeWave} onAllPerfect={handleAllPerfect} />
        </div>
      )}

      {/* ── All-PERFECT celebration (06§3: full-screen white pulse + banner) */}
      <AnimatePresence>
        {bonusFlash && (
          <>
            <motion.div
              initial={{ opacity: 0.85 }}
              animate={{ opacity: 0 }}
              exit={{}}
              transition={{ duration: 0.5 }}
              style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 9999, pointerEvents: 'none' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              style={{
                position: 'absolute', top: '40%', left: '50%', transform: 'translateX(-50%)',
                fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '0.15em',
                color: 'var(--gold)', textShadow: '0 0 18px var(--gold)',
                pointerEvents: 'none',
              }}
            >
              +BONUS
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── FLOW celebration (06§3: gold triangle flourish + banner) ────── */}
      <AnimatePresence>
        {flowFlash && (
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.4, rotate: -20 }}
              animate={{ opacity: [0, 1, 0], scale: 1.4, rotate: 20 }}
              exit={{}}
              transition={{ duration: 0.7, ease: "easeOut" }}
              style={{
                position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)',
                width: 0, height: 0,
                borderLeft: '40px solid transparent',
                borderRight: '40px solid transparent',
                borderBottom: '70px solid var(--gold)',
                filter: 'drop-shadow(0 0 16px var(--gold))',
                pointerEvents: 'none',
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              style={{
                position: 'absolute', top: '40%', left: '50%', transform: 'translateX(-50%)',
                fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '0.15em',
                color: 'var(--gold)', textShadow: '0 0 18px var(--gold)',
                pointerEvents: 'none',
              }}
            >
              FLOW
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
