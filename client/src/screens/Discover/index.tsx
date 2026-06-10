import { Leaderboard } from "../../components/Leaderboard";

export function Discover() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', paddingBottom: '32px' }}>

      {/* Top bar */}
      <div style={{ width: '100%', maxWidth: '384px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px 16px 14px' }}>
        <div
          className="chroma"
          style={{ fontFamily: 'var(--font-display)', fontSize: '26px', letterSpacing: '0.05em', color: 'var(--text)' }}
        >
          DISCOVER
        </div>
      </div>

      {/* Hairline rule */}
      <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', marginBottom: '16px' }}>
        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, var(--dim), transparent)' }} />
      </div>

      <Leaderboard />
    </div>
  );
}
