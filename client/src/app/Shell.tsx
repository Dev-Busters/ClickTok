import { motion } from "framer-motion";
import { useGameStore } from "../store";
import { GameScreen } from "../components/GameScreen";
import { BottomNav } from "../navigation/BottomNav";

export function Shell() {
  const activeTab = useGameStore(s => s.activeTab);
  const openSheet = useGameStore(s => s.openSheet);
  const setSheet = useGameStore(s => s.setSheet);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '420px',
        height: '100svh',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        borderLeft: '1px solid rgba(255,255,255,0.04)',
        borderRight: '1px solid rgba(255,255,255,0.04)',
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {activeTab === 'home' && <GameScreen />}
        {activeTab === 'discover' && (
          <PlaceholderScreen title="DISCOVER" subtitle="TRENDS & LEADERBOARD — COMING SOON" />
        )}
        {activeTab === 'inbox' && (
          <PlaceholderScreen title="INBOX" subtitle="NOTIFICATIONS — COMING SOON" />
        )}
        {activeTab === 'profile' && (
          <PlaceholderScreen title="PROFILE" subtitle="CHANNEL MANAGEMENT — COMING SOON" />
        )}
      </div>

      <BottomNav />

      {openSheet === 'create' && (
        <CreateSheetPlaceholder onClose={() => setSheet(null)} />
      )}
    </div>
  );
}

function PlaceholderScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div
        className="chroma"
        style={{ fontFamily: 'var(--font-display)', fontSize: '36px', letterSpacing: '0.06em', color: 'var(--text)' }}
      >
        {title}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--dim)', letterSpacing: '0.12em' }}>
        {subtitle}
      </div>
    </div>
  );
}

function CreateSheetPlaceholder({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 100,
      }}
    >
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: '100%',
          background: 'var(--bg2)',
          borderTop: '1px solid var(--dim)',
          padding: '28px 24px',
          textAlign: 'center',
        }}
      >
        <div
          className="chroma"
          style={{ fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '0.06em', color: 'var(--text)', marginBottom: '8px' }}
        >
          CREATE
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--dim)', letterSpacing: '0.12em', marginBottom: '24px' }}>
          POST / GO LIVE — COMING SOON
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onClose}
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
          CLOSE
        </motion.button>
      </motion.div>
    </div>
  );
}
