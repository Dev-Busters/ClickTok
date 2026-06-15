import { useState } from "react";
import { UpgradeShop } from "../../components/UpgradeShop";
import { SkillsPanel } from "../../components/SkillsPanel";
import { ProfileHeader } from "../../components/ProfileHeader";
import { CloudAccountPanel } from "../../components/CloudAccountPanel";
import { CreatorInsights } from "../CreatorInsights";
import { useGameStore } from "../../store";
import { isFeatureUnlocked } from "../../features/metrics/unlocks";

export function Profile() {
  const metricsReached    = useGameStore(s => s.metricsReached);
  const upgradesUnlocked  = isFeatureUnlocked("upgrades", metricsReached);
  const viewerUnlocked    = isFeatureUnlocked("viewer",   metricsReached);
  const affordablePillars = useGameStore(s => s.affordablePillars);
  const hasAffordableBadge = affordablePillars.length > 0;
  const setSheet = useGameStore(s => s.setSheet);
  const [showInsights, setShowInsights] = useState(false);

  if (showInsights) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        <CreatorInsights onBack={() => setShowInsights(false)} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', paddingBottom: '32px' }}>

      <ProfileHeader />

      {/* Creator Studio + Creator Insights entry rows */}
      <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px 4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {viewerUnlocked && (
          <button
            onClick={() => setSheet('creatorStudio')}
            style={{
              position: 'relative',
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: hasAffordableBadge ? 'rgba(37,244,238,0.1)' : 'rgba(37,244,238,0.06)',
              border: `1px solid ${hasAffordableBadge ? 'rgba(37,244,238,0.35)' : 'rgba(37,244,238,0.18)'}`,
              borderRadius: '8px', padding: '10px 14px', cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px' }}>🎬</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--cyan)', letterSpacing: '0.06em' }}>
                CREATOR STUDIO
              </span>
              {hasAffordableBadge && (
                <span style={{
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: 'var(--red)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '8px',
                  letterSpacing: '0.1em',
                  color: '#fff',
                }}>NEW</span>
              )}
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--cyan)', letterSpacing: '0.04em' }}>›</span>
          </button>
        )}
        <button
          onClick={() => setShowInsights(true)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '8px', padding: '10px 14px', cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px' }}>📊</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)', letterSpacing: '0.06em' }}>
              CREATOR INSIGHTS
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--cyan)', letterSpacing: '0.04em' }}>›</span>
        </button>
      </div>

      {/* Hairline rule */}
      <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', marginBottom: '16px' }}>
        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, var(--dim), transparent)' }} />
      </div>

      <UpgradeShop />

      {upgradesUnlocked && (
        <>
          <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', margin: '20px 0' }}>
            <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, var(--dim), transparent)' }} />
          </div>
          <SkillsPanel />
        </>
      )}

      <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', margin: '20px 0' }}>
        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, var(--dim), transparent)' }} />
      </div>

      <CloudAccountPanel />
    </div>
  );
}
