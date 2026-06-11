import { useGameStore } from "../store";
import { BALANCE } from "../features/economy/balance";
import type { AlgorithmTier } from "../party/types";

// 06 §4: world-boss-style meter — segmented bar with FED/BLESSED thresholds
// ticked, current tier glowing, and the active buff text.
const { algoFedThreshold, algoBlessedThreshold, algoFedMult, algoBlessedMult } = BALANCE.social;
const METER_SCALE = algoBlessedThreshold * 1.25; // headroom past BLESSED

const TIER_COLOR: Record<AlgorithmTier, string> = {
  STARVED: 'var(--dim)',
  FED: 'var(--cyan)',
  BLESSED: 'var(--gold)',
};

const TIER_BUFF: Record<AlgorithmTier, string | null> = {
  STARVED: null,
  FED: `ALL INCOME ×${algoFedMult.toFixed(2)}`,
  BLESSED: `ALL INCOME ×${algoBlessedMult.toFixed(2)} + BONUS MODIFIER`,
};

function Tick({ pct }: { pct: number }) {
  return (
    <div style={{
      position: 'absolute',
      left: `${pct}%`,
      top: 0,
      bottom: 0,
      width: '1px',
      background: 'rgba(255,255,255,0.25)',
    }} />
  );
}

export function AlgorithmBar() {
  const algorithm = useGameStore(s => s.algorithm);
  const { meter, tier } = algorithm;
  const color = TIER_COLOR[tier];
  const buff = TIER_BUFF[tier];
  const pct = Math.max(0, Math.min(100, (meter / METER_SCALE) * 100));
  const fedPct = (algoFedThreshold / METER_SCALE) * 100;
  const blessedPct = (algoBlessedThreshold / METER_SCALE) * 100;

  return (
    <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '14px',
          letterSpacing: '0.08em',
          color,
          textShadow: tier !== 'STARVED' ? `0 0 8px ${color}` : 'none',
        }}>
          THE ALGORITHM — {tier}
        </span>
        {buff && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color,
            textShadow: `0 0 6px ${color}`,
          }}>
            {buff}
          </span>
        )}
      </div>

      <div style={{
        position: 'relative',
        width: '100%',
        height: '10px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          boxShadow: tier !== 'STARVED' ? `0 0 10px ${color}` : 'none',
          transition: 'width 0.4s ease, background 0.3s ease',
        }} />
        <Tick pct={fedPct} />
        <Tick pct={blessedPct} />
      </div>

      <div style={{ position: 'relative', height: '12px', marginTop: '2px' }}>
        <span style={{
          position: 'absolute', left: `${fedPct}%`, transform: 'translateX(-50%)',
          fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--dim)', letterSpacing: '0.1em',
        }}>
          FED
        </span>
        <span style={{
          position: 'absolute', left: `${blessedPct}%`, transform: 'translateX(-50%)',
          fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--dim)', letterSpacing: '0.1em',
        }}>
          BLESSED
        </span>
      </div>
    </div>
  );
}
