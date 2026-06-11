import { motion } from "framer-motion";
import { useGameStore } from "../store";
import { ProgressBar } from "./ProgressBar";

// 04 §6: topicMatch = 1 + heat * 0.5 → projected viewer bonus is heat * 50%.
function viewerBonusPct(heat: number): number {
  return Math.round(heat * 50);
}

function heatColor(heat: number): string {
  if (heat >= 0.66) return 'var(--red)';
  if (heat >= 0.33) return 'var(--gold)';
  return 'var(--cyan)';
}

export function TrendList() {
  const trendsAvailable = useGameStore(s => s.trendsAvailable);
  const activeTrend = useGameStore(s => s.activeTrend);
  const setActiveTrend = useGameStore(s => s.setActiveTrend);

  if (trendsAvailable.length === 0) return null;

  return (
    <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: 'var(--gold)', boxShadow: '0 0 6px var(--gold)',
        }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--gold)', letterSpacing: '0.2em' }}>
          TRENDING NOW
        </span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {trendsAvailable.map(trend => {
          const isActive = trend.topic === activeTrend;
          return (
            <motion.button
              key={trend.topic}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTrend(trend.topic)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '10px 12px',
                background: isActive ? 'rgba(255,31,75,0.07)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isActive ? 'var(--red)' : 'transparent'}`,
                borderLeft: `2px solid ${isActive ? 'var(--red)' : 'transparent'}`,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  color: isActive ? 'var(--red)' : 'var(--text)',
                }}>
                  #{trend.topic}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--cyan)' }}>
                  +{viewerBonusPct(trend.heat)}% viewers
                </span>
              </div>
              <ProgressBar value={trend.heat * 100} color={heatColor(trend.heat)} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
