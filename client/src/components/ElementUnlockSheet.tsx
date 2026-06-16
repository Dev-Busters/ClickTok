import { motion } from "framer-motion";
import { useGameStore } from "../store";
import { formatCount } from "../lib/format";
import { pushCelebration } from "./fx/CelebrationLayer";
import type { ElementDef } from "../features/elements/types";

export function ElementUnlockSheet({ def, onClose }: { def: ElementDef; onClose: () => void }) {
  const wallet = useGameStore(s => s.wallet);
  const unlockElement = useGameStore(s => s.unlockElement);

  const followersMet = wallet.followers >= def.requires.followers;
  const coinsMet = wallet.coins >= def.requires.coins;
  const canUnlock = followersMet && coinsMet;

  const handleUnlock = () => {
    if (unlockElement(def.id)) {
      pushCelebration({
        icon: "🔓",
        label: `${def.name} UNLOCKED`,
        sublabel: "NEW ELEMENT",
        detail: def.tagline,
        color: "var(--gold)",
      });
      onClose();
    }
  };

  return (
    <div
      onPointerDown={e => { e.stopPropagation(); onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '24px',
        pointerEvents: 'auto',
      }}
    >
      <motion.div
        onPointerDown={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: '100%',
          maxWidth: '320px',
          background: 'var(--bg2)',
          border: '1px solid var(--dim)',
          padding: '28px 24px',
          textAlign: 'center',
          boxShadow: '0 0 40px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)', letterSpacing: '0.28em', marginBottom: '8px' }}>
          NEW ELEMENT
        </div>
        <div
          className="chroma"
          style={{ fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '0.04em', color: 'var(--text)', marginBottom: '10px' }}
        >
          {def.name}
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'rgba(255,255,255,0.75)', marginBottom: '20px' }}>
          {def.tagline}
        </div>

        {/* Demo loop */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <DemoLoop id={def.id} />
        </div>

        {/* Requirements */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '24px' }}>
          <Requirement
            label="FOLLOWERS"
            value={`${formatCount(wallet.followers)} / ${formatCount(def.requires.followers)}`}
            met={followersMet}
          />
          <Requirement
            label="COST"
            value={`${formatCount(wallet.coins)} / ${formatCount(def.requires.coins)} 🪙`}
            met={coinsMet}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <motion.button
            whileTap={canUnlock ? { scale: 0.97 } : undefined}
            onClick={handleUnlock}
            disabled={!canUnlock}
            style={{
              flex: 1,
              padding: '14px',
              fontFamily: 'var(--font-display)',
              fontSize: '16px',
              letterSpacing: '0.12em',
              color: canUnlock ? '#000' : 'var(--dim)',
              background: canUnlock ? 'var(--gold)' : 'rgba(255,255,255,0.06)',
              border: canUnlock ? 'none' : '1px solid var(--dim)',
              cursor: canUnlock ? 'pointer' : 'default',
            }}
          >
            UNLOCK
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onClose}
            style={{
              padding: '14px 20px',
              fontFamily: 'var(--font-display)',
              fontSize: '16px',
              letterSpacing: '0.12em',
              color: 'var(--text)',
              background: 'transparent',
              border: '1px solid var(--dim)',
              cursor: 'pointer',
            }}
          >
            CLOSE
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

function Requirement({ label, value, met }: { label: string; value: string; met: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: met ? 'var(--cyan)' : 'var(--red)' }}>
        {value}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--dim)', letterSpacing: '0.2em' }}>{label}</div>
    </div>
  );
}

// Tiny looping demo of the wave mechanic — 06§3: "a tiny looping demo animation
// of the mechanic" shown on the unlock sheet.
function DemoLoop({ id }: { id: ElementDef["id"] }) {
  if (id === "beat_sync") {
    return (
      <div style={{ display: 'flex', gap: 16 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ position: 'relative', width: 36, height: 36 }}>
            <div style={{
              position: 'absolute', inset: 0,
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.25)',
              background: 'rgba(0,0,0,0.45)',
            }} />
            <motion.div
              animate={{ scale: [2.2, 1, 0.9], opacity: [0.2, 1, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.45, ease: "linear" }}
              style={{
                position: 'absolute', inset: 0,
                borderRadius: '50%',
                border: '2px solid var(--cyan)',
                boxShadow: '0 0 8px var(--cyan)',
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  // duet_loop — placeholder demo (element implemented in task 7.4)
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.5 }}
          style={{
            width: 36, height: 36,
            borderRadius: '50%',
            border: '2px solid var(--red)',
            background: 'rgba(0,0,0,0.45)',
          }}
        />
      ))}
    </div>
  );
}
