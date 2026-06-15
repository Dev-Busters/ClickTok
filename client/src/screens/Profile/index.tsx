import { ProfileHeader } from "../../components/ProfileHeader";
import { CloudAccountPanel } from "../../components/CloudAccountPanel";
import { CreatorInsights } from "../CreatorInsights";
import { useGameStore } from "../../store";
import { isFeatureUnlocked } from "../../features/metrics/unlocks";
import { SKILL_CATALOG, SKILL_PILLAR } from "../../features/skills/catalog";
import { ELEMENT_CATALOG } from "../../features/elements/catalog";
import type { UpgradePillar } from "../../features/upgrades/types";
import type { ElementId } from "../../features/elements/types";

const PILLARS: UpgradePillar[] = ["viewer", "posting", "live"];

const PILLAR_ICONS: Record<UpgradePillar, string> = {
  viewer:  "👁",
  posting: "📱",
  live:    "📡",
};

const PILLAR_LABELS: Record<UpgradePillar, string> = {
  viewer:  "VIEWER",
  posting: "POSTING",
  live:    "LIVE",
};

const ELEMENT_ICONS: Record<ElementId, string> = {
  beat_sync:  "🎵",
  duet_loop:  "🔁",
  hold_drop:  "💧",
  swipe_hits: "👆",
};

export function Profile() {
  const metricsReached     = useGameStore(s => s.metricsReached);
  const affordablePillars  = useGameStore(s => s.affordablePillars);
  const hasAffordableBadge = affordablePillars.length > 0;
  const viewerUnlocked     = isFeatureUnlocked("viewer", metricsReached);
  const setSheet           = useGameStore(s => s.setSheet);
  const skillLevels        = useGameStore(s => s.skillLevels);
  const ownedElements      = useGameStore(s => s.ownedElements);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', paddingBottom: '32px' }}>

      <ProfileHeader />

      {/* Creator Studio entry row */}
      {viewerUnlocked && (
        <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px 4px' }}>
          <button
            onClick={() => setSheet('creatorStudio')}
            style={{
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
                  padding: '1px 6px', borderRadius: 999,
                  background: 'var(--red)',
                  fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.1em', color: '#fff',
                }}>NEW</span>
              )}
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--cyan)', letterSpacing: '0.04em' }}>›</span>
          </button>
        </div>
      )}

      <Divider />

      {/* Creator Insights — inlined */}
      <CreatorInsights inline />

      <Divider />

      {/* Creator Breakdown */}
      <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px' }}>
        <SectionLabel icon="🗂️" label="CREATOR BREAKDOWN" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          {PILLARS.map(pillar => {
            const unlocked     = isFeatureUnlocked(pillar, metricsReached);
            const hasAffordable = affordablePillars.includes(pillar);
            const pillarSkills = SKILL_CATALOG.filter(s => SKILL_PILLAR[s.id] === pillar);
            return (
              <div
                key={pillar}
                style={{
                  padding: '10px 12px',
                  background: unlocked ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                  border: `1px solid ${unlocked ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'}`,
                  borderRadius: '8px',
                  opacity: unlocked ? 1 : 0.45,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: unlocked && pillarSkills.length > 0 ? '8px' : '0' }}>
                  <span style={{ fontSize: '14px' }}>{PILLAR_ICONS[pillar]}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: unlocked ? 'var(--cyan)' : 'var(--dim)', letterSpacing: '0.08em', flex: 1 }}>
                    {PILLAR_LABELS[pillar]}
                  </span>
                  {!unlocked && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--dim)', letterSpacing: '0.05em' }}>LOCKED</span>
                  )}
                  {unlocked && hasAffordable && (
                    <span style={{
                      padding: '1px 6px', borderRadius: 999,
                      background: 'var(--red)',
                      fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.1em', color: '#fff',
                    }}>READY</span>
                  )}
                </div>
                {unlocked && pillarSkills.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {pillarSkills.map(s => {
                      const level = (skillLevels as Record<string, number>)[s.id] ?? 0;
                      return (
                        <div key={s.id} style={{
                          fontFamily: 'var(--font-mono)', fontSize: '9px',
                          color: level > 0 ? 'var(--gold)' : 'var(--dim)',
                          background: level > 0 ? 'rgba(245,166,35,0.08)' : 'rgba(255,255,255,0.04)',
                          padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.05em',
                        }}>
                          {s.name} {level > 0 ? `Lv${level}` : '–'}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Divider />

      {/* Element Portfolio */}
      <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px' }}>
        <SectionLabel icon="⚡" label="ELEMENT PORTFOLIO" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
          {ELEMENT_CATALOG.map(def => {
            const owned = ownedElements[def.id];
            return (
              <div
                key={def.id}
                style={{
                  padding: '10px 12px',
                  background: owned ? 'rgba(37,244,238,0.05)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${owned ? 'rgba(37,244,238,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '8px',
                  opacity: owned ? 1 : 0.4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px' }}>{ELEMENT_ICONS[def.id]}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: owned ? 'var(--cyan)' : 'var(--dim)', letterSpacing: '0.06em' }}>
                    {def.name}
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: owned ? 'rgba(37,244,238,0.6)' : 'var(--dim)', letterSpacing: '0.05em' }}>
                  {owned ? 'OWNED' : 'LOCKED'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Divider />

      <CloudAccountPanel />
    </div>
  );
}

function Divider() {
  return (
    <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', margin: '16px 0' }}>
      <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, var(--dim), transparent)' }} />
    </div>
  );
}

function SectionLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--text)', letterSpacing: '0.08em' }}>
        {label}
      </span>
    </div>
  );
}
