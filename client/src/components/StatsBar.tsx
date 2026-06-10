import { useGameStore } from "../store/gameStore";
import { formatCount } from "../lib/format";

export function StatsBar() {
  const followers = useGameStore(s => s.wallet.followers);
  const coins = useGameStore(s => s.wallet.coins);
  const likes = useGameStore(s => s.wallet.likes);
  const comments = useGameStore(s => s.comments);
  const passiveFollowersPerSec = useGameStore(s => s.passiveFollowersPerSec);
  const multiplier = useGameStore(s => s.multiplier);

  return (
    <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px' }}>
      {/* Hero follower count */}
      <div style={{ textAlign: 'center', marginBottom: '6px' }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(76px, 22vw, 108px)',
          lineHeight: 0.88,
          color: 'var(--text)',
          letterSpacing: '0.02em',
        }}>
          {formatCount(followers)}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '10px',
          color: 'var(--dim)',
          letterSpacing: '0.28em',
          marginTop: '10px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '14px',
        }}>
          <span>FOLLOWERS</span>
          {passiveFollowersPerSec > 0 && (
            <span style={{ color: 'var(--cyan)' }}>
              +{formatCount(passiveFollowersPerSec * multiplier)}/s
            </span>
          )}
        </div>
      </div>

      {/* Secondary stats — broadcast HUD */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginTop: '18px',
        padding: '12px 24px',
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <HudStat label="LIKES" value={formatCount(likes)} color="var(--red)" />
        <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.07)' }} />
        <HudStat label="COINS" value={formatCount(coins)} color="var(--cyan)" />
        <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.07)' }} />
        <HudStat label="COMMENTS" value={formatCount(comments)} color="var(--text)" />
        {multiplier > 1 && (
          <>
            <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.07)' }} />
            <HudStat label="BOOST" value={`×${multiplier.toFixed(1)}`} color="var(--cyan)" />
          </>
        )}
      </div>
    </div>
  );
}

function HudStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--dim)', letterSpacing: '0.22em' }}>{label}</div>
    </div>
  );
}
