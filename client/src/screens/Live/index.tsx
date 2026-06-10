import { motion } from "framer-motion";
import { useGameStore } from "../../store";
import { useRunLoop } from "../../hooks/useRunLoop";
import { ProgressBar } from "../../components/ProgressBar";
import { LiveFeed } from "../../components/LiveFeed";
import { ReactionHotbar } from "../../components/ReactionHotbar";
import { formatCount } from "../../lib/format";

function hypeColor(hype: number): string {
  if (hype >= 80) return 'var(--red)';
  if (hype >= 50) return 'var(--gold)';
  return 'var(--cyan)';
}

function formatTimer(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function Live() {
  useRunLoop();

  const phase = useGameStore(s => s.phase);
  const params = useGameStore(s => s.params);
  const handle = useGameStore(s => s.handle);
  const viewers = useGameStore(s => s.viewers);
  const peakViewers = useGameStore(s => s.peakViewers);
  const hype = useGameStore(s => s.hype);
  const clockSec = useGameStore(s => s.clockSec);
  const collected = useGameStore(s => s.collected);
  const endRun = useGameStore(s => s.endRun);
  const returnToChannel = useGameStore(s => s.returnToChannel);
  const setTab = useGameStore(s => s.setTab);

  if (!params) return null;

  const handleBack = () => {
    returnToChannel();
    setTab('home');
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg)',
      zIndex: 50,
    }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 16px 0' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '40px', lineHeight: 1, color: 'var(--text)' }}>
            {formatCount(viewers)}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--dim)', letterSpacing: '0.22em', marginTop: '4px' }}>
            VIEWERS
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          {phase === 'live' && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => endRun('voluntary')}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.18em',
                color: 'var(--text)',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid var(--dim)',
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              END
            </motion.button>
          )}
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--text)' }}>
            {formatTimer(params.durationSec - clockSec)}
          </div>
        </div>
      </div>

      {/* Identity row */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '8px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: 'var(--red)',
            boxShadow: '0 0 8px var(--red)',
            animation: 'dot-pulse 1.6s ease-in-out infinite',
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)', letterSpacing: '0.18em' }}>LIVE</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)' }}>@{handle}</span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--gold)' }}>#{params.topic}</span>
      </div>

      {/* Hype meter */}
      <div style={{ padding: '20px 16px 0' }}>
        <ProgressBar value={hype} color={hypeColor(hype)} label="HYPE" />
      </div>

      {/* Stage + live feed */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          border: '2px dashed rgba(255,255,255,0.08)',
        }} />
        {phase === 'live' && <LiveFeed />}
      </div>

      {/* Collected ticker */}
      {phase === 'live' && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', padding: '0 16px 4px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--gold)' }}>
            🪙 {formatCount(collected.coins)}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--cyan)' }}>
            💎 {formatCount(collected.diamonds)}
          </span>
        </div>
      )}

      {/* Reaction hotbar */}
      {phase === 'live' && <ReactionHotbar />}

      {/* Results overlay */}
      {phase === 'results' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div className="chroma" style={{ fontFamily: 'var(--font-display)', fontSize: '32px', letterSpacing: '0.06em', color: 'var(--text)' }}>
            STREAM ENDED
          </div>
          <div style={{ display: 'flex', gap: '32px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--cyan)' }}>{formatCount(peakViewers)}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--dim)', letterSpacing: '0.18em' }}>PEAK VIEWERS</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: hypeColor(hype) }}>{Math.round(hype)}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--dim)', letterSpacing: '0.18em' }}>FINAL HYPE</div>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleBack}
            style={{
              padding: '14px 28px',
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              letterSpacing: '0.12em',
              color: '#000',
              background: 'var(--cyan)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            BACK TO CHANNEL
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}
