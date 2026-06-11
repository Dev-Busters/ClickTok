import { useGameStore } from "../store";
import { computeRunParams } from "../features/livestream/computeRunParams";
import { getTrendHeat } from "../features/social/trends";
import { formatCount } from "../lib/format";

export function LiveReadinessPanel() {
  const followers = useGameStore(s => s.wallet.followers);
  const followerConversion = useGameStore(s => s.followerConversion);
  const skillLevels = useGameStore(s => s.skillLevels);
  const ownedUpgrades = useGameStore(s => s.ownedUpgrades);
  const activeTrend = useGameStore(s => s.activeTrend);
  const trendsAvailable = useGameStore(s => s.trendsAvailable);

  const topic = activeTrend ?? "trending";
  const trendHeat = getTrendHeat(trendsAvailable, topic);
  const params = computeRunParams(
    { followers, followerConversion, skillLevels, ownedUpgrades },
    topic,
    trendHeat,
  );

  return (
    <div style={{
      width: '100%',
      maxWidth: '384px',
      padding: '0 16px',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '14px 16px',
        border: '1px solid rgba(255,31,75,0.18)',
        background: 'rgba(255,31,75,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'var(--red)',
            boxShadow: '0 0 8px var(--red)',
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)', letterSpacing: '0.2em' }}>
            LIVE READINESS
          </span>
        </div>

        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text)', lineHeight: 1.4 }}>
          You'd start at <strong style={{ color: 'var(--cyan)' }}>~{formatCount(params.startViewers)}</strong> viewers
          on <span style={{ color: 'var(--gold)' }}>#{topic}</span> → GO LIVE
        </div>

        <div style={{ display: 'flex', gap: '20px' }}>
          <ReadinessStat label="GIFT RATE" value={`${params.giftRate.toFixed(2)}/s`} />
          <ReadinessStat label="HYPE DECAY" value={`${params.hypeDecayPerSec.toFixed(2)}/s`} />
          <ReadinessStat label="FLOP FLOOR" value={formatCount(params.flopFloor)} />
        </div>
      </div>
    </div>
  );
}

function ReadinessStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text)' }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--dim)', letterSpacing: '0.18em' }}>{label}</div>
    </div>
  );
}
