import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useGameStore } from "../../store";
import { computeRunParamsBreakdown, type RunParamsBreakdown } from "../../features/livestream/computeRunParams";
import { getTrendHeat } from "../../features/social/trends";
import { formatCount } from "../../lib/format";
import { isFeatureUnlocked } from "../../features/metrics/unlocks";
import { REACTION_CATALOG, REACTION_ICON } from "../../features/livestream/reactions";

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
  const breakdown = computeRunParamsBreakdown(
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
            <LoadoutPanel topic={topic} breakdown={breakdown} />
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

// 13.2 (09 §B): the meta→run bridge made visible — every number attributed to its
// source (followers / skill / gear / trend) so gear/skill purchases read as "this
// makes runs better." Sourced from computeRunParamsBreakdown — never duplicates
// computeRunParams' math, so it can't drift from the actual run start.
function LoadoutPanel({ topic, breakdown }: { topic: string; breakdown: RunParamsBreakdown }) {
  const { params, viewers, giftRate, hypeDecay } = breakdown;

  const viewerParts: string[] = [`base ${formatCount(viewers.base)}`];
  if (viewers.fromFollowers > 0.5) viewerParts.push(`+${formatCount(viewers.fromFollowers)} followers`);
  if (viewers.fromGear > 0.5) viewerParts.push(`+${formatCount(viewers.fromGear)} gear`);
  if (viewers.charismaLevel > 0) viewerParts.push(`×${viewers.charismaMult.toFixed(2)} Charisma L${viewers.charismaLevel}`);
  if (viewers.gearMult !== 1) viewerParts.push(`×${viewers.gearMult.toFixed(2)} gear`);
  if (viewers.trendMult !== 1) viewerParts.push(`×${viewers.trendMult.toFixed(2)} #${topic}`);

  const giftParts: string[] = [];
  if (giftRate.monetizationLevel > 0) giftParts.push(`×${giftRate.monetizationMult.toFixed(2)} Monetization L${giftRate.monetizationLevel}`);
  if (giftRate.gearMult !== 1) giftParts.push(`×${giftRate.gearMult.toFixed(2)} gear`);

  const decayParts: string[] = [];
  if (hypeDecay.stagecraftLevel > 0) decayParts.push(`−${Math.round(hypeDecay.stagecraftReduction * 100)}% Stagecraft L${hypeDecay.stagecraftLevel}`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <LoadoutRow
        label="STARTING VIEWERS"
        value={`~${formatCount(params.startViewers)}`}
        detail={viewerParts.join(' · ')}
      />
      <LoadoutRow
        label="GIFT RATE"
        value={`${params.giftRate.toFixed(2)}/s`}
        detail={giftParts.length > 0 ? giftParts.join(' · ') : 'base only'}
      />
      <LoadoutRow
        label="HYPE DECAY"
        value={`${params.hypeDecayPerSec.toFixed(2)}/s`}
        detail={decayParts.length > 0 ? decayParts.join(' · ') : 'base only'}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--dim)', letterSpacing: '0.14em' }}>
          REACTIONS READY
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {params.reactions.map(id => (
            <div key={id} style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 8px', borderRadius: 999,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text)', letterSpacing: '0.06em',
            }}>
              <span>{REACTION_ICON[id]}</span>
              <span>{REACTION_CATALOG[id].name.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoadoutRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--dim)', letterSpacing: '0.14em' }}>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: 'var(--cyan)' }}>
          {value}
        </span>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.02em' }}>
        {detail}
      </div>
    </div>
  );
}
