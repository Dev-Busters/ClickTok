import { useGameStore } from "../../store";
import { METRIC_CATALOG } from "../../features/metrics/catalog";
import { featureLabel } from "../../features/metrics/unlocks";
import { formatCount } from "../../lib/format";
import type { MetricStatId } from "../../features/metrics/types";

const STAT_ICONS: Record<MetricStatId, string> = {
  views:       "👁",
  followers:   "👤",
  streams:     "📡",
  coinsEarned: "🪙",
  likes:       "❤️",
};

const STAT_LABELS: Record<MetricStatId, string> = {
  views:       "VIEWS",
  followers:   "FOLLOWERS",
  streams:     "STREAMS",
  coinsEarned: "COINS",
  likes:       "LIKES",
};

type StatCtx = {
  viewsTotal: number;
  totalFollowers: number;
  streams: number;
  coinsEarned: number;
  likes: number;
};

function statCurrent(stat: MetricStatId, ctx: StatCtx): number {
  switch (stat) {
    case "views":       return ctx.viewsTotal;
    case "followers":   return ctx.totalFollowers;
    case "streams":     return ctx.streams;
    case "coinsEarned": return ctx.coinsEarned;
    case "likes":       return ctx.likes;
  }
}

export function CreatorInsights({ onBack }: { onBack: () => void }) {
  const metricsReached  = useGameStore(s => s.metricsReached);
  const viewsTotal      = useGameStore(s => s.viewsTotal);
  const totalFollowers  = useGameStore(s => s.wallet.totalFollowers);
  const streams         = useGameStore(s => s.streams);
  const coinsEarned     = useGameStore(s => s.coinsEarned);
  const likes           = useGameStore(s => s.wallet.likes);

  const ctx: StatCtx = { viewsTotal, totalFollowers, streams, coinsEarned, likes };

  // Index of the first unmet metric (the "next target").
  const firstUnmetIdx = METRIC_CATALOG.findIndex(m => !metricsReached.includes(m.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '384px', margin: '0 auto', paddingBottom: '32px' }}>

      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 16px 10px', gap: '12px' }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--dim)', lineHeight: 0 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--text)', letterSpacing: '0.07em' }}>
            CREATOR INSIGHTS
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)', letterSpacing: '0.08em', marginTop: '1px' }}>
            lifetime metrics
          </div>
        </div>
      </div>

      {/* Hairline */}
      <div style={{ padding: '0 16px', marginBottom: '12px' }}>
        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, var(--dim), transparent)' }} />
      </div>

      {/* Metric ladder */}
      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {METRIC_CATALOG.map((m, i) => {
          const reached = metricsReached.includes(m.id);
          // How many steps past the first unmet target is this row?
          // <0 = already reached; 0 = next target; 1,2 = near; >2 = far
          const unmetOffset = firstUnmetIdx === -1 ? -1 : i - firstUnmetIdx;

          let opacity = 1;
          let labelColor: string = 'var(--text)';
          let accentColor: string = 'var(--dim)';
          let rowBg = 'transparent';
          let rowBorder = '1px solid transparent';

          if (reached) {
            labelColor  = 'var(--cyan)';
            accentColor = 'var(--cyan)';
          } else if (unmetOffset === 0) {
            labelColor  = 'var(--gold)';
            accentColor = 'var(--gold)';
            rowBg       = 'rgba(245, 166, 35, 0.06)';
            rowBorder   = '1px solid rgba(245, 166, 35, 0.2)';
          } else if (unmetOffset <= 2) {
            opacity = 0.6;
          } else {
            opacity = 0.28;
          }

          const current = statCurrent(m.stat, ctx);

          return (
            <div
              key={m.id}
              style={{
                opacity,
                padding: '10px 12px',
                background: rowBg,
                borderRadius: '8px',
                border: rowBorder,
              }}
            >
              {/* Icon + name + threshold + progress + reward */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{ fontSize: '15px', minWidth: '20px', textAlign: 'center', color: accentColor }}>
                    {reached ? '✓' : STAT_ICONS[m.stat]}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '15px', color: labelColor, letterSpacing: '0.04em' }}>
                      {formatCount(m.threshold)} {STAT_LABELS[m.stat]}
                    </span>
                    {!reached && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--dim)', marginLeft: '6px' }}>
                        {formatCount(Math.floor(current))}/{formatCount(m.threshold)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Reward badge(s) */}
                <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                  {m.reward.coins != null && (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '11px',
                      color: reached ? 'var(--dim)' : 'var(--gold)',
                      background: 'rgba(245, 166, 35, 0.1)',
                      padding: '2px 6px', borderRadius: '4px',
                    }}>
                      +{formatCount(m.reward.coins)} 🪙
                    </span>
                  )}
                  {m.reward.diamonds != null && (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '11px',
                      color: reached ? 'var(--dim)' : 'var(--cyan)',
                      background: 'rgba(37, 244, 238, 0.08)',
                      padding: '2px 6px', borderRadius: '4px',
                    }}>
                      +{formatCount(m.reward.diamonds)} 💎
                    </span>
                  )}
                </div>
              </div>

              {/* Unlock label */}
              {m.unlocks != null && (
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: '10px',
                  color: reached ? 'var(--cyan)' : 'var(--dim)',
                  marginTop: '4px', marginLeft: '28px',
                  letterSpacing: '0.05em',
                }}>
                  ↳ unlocks {featureLabel(m.unlocks)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
