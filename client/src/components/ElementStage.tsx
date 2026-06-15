import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../store";
import { BeatSyncWave } from "./BeatSyncWave";
import { DuetLoopWave } from "./DuetLoopWave";
import { HoldDropWave } from "./HoldDropWave";
import { SwipeHitsWave } from "./SwipeHitsWave";

const BAR_HEIGHTS = [0.35, 0.55, 0.70, 0.45, 0.80, 0.50, 0.65, 0.40];
const BAR_COLORS  = ["var(--cyan)", "var(--red)", "var(--gold)"];

function IdleBeatVisualizer({ combo }: { combo: number }) {
  const speed = 1 + Math.min(combo, 20) / 20 * 0.6; // 1.0 → 1.6× as combo rises

  return (
    <div style={{
      position:       "absolute",
      inset:          0,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      gap:            "5px",
      padding:        "12px 40px",
      pointerEvents:  "none",
    }}>
      {BAR_HEIGHTS.map((base, i) => (
        <motion.div
          key={i}
          style={{
            flex:            1,
            height:          "55%",
            background:      BAR_COLORS[i % BAR_COLORS.length],
            borderRadius:    "2px",
            transformOrigin: "center",
            opacity:         0.22,
          }}
          animate={{ scaleY: [base * 0.5, base, base * 0.55] }}
          transition={{
            duration:   1.3 / speed,
            repeat:     Infinity,
            repeatType: "mirror",
            ease:       "easeInOut",
            delay:      i * 0.11,
          }}
        />
      ))}
    </div>
  );
}

export function ElementStage() {
  const activeWave = useGameStore(s => s.activeWave);
  const combo      = useGameStore(s => s.combo);

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

      {/* ── Idle beat visualizer (gentle equalizer when no wave is active) ── */}
      <AnimatePresence>
        {!activeWave && (
          <motion.div
            key="idle-viz"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            style={{ position: 'absolute', inset: 0 }}
          >
            <IdleBeatVisualizer combo={combo} />
          </motion.div>
        )}
      </AnimatePresence>

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
