import { motion } from "framer-motion";
import { useGameStore } from "../../store";
import { formatCount } from "../../lib/format";
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

      {/* Daily reward */}
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
    </div>
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
