import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useGameStore } from "../../store";
import { formatCount } from "../../lib/format";
import { BALANCE } from "../../features/economy/balance";
import { computeDailyReward, isNewCalendarDay } from "../../features/inbox/daily";
import type { InboxNotification, NotificationType } from "../../features/inbox/types";

const TYPE_ICON: Record<NotificationType, string> = {
  run_result: "🎬",
  milestone: "🎉",
  daily_reward: "🎁",
};

const TYPE_COLOR: Record<NotificationType, string> = {
  run_result: "var(--cyan)",
  milestone: "var(--gold)",
  daily_reward: "var(--red)",
};

function timeAgo(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function Inbox() {
  const opening = useGameStore(s => s.onboardingTeachesSeen.legacy_preserved !== true);
  const followers = useGameStore(s => s.wallet.totalFollowers);
  const notifications = useGameStore(s => s.notifications);
  const lastDailyClaimAt = useGameStore(s => s.lastDailyClaimAt);
  const passiveCoinsPerSec = useGameStore(s => s.passiveCoinsPerSec);
  const claimDailyReward = useGameStore(s => s.claimDailyReward);

  const canClaim = isNewCalendarDay(lastDailyClaimAt, Date.now());
  const previewCoins = computeDailyReward(passiveCoinsPerSec);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', paddingBottom: '32px' }}>

      {/* Top bar */}
      <div style={{ width: '100%', maxWidth: '384px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px 16px 14px' }}>
        <div
          className="chroma"
          style={{ fontFamily: 'var(--font-display)', fontSize: '26px', letterSpacing: '0.05em', color: 'var(--text)' }}
        >
          INBOX
        </div>
      </div>

      {/* Hairline rule */}
      <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', marginBottom: '16px' }}>
        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, var(--dim), transparent)' }} />
      </div>

      {!opening || followers >= BALANCE.onboarding.analyticsFollowers
        ? <AnalyticsSection />
        : <AnalyticsLocked followers={followers} />}

      {!opening && <>
      <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', marginBottom: '20px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '14px 16px',
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${canClaim ? 'var(--gold)' : 'var(--dim)'}`,
          borderRadius: '4px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--gold)', letterSpacing: '0.18em' }}>
              DAILY REWARD
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: 'var(--text)' }}>
              🪙 +{formatCount(previewCoins)}
            </span>
          </div>
          <motion.button
            whileTap={canClaim ? { scale: 0.95 } : undefined}
            onClick={() => claimDailyReward()}
            disabled={!canClaim}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.16em',
              padding: '10px 18px',
              color: canClaim ? '#000' : 'var(--dim)',
              background: canClaim ? 'var(--gold)' : 'rgba(255,255,255,0.04)',
              border: canClaim ? 'none' : '1px solid var(--dim)',
              cursor: canClaim ? 'pointer' : 'default',
            }}
          >
            {canClaim ? 'CLAIM' : 'CLAIMED'}
          </motion.button>
        </div>
      </div>

      {/* Notifications */}
      <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {notifications.length === 0 ? (
          <div style={{
            padding: '32px 0',
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--dim)',
            letterSpacing: '0.1em',
          }}>
            NO ACTIVITY YET — GO LIVE TO GET STARTED
          </div>
        ) : (
          notifications.map(n => <NotificationRow key={n.id} notification={n} />)
        )}
      </div>
      </>}
    </div>
  );
}

function AnalyticsLocked({ followers }: { followers: number }) {
  const target = BALANCE.onboarding.analyticsFollowers;
  return (
    <section data-analytics-locked aria-label="Analytics locked" style={{ width: "100%", maxWidth: 384, padding: "0 16px", marginBottom: 22 }}>
      <div style={{ padding: 16, borderRadius: 14, border: "1px solid rgba(255,255,255,.12)", background: "linear-gradient(145deg,rgba(18,20,27,.92),rgba(9,10,14,.98))" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div><strong style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: ".08em", color: "rgba(255,255,255,.68)" }}>ANALYTICS</strong><span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--dim)", letterSpacing: ".1em" }}>UNLOCKS AT {target} FOLLOWERS</span></div>
          <span style={{ fontSize: 22, opacity: .46 }}>◈</span>
        </div>
        <div style={{ height: 5, marginTop: 13, overflow: "hidden", borderRadius: 999, background: "rgba(255,255,255,.08)" }}><motion.div animate={{ width: `${Math.min(100, followers / target * 100)}%` }} style={{ height: "100%", borderRadius: 999, background: "var(--cyan)" }} /></div>
        <div style={{ marginTop: 6, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 8, color: "rgba(255,255,255,.5)" }}>{Math.min(followers, target)} / {target}</div>
      </div>
    </section>
  );
}

type AnalyticsEntryType = "feature" | "resource" | "achievement";

const ANALYTICS_TYPE_STYLE: Record<AnalyticsEntryType, { label: string; obtainedLabel: string; icon: string; color: string; celebration: string; textShadow: string }> = {
  feature: { label: "FEATURE UNLOCK", obtainedLabel: "FEATURE UNLOCKED", icon: "✦", color: "var(--cyan)", celebration: "radial-gradient(circle,rgba(37,244,238,.3),rgba(7,8,12,.92) 70%)", textShadow: "-2px 0 var(--red),2px 0 var(--cyan),0 0 24px var(--cyan)" },
  resource: { label: "RESOURCE UNLOCK", obtainedLabel: "RESOURCE DISCOVERED", icon: "◆", color: "var(--gold)", celebration: "radial-gradient(circle,rgba(255,210,0,.38),rgba(18,13,2,.94) 70%)", textShadow: "0 0 28px var(--gold)" },
  achievement: { label: "ACHIEVEMENT", obtainedLabel: "ACHIEVEMENT EARNED", icon: "★", color: "var(--red)", celebration: "conic-gradient(from 45deg,rgba(255,31,75,.34),rgba(7,8,12,.94),rgba(255,31,75,.34))", textShadow: "0 0 28px var(--red)" },
};

function AnalyticsSection() {
  const followers = useGameStore(s => s.wallet.totalFollowers);
  const claimed = useGameStore(s => s.completedOnboardingGoals.includes("unlock_studio"));
  const claimStudio = useGameStore(s => s.claimCreatorStudioAnalytics);
  const setSheet = useGameStore(s => s.setSheet);
  const reduced = useReducedMotion();
  const [celebrating, setCelebrating] = useState(false);
  const target = BALANCE.onboarding.studioFollowers;
  const ready = followers >= target;
  const type = ANALYTICS_TYPE_STYLE.feature;

  useEffect(() => {
    if (!celebrating) return;
    const timer = window.setTimeout(() => setCelebrating(false), reduced ? 500 : 1500);
    return () => window.clearTimeout(timer);
  }, [celebrating, reduced]);

  const act = () => {
    if (claimed) {
      setSheet("creatorStudio");
      return;
    }
    if (claimStudio()) setCelebrating(true);
  };

  return (
    <section aria-labelledby="analytics-heading" style={{ width: '100%', maxWidth: 384, padding: '0 16px', marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <h2 id="analytics-heading" style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text)', letterSpacing: '.08em' }}>ANALYTICS</h2>
          <div style={{ marginTop: 2, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,.58)', letterSpacing: '.08em' }}>ACHIEVEMENTS · UNLOCKS</div>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: claimed ? 'var(--gold)' : 'var(--dim)' }}>{claimed ? '1 / 1' : '0 / 1'}</span>
      </div>

      <motion.article
        data-analytics-entry="creator_studio"
        data-unlock-type="feature"
        animate={celebrating && !reduced ? { scale: [1, 1.035, 1], boxShadow: ["0 0 0 rgba(37,244,238,0)", "0 0 42px rgba(37,244,238,.58)", "0 0 18px rgba(37,244,238,.2)"] } : { scale: 1 }}
        transition={{ duration: reduced ? .2 : 1.1, ease: 'easeOut' }}
        style={{ position: 'relative', overflow: 'hidden', padding: 16, borderRadius: 14, border: `1px solid ${claimed || ready ? 'rgba(37,244,238,.62)' : 'rgba(255,255,255,.13)'}`, background: 'linear-gradient(145deg,rgba(15,31,36,.98),rgba(10,12,18,.98))' }}
      >
        <AnimatePresence>
          {celebrating && <motion.div key="feature-unlocked" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} exit={{ opacity: 0 }} transition={{ duration: reduced ? .45 : 1.4, times: [0, .18, .72, 1] }} style={{ position: 'absolute', inset: 0, zIndex: 4, display: 'grid', placeItems: 'center', pointerEvents: 'none', background: type.celebration }}>
            <motion.div initial={{ scale: .5, letterSpacing: '.02em' }} animate={{ scale: reduced ? 1 : [0.5, 1.24, 1], letterSpacing: '.16em' }} transition={{ duration: .65, ease: 'easeOut' }} style={{ color: 'white', fontFamily: 'var(--font-display)', fontSize: 28, textShadow: type.textShadow }}>{type.obtainedLabel}</motion.div>
          </motion.div>}
        </AnimatePresence>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 8px', borderRadius: 999, border: `1px solid ${type.color}`, color: type.color, fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 900, letterSpacing: '.1em' }}>{type.icon} {type.label}</span>
          <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 900 }}>+5 GOLD</span>
        </div>
        <h3 style={{ margin: '14px 0 4px', fontFamily: 'var(--font-display)', fontSize: 28, color: 'white', letterSpacing: '.04em' }}>CREATOR STUDIO</h3>
        <p style={{ margin: '0 0 14px', color: 'rgba(255,255,255,.72)', fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.5 }}>Turn Gold into permanent improvements for the Engagement Button.</p>
        <div style={{ height: 6, overflow: 'hidden', borderRadius: 999, background: 'rgba(255,255,255,.08)' }}>
          <motion.div animate={{ width: `${Math.min(100, followers / target * 100)}%` }} style={{ height: '100%', borderRadius: 999, background: ready ? 'var(--gold)' : 'var(--cyan)', boxShadow: '0 0 10px currentColor' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 9, color: ready ? 'var(--gold)' : 'rgba(255,255,255,.56)' }}><span>{Math.min(followers, target)} / {target} FOLLOWERS</span><span>{claimed ? 'OBTAINED' : ready ? 'READY' : 'LOCKED'}</span></div>
        <motion.button whileTap={ready || claimed ? { scale: .97 } : {}} onClick={act} disabled={!ready && !claimed} style={{ width: '100%', marginTop: 14, padding: 12, border: 0, borderRadius: 999, background: claimed ? 'var(--cyan)' : ready ? 'var(--gold)' : 'rgba(255,255,255,.08)', color: ready || claimed ? '#050608' : 'rgba(255,255,255,.34)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 900, letterSpacing: '.12em', cursor: ready || claimed ? 'pointer' : 'default' }}>{claimed ? 'OPEN CREATOR STUDIO →' : ready ? 'OBTAIN UNLOCK · +5 GOLD' : `${target} FOLLOWERS REQUIRED`}</motion.button>
      </motion.article>
    </section>
  );
}

function NotificationRow({ notification }: { notification: InboxNotification }) {
  return (
    <div style={{
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start',
      padding: '10px 12px',
      background: 'rgba(255,255,255,0.02)',
      borderLeft: `2px solid ${TYPE_COLOR[notification.type]}`,
    }}>
      <div style={{ fontSize: '18px', lineHeight: 1, flexShrink: 0 }}>{TYPE_ICON[notification.type]}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)' }}>
          {notification.title}
        </span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--dim)' }}>
          {notification.body}
        </span>
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--dim)', flexShrink: 0, whiteSpace: 'nowrap' }}>
        {timeAgo(notification.createdAt)}
      </span>
    </div>
  );
}
