import { ProfileHeader } from "../../components/ProfileHeader";
import { CloudAccountPanel } from "../../components/CloudAccountPanel";
import { CreatorInsights } from "../CreatorInsights";
import { useGameStore } from "../../store";
import { isFeatureUnlocked } from "../../features/metrics/unlocks";
import { SKILL_CATALOG, SKILL_PILLAR } from "../../features/skills/catalog";
import { ELEMENT_CATALOG } from "../../features/elements/catalog";
import { formatCount } from "../../lib/format";
import { formatCaption } from "../../features/feed/npcVideos";
import type { VideoPost } from "../../features/channel/types";
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
  const opening            = useGameStore(s => s.onboardingTeachesSeen.legacy_preserved !== true);
  const metricsReached     = useGameStore(s => s.metricsReached);
  const affordablePillars  = useGameStore(s => s.affordablePillars);
  const hasAffordableBadge = affordablePillars.length > 0;
  const viewerUnlocked     = isFeatureUnlocked("viewer", metricsReached);
  const setSheet           = useGameStore(s => s.setSheet);
  const skillLevels        = useGameStore(s => s.skillLevels);
  const ownedElements      = useGameStore(s => s.ownedElements);
  const rhythmMuted        = useGameStore(s => s.rhythmMuted);
  const reducedFeedback    = useGameStore(s => s.reducedFeedback);
  const setRhythmMuted     = useGameStore(s => s.setRhythmMuted);
  const setReducedFeedback = useGameStore(s => s.setReducedFeedback);
  const setTab             = useGameStore(s => s.setTab);

  if (opening) {
    return (
      <div data-onboarding="opening-profile" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', minHeight: '100%', paddingBottom: '24px' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 2, width: '100%', padding: '12px 16px', background: 'rgba(7,8,12,.96)', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <button onClick={() => setTab('home')} style={{ padding: '9px 12px', borderRadius: 999, border: '1px solid rgba(37,244,238,.35)', background: 'rgba(37,244,238,.08)', color: 'var(--cyan)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800, letterSpacing: '.1em' }}>← BACK TO ENGAGEMENT</button>
        </div>
        <ProfileHeader />
        <div style={{ width: '100%', maxWidth: 384, padding: '0 16px 4px' }}>
          <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(37,244,238,.2)', background: 'rgba(37,244,238,.06)', color: 'rgba(255,255,255,.76)', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.5 }}>
            YOUR CHANNEL IS JUST GETTING STARTED. NEW PROFILE SECTIONS WILL APPEAR AS THEY BECOME USEFUL.
          </div>
        </div>
        <Divider />
        <CloudAccountPanel />
      </div>
    );
  }

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

      <MyVideosSection />

      <Divider />

      <CloudAccountPanel />

      <Divider />
      <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px' }}>
        <SectionLabel icon="♪" label="RHYTHM FEEDBACK" />
        <label style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text)' }}>
          MUTE HIT CUES <input type="checkbox" checked={rhythmMuted} onChange={e => setRhythmMuted(e.target.checked)} />
        </label>
        <label style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text)' }}>
          REDUCED FEEDBACK <input type="checkbox" checked={reducedFeedback} onChange={e => setReducedFeedback(e.target.checked)} />
        </label>
      </div>
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

// ── 15.2 (11 §B) — My Videos section ─────────────────────────────────────────

