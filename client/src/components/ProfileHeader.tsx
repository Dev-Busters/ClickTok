import { useGameStore } from "../store";
import { avatarGradient } from "../lib/avatar";
import { formatCount } from "../lib/format";

export function ProfileHeader() {
  const handle = useGameStore(s => s.handle);
  const wallet = useGameStore(s => s.wallet);

  const initials = (handle || "?").slice(0, 2).toUpperCase();

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

      {/* TikTok 3-stat row */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0', marginTop: '4px' }}>
        <ProfileStat label="Following" value="0" />
        <StatDivider />
        <ProfileStat label="Followers" value={formatCount(wallet.followers)} />
        <StatDivider />
        <ProfileStat label="Likes" value={formatCount(wallet.likes)} />
      </div>

      {/* Currency pills (game currencies, kept separate from the TikTok stats) */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
        <CurrencyPill color="var(--gold)" label="coins" value={formatCount(wallet.coins)} shape="coin" />
        <CurrencyPill color="var(--cyan)" label="diamonds" value={formatCount(wallet.diamonds)} shape="diamond" />
      </div>

      {/* Bio */}
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--dim)', letterSpacing: '0.02em' }}>
        becoming the algorithm
      </span>
    </div>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', minWidth: '76px' }}>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
        {value}
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--dim)' }}>
        {label}
      </div>
    </div>
  );
}

function StatDivider() {
  return <div style={{ width: '1px', height: '22px', background: 'rgba(255,255,255,0.1)' }} />;
}

function CurrencyPill({ color, label, value, shape }: { color: string; label: string; value: string; shape: "coin" | "diamond" }) {
  return (
    <div
      title={label}
      style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 14px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {shape === "coin" ? (
        <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
      ) : (
        <span style={{ width: '10px', height: '10px', background: color, boxShadow: `0 0 6px ${color}`, transform: 'rotate(45deg)', flexShrink: 0 }} />
      )}
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, color }}>
        {value}
      </span>
    </div>
  );
}
