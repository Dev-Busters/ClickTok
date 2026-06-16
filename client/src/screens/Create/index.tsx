import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useGameStore } from "../../store";
import { computeRunParams } from "../../features/livestream/computeRunParams";
import { getTrendHeat } from "../../features/social/trends";
import { formatCount } from "../../lib/format";
import { isFeatureUnlocked } from "../../features/metrics/unlocks";

export function CreateSheet({ onClose }: { onClose: () => void }) {
  const wallet = useGameStore(s => s.wallet);
  const followerConversion = useGameStore(s => s.followerConversion);
  const skillLevels = useGameStore(s => s.skillLevels);
  const ownedUpgrades = useGameStore(s => s.ownedUpgrades);
  const activeTrend = useGameStore(s => s.activeTrend);
  const trendsAvailable = useGameStore(s => s.trendsAvailable);
  const startRun = useGameStore(s => s.startRun);
  const setTab = useGameStore(s => s.setTab);
  const publishVideo = useGameStore(s => s.publishVideo);
  const publishReadyAt = useGameStore(s => s.publishReadyAt);
  const metricsReached = useGameStore(s => s.metricsReached);
  const liveUnlocked = isFeatureUnlocked("live", metricsReached);

  const topic = activeTrend ?? "trending";
  const trendHeat = getTrendHeat(trendsAvailable, topic);
  const params = computeRunParams(
    { followers: wallet.followers, followerConversion, skillLevels, ownedUpgrades },
    topic,
    trendHeat,
  );

  // 04 §13.3: POST button shows a countdown while publishCooldownSec is active.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (now >= publishReadyAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [now, publishReadyAt]);
  const cooldownSec = Math.max(0, Math.ceil((publishReadyAt - now) / 1000));

  const handlePost = () => {
    const card = publishVideo();
    if (!card) return;
    setTab('home');
    onClose();
  };

  const handleGoLive = () => {
    startRun(topic);
    onClose();
  };

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
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          className="chroma"
          style={{ fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '0.06em', color: 'var(--text)', textAlign: 'center' }}
        >
          CREATE
        </div>

        <motion.button
          whileTap={cooldownSec === 0 ? { scale: 0.97 } : undefined}
          onClick={handlePost}
          disabled={cooldownSec > 0}
          style={{
            width: '100%',
            padding: '14px',
            fontFamily: 'var(--font-display)',
            fontSize: '18px',
            letterSpacing: '0.12em',
            color: cooldownSec > 0 ? 'var(--dim)' : 'var(--text)',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--dim)',
            cursor: cooldownSec > 0 ? 'default' : 'pointer',
          }}
        >
          {cooldownSec > 0 ? `POST (${cooldownSec}s)` : 'POST'}
        </motion.button>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '14px 16px',
          border: `1px solid ${liveUnlocked ? 'rgba(255,31,75,0.18)' : 'rgba(255,255,255,0.06)'}`,
          background: liveUnlocked ? 'rgba(255,31,75,0.04)' : 'rgba(255,255,255,0.02)',
          opacity: liveUnlocked ? 1 : 0.45,
        }}>
          {liveUnlocked ? (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text)', lineHeight: 1.4, textAlign: 'center' }}>
              Go live on <span style={{ color: 'var(--gold)' }}>#{topic}</span> at
              <strong style={{ color: 'var(--cyan)' }}> ~{formatCount(params.startViewers)}</strong> viewers
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)', letterSpacing: '0.14em', textAlign: 'center' }}>
              REACH 200 FOLLOWERS TO UNLOCK
            </div>
          )}

          <motion.button
            whileTap={liveUnlocked ? { scale: 0.97 } : undefined}
            onClick={liveUnlocked ? handleGoLive : undefined}
            style={{
              width: '100%',
              padding: '16px',
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              letterSpacing: '0.14em',
              color: liveUnlocked ? '#fff' : 'var(--dim)',
              background: liveUnlocked ? 'var(--red)' : 'rgba(255,255,255,0.04)',
              border: liveUnlocked ? 'none' : '1px solid rgba(255,255,255,0.08)',
              cursor: liveUnlocked ? 'pointer' : 'default',
            }}
          >
            GO LIVE
          </motion.button>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onClose}
          style={{
            width: '100%',
            padding: '14px',
            fontFamily: 'var(--font-display)',
            fontSize: '16px',
            letterSpacing: '0.12em',
            color: 'var(--dim)',
            background: 'transparent',
            border: '1px solid var(--dim)',
            cursor: 'pointer',
          }}
        >
          CLOSE
        </motion.button>
      </motion.div>
    </div>
  );
}
