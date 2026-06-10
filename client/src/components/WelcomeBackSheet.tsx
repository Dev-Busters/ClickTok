import { motion } from "framer-motion";
import type { IdleReport } from "../store";
import { formatCount } from "../lib/format";

function formatDuration(sec: number): string {
  const totalMin = Math.floor(sec / 60);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function WelcomeBackSheet({ report, onDismiss }: { report: IdleReport; onDismiss: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '24px',
      }}
    >
      <motion.div
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
          OFFLINE FOR {formatDuration(report.elapsedSec).toUpperCase()}
        </div>
        <div
          className="chroma"
          style={{ fontFamily: 'var(--font-display)', fontSize: '32px', letterSpacing: '0.04em', color: 'var(--text)', marginBottom: '24px' }}
        >
          WELCOME BACK
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', marginBottom: '28px' }}>
          <Stat label="COINS" value={`+${formatCount(report.coins)}`} color="var(--cyan)" />
          <Stat label="FOLLOWERS" value={`+${formatCount(report.followers)}`} color="var(--red)" />
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onDismiss}
          style={{
            width: '100%',
            padding: '14px',
            fontFamily: 'var(--font-display)',
            fontSize: '18px',
            letterSpacing: '0.12em',
            color: '#000',
            background: 'var(--cyan)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          COLLECT
        </motion.button>
      </motion.div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--dim)', letterSpacing: '0.2em' }}>{label}</div>
    </div>
  );
}
