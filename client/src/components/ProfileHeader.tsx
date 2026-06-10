import { useGameStore } from "../store";
import { formatCount } from "../lib/format";

// Deterministic hash → hue, so the same handle always gets the same avatar color.
function handleHue(handle: string): number {
  let hash = 0;
  for (let i = 0; i < handle.length; i++) {
    hash = (hash * 31 + handle.charCodeAt(i)) % 360;
  }
  return hash;
}

export function ProfileHeader() {
  const handle = useGameStore(s => s.handle);
  const wallet = useGameStore(s => s.wallet);

  const hue = handleHue(handle || "creator");
  const initials = (handle || "?").slice(0, 2).toUpperCase();

  return (
    <div style={{ width: '100%', maxWidth: '384px', padding: '22px 16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      {/* Avatar */}
      <div style={{
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, hsl(${hue}, 70%, 45%), hsl(${(hue + 60) % 360}, 70%, 35%))`,
        border: '2px solid rgba(255,255,255,0.08)',
        boxShadow: '0 0 24px rgba(255,255,255,0.06)',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: 'var(--text)', letterSpacing: '0.05em' }}>
          {initials}
        </span>
      </div>

      {/* Handle */}
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text)' }}>
        @{handle}
      </span>

      {/* Bio */}
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--dim)', letterSpacing: '0.02em' }}>
        becoming the algorithm
      </span>

      {/* Stat row */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '18px',
        marginTop: '10px',
        flexWrap: 'wrap',
      }}>
        <ProfileStat label="FOLLOWING" value="0" />
        <StatDivider />
        <ProfileStat label="FOLLOWERS" value={formatCount(wallet.followers)} />
        <StatDivider />
        <ProfileStat label="LIKES" value={formatCount(wallet.likes)} color="var(--red)" />
        <StatDivider />
        <ProfileStat label="COINS" value={formatCount(wallet.coins)} color="var(--cyan)" icon="🪙" />
        <StatDivider />
        <ProfileStat label="DIAMONDS" value={formatCount(wallet.diamonds)} color="var(--gold)" icon="💎" />
      </div>
    </div>
  );
}

function ProfileStat({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: color ?? 'var(--text)', lineHeight: 1 }}>
        {icon ? `${icon} ` : ''}{value}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--dim)', letterSpacing: '0.18em' }}>
        {label}
      </div>
    </div>
  );
}

function StatDivider() {
  return <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.07)' }} />;
}
