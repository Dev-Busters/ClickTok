import { useGameStore } from "../store";
import { avatarGradient } from "../lib/avatar";
import { formatCount } from "../lib/format";
import { CurrencyPill } from "./CurrencyBar";

export function ProfileHeader() {
  const handle               = useGameStore(s => s.handle);
  const wallet               = useGameStore(s => s.wallet);
  const viewsTotal           = useGameStore(s => s.viewsTotal);
  const streams              = useGameStore(s => s.streams);
  const passiveCoinsPerSec   = useGameStore(s => s.passiveCoinsPerSec);
  const passiveFollowersPerSec = useGameStore(s => s.passiveFollowersPerSec);

  const initials = (handle || "?").slice(0, 2).toUpperCase();

  const hasPassive = passiveCoinsPerSec > 0 || passiveFollowersPerSec > 0;

  return (
    <div style={{ width: '100%', maxWidth: '384px', padding: '22px 16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      {/* Avatar */}
      <div style={{
        width: '84px',
        height: '84px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: avatarGradient(handle || "creator"),
        border: '2px solid rgba(255,255,255,0.12)',
        boxShadow: '0 0 24px rgba(255,255,255,0.06)',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '32px', color: '#fff', letterSpacing: '0.05em' }}>
          {initials}
        </span>
      </div>

      {/* Handle */}
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: 700, color: '#fff' }}>
        @{handle}
      </span>

      {/* Primary TikTok 3-stat row */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0', marginTop: '4px' }}>
        <ProfileStat label="Following" value="0" />
        <StatDivider />
        <ProfileStat label="Followers" value={formatCount(wallet.followers)} />
        <StatDivider />
        <ProfileStat label="Likes" value={formatCount(wallet.likes)} />
      </div>

      {/* Secondary lifetime row */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0' }}>
        <ProfileStat label="Views" value={formatCount(viewsTotal)} small />
        <StatDivider />
        <ProfileStat label="Total Followers" value={formatCount(wallet.totalFollowers)} small />
        <StatDivider />
        <ProfileStat label="Streams" value={formatCount(streams)} small />
      </div>

      {/* Currency pills */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
        <CurrencyPill color="var(--gold)" label="coins" value={formatCount(wallet.coins)} shape="coin" />
        <CurrencyPill color="var(--cyan)" label="diamonds" value={formatCount(wallet.diamonds)} shape="diamond" />
      </div>

      {/* Passive income pill */}
      {hasPassive && (
        <div style={{
          display: 'flex', gap: '6px', alignItems: 'center',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px',
          padding: '3px 10px',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--dim)', letterSpacing: '0.06em' }}>passive</span>
          {passiveCoinsPerSec > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--gold)', letterSpacing: '0.04em' }}>
              +{formatCount(passiveCoinsPerSec)}/s 🪙
            </span>
          )}
          {passiveFollowersPerSec > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--cyan)', letterSpacing: '0.04em' }}>
              +{formatCount(passiveFollowersPerSec)}/s 👤
            </span>
          )}
        </div>
      )}

      {/* Bio */}
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--dim)', letterSpacing: '0.02em' }}>
        becoming the algorithm
      </span>
    </div>
  );
}

function ProfileStat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', minWidth: small ? '72px' : '76px' }}>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: small ? '14px' : '17px', fontWeight: 700, color: small ? 'rgba(255,255,255,0.75)' : '#fff', lineHeight: 1.2 }}>
        {value}
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: small ? '10px' : '12px', color: 'var(--dim)' }}>
        {label}
      </div>
    </div>
  );
}

function StatDivider() {
  return <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.1)' }} />;
}
