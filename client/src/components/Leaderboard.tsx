import { useGameStore } from "../store";
import { formatCount } from "../lib/format";
import type { LeaderboardEntry } from "../store/slices/socialSlice";

const RANK_COLORS = ['var(--gold)', 'rgba(232,228,216,0.55)', '#a07040'];

function LeaderboardSection({
  label, sublabel, entries, myHandle,
}: {
  label: string;
  sublabel?: string;
  entries: LeaderboardEntry[];
  myHandle: string | null;
}) {
  if (entries.length === 0) return null;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: 'var(--red)', boxShadow: '0 0 6px var(--red)',
        }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)', letterSpacing: '0.2em' }}>
          {label}
        </span>
        {sublabel && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)' }}>
            {sublabel}
          </span>
        )}
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {entries.slice(0, 5).map((entry, i) => {
          const isMe = entry.handle === myHandle;
          const rankColor = RANK_COLORS[i] ?? 'var(--dim)';
          return (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '9px 12px',
                background: isMe ? 'rgba(255,31,75,0.07)' : 'rgba(255,255,255,0.02)',
                borderLeft: `2px solid ${isMe ? 'var(--red)' : 'transparent'}`,
              }}
            >
              {/* Rank */}
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '20px',
                color: rankColor,
                lineHeight: 1,
                width: '22px',
                flexShrink: 0,
              }}>
                {entry.rank}
              </div>

              {/* Handle */}
              <span style={{
                flex: 1,
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: isMe ? 'var(--red)' : 'var(--text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                @{entry.handle}
              </span>

              {/* Followers */}
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '20px',
                color: isMe ? 'var(--red)' : 'var(--dim)',
                lineHeight: 1,
                flexShrink: 0,
              }}>
                {formatCount(entry.followers)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Leaderboard() {
  const leaderboard = useGameStore(s => s.leaderboard);
  const trendLeaderboard = useGameStore(s => s.trendLeaderboard);
  const myHandle = useGameStore(s => s.handle);
  const activeTrend = useGameStore(s => s.activeTrend);

  if (leaderboard.length === 0 && trendLeaderboard.length === 0) return null;

  return (
    <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <LeaderboardSection label="TOP CREATORS" entries={leaderboard} myHandle={myHandle} />
      {activeTrend && (
        <LeaderboardSection label="TRENDING" sublabel={`#${activeTrend}`} entries={trendLeaderboard} myHandle={myHandle} />
      )}
    </div>
  );
}
