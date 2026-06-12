import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../store";
import { ELEMENT_CATALOG } from "../features/elements/catalog";
import { formatCount } from "../lib/format";
import { BeatSyncWave } from "./BeatSyncWave";
import { DuetLoopWave } from "./DuetLoopWave";
import { ElementUnlockSheet } from "./ElementUnlockSheet";
import type { ElementDef } from "../features/elements/types";
import type { Wallet } from "../features/economy/types";

export function ElementStage() {
  const ownedElements = useGameStore(s => s.ownedElements);
  const activeWave = useGameStore(s => s.activeWave);
  const wallet = useGameStore(s => s.wallet);

  const [sheetDef, setSheetDef] = useState<ElementDef | null>(null);
  const [bonusFlash, setBonusFlash] = useState(false);
  const [flowFlash, setFlowFlash] = useState(false);

  const locked = ELEMENT_CATALOG.filter(d => !ownedElements[d.id]);

  const handleAllPerfect = () => {
    setBonusFlash(true);
    setTimeout(() => setBonusFlash(false), 700);
  };

  const handleFlow = () => {
    setFlowFlash(true);
    setTimeout(() => setFlowFlash(false), 700);
  };

  return (
    <div style={{ position: 'absolute', top: 56, left: 0, right: 0, height: '35%', pointerEvents: 'none' }}>

      {/* ── Locked element pods (06§3: dock at the stage's top edge) ────── */}
      {locked.length > 0 && (
        <div style={{
          position: 'absolute', top: 4, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', gap: 12,
          pointerEvents: 'auto',
        }}>
          {locked.map(def => (
            <LockedPod key={def.id} def={def} wallet={wallet} onTap={() => setSheetDef(def)} />
          ))}
        </div>
      )}

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

      {/* ── Unlock sheet ──────────────────────────────────────────────── */}
      {sheetDef && <ElementUnlockSheet def={sheetDef} onClose={() => setSheetDef(null)} />}
    </div>
  );
}

function LockedPod({ def, wallet, onTap }: { def: ElementDef; wallet: Wallet; onTap: () => void }) {
  const followersMet = wallet.followers >= def.requires.followers;
  const withinReach = followersMet && wallet.coins >= def.requires.coins * 0.8;

  return (
    <motion.button
      onPointerDown={e => { e.stopPropagation(); onTap(); }}
      animate={withinReach ? { opacity: [0.55, 1, 0.55] } : { opacity: 0.55 }}
      transition={withinReach ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : undefined}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        padding: '6px 10px',
        borderRadius: 12,
        background: 'rgba(0,0,0,0.4)',
        border: `1px solid ${withinReach ? 'var(--cyan)' : 'rgba(255,255,255,0.15)'}`,
        cursor: 'pointer',
      }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.15em', color: 'var(--dim)' }}>
        🔒 ???
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--dim)' }}>
        {formatCount(def.requires.coins)} 🪙 · needs {formatCount(def.requires.followers)} followers
      </span>
    </motion.button>
  );
}
