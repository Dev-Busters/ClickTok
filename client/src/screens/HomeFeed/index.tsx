import { useGameStore } from "../../store";
import { StatsBar } from "../../components/StatsBar";
import { TapButton } from "../../components/TapButton";
import { LiveReadinessPanel } from "../../components/LiveReadinessPanel";

export function HomeFeed() {
  const handle = useGameStore(s => s.handle);
  const trendTopic = useGameStore(s => s.trendTopic);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>

      {/* Top bar */}
      <div style={{ width: '100%', maxWidth: '384px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 16px 14px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)' }}>
          @{handle}
        </span>

        <div
          className="chroma"
          style={{ fontFamily: 'var(--font-display)', fontSize: '26px', letterSpacing: '0.05em', color: 'var(--text)' }}
        >
          CLICKTOK
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: 'var(--red)',
              boxShadow: '0 0 8px var(--red)',
              animation: 'dot-pulse 1.6s ease-in-out infinite',
            }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)', letterSpacing: '0.18em' }}>LIVE</span>
          </div>
          {trendTopic && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)' }}>
              #{trendTopic}
            </span>
          )}
        </div>
      </div>

      {/* Hairline rule */}
      <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', marginBottom: '16px' }}>
        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, var(--dim), transparent)' }} />
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', paddingBottom: '32px', width: '100%' }}>
        <StatsBar />
        <TapButton />
        <LiveReadinessPanel />
      </div>
    </div>
  );
}