function formatAge(createdAt: number): string {
  const sec = (Date.now() - createdAt) / 1000;
  if (sec < 60) return `${Math.floor(sec)}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

// Analytical integral of the yield curve from 0 to `age` (04 §3 ramp-then-decay).
function estimateLifetimeEarned(v: VideoPost, nowMs: number): number {
  const age = (nowMs - v.createdAt) / 1000;
  if (age <= 0) return 0;
  const peak = v.peakAtSec;
  const base = v.coinsPerSec;
  const peak6 = peak * 6;

  // Ramp phase: ∫₀^min(age,peak) (a/peak × base) da = base/peak × rampEnd²/2
  const rampEnd = Math.min(age, peak);
  const rampEarned = (base / peak) * (rampEnd * rampEnd / 2);
  if (age <= peak) return rampEarned;

  // Decay phase: factor hits 0.1 at age = peak + 0.9×peak×6 = 6.4×peak
  const crossover = peak + peak6 * 0.9;
  const decayEnd = Math.min(age, crossover);
  const D = decayEnd - peak;
  // ∫₀^D (1 - t/peak6) × base dt = base × (D - D²/(2×peak6))
  const decayEarned = base * (D - (D * D) / (2 * peak6));
  if (age <= crossover) return rampEarned + decayEarned;

  // Floor phase: ∫_{crossover}^{age} 0.1×base dt
  const fullDecayD = crossover - peak;
  const fullDecayEarned = base * (fullDecayD - (fullDecayD * fullDecayD) / (2 * peak6));
  const floorEarned = base * 0.1 * (age - crossover);
  return rampEarned + fullDecayEarned + floorEarned;
}

// Current effective yield for a single video at the given nowMs.
function videoYieldNow(v: VideoPost, nowMs: number): number {
  const age = (nowMs - v.createdAt) / 1000;
  if (age <= 0) return 0;
  const peak = v.peakAtSec;
  const factor = age <= peak
    ? age / peak
    : Math.max(0.1, 1 - (age - peak) / (peak * 6));
  return v.coinsPerSec * factor;
}

function MyVideosSection() {
  const videos = useGameStore(s => s.videos);
  const catalogYieldPerSec = useGameStore(s => s.catalogYieldPerSec);
  const nowMs = Date.now();
  const totalPassive = catalogYieldPerSec(nowMs).coins;

  return (
    <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <SectionLabel icon="📹" label="MY VIDEOS" />
        {totalPassive > 0 && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--gold)',
            letterSpacing: '0.06em',
          }}>
            +{formatCount(totalPassive)}/s 🪙
          </span>
        )}
      </div>

      {videos.length === 0 ? (
        <div style={{
          padding: '18px 14px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '10px',
          textAlign: 'center',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)', letterSpacing: '0.08em' }}>
            NO VIDEOS YET
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--dim)', marginTop: '4px' }}>
            Post a video to start earning passive coins
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[...videos].reverse().map(v => {
            const yield_ = videoYieldNow(v, nowMs);
            const age = (nowMs - v.createdAt) / 1000;
            const isTrending = age < v.peakAtSec;
            const lifeEarned = estimateLifetimeEarned(v, nowMs);
            const caption = v.captionId ? formatCaption(v.captionId, v.topic) : `#${v.topic}`;
            return (
              <div key={v.id} style={{
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {caption}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--dim)', marginTop: '3px', letterSpacing: '0.05em' }}>
                      #{v.topic} · {formatAge(v.createdAt)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em',
                      color: isTrending ? 'var(--cyan)' : 'var(--dim)',
                    }}>
                      {yield_ > 0 ? `+${formatCount(yield_)}/s` : '–'}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.05em',
                      color: isTrending ? 'var(--cyan)' : 'var(--dim)',
                      marginTop: '2px',
                    }}>
                      {isTrending ? 'TRENDING ↑' : 'FADING ↓'}
                    </div>
                  </div>
                </div>
                <div style={{
                  marginTop: '6px',
                  fontFamily: 'var(--font-mono)', fontSize: '9px',
                  color: 'rgba(245,166,35,0.6)', letterSpacing: '0.04em',
                }}>
                  ~{formatCount(lifeEarned)} 🪙 earned lifetime
                  {v.buff && (
                    <span style={{ marginLeft: '8px', color: 'rgba(37,244,238,0.5)' }}>
                      · {Math.round((v.buff.mult - 1) * 100)}% tap buff
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
