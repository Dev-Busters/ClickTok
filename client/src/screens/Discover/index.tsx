import { useGameStore } from "../../store";
import { formatCount } from "../../lib/format";
import { avatarGradient } from "../../lib/avatar";
import { Leaderboard } from "../../components/Leaderboard";
import { TrendList } from "../../components/TrendList";
import { AlgorithmBar } from "../../components/AlgorithmBar";
import type { LiveStreamSummary } from "../../party/types";

function LiveNowCard({ stream }: { stream: LiveStreamSummary }) {
  const joinStream = useGameStore(s => s.joinStream);
  const initials = stream.handle.slice(0, 2).toUpperCase();
  const hypeBarWidth = `${Math.round(stream.hype)}%`;

  return (
    <div
      onClick={() => joinStream(stream)}
      style={{
        flexShrink: 0,
        width: '108px',
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '10px 8px 0',
        gap: '4px',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}>
      {/* Avatar */}
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: avatarGradient(stream.handle),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        border: '2px solid rgba(255,255,255,0.12)',
        position: 'relative',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: '#fff' }}>
          {initials}
        </span>
        {/* LIVE / FEATURED badge */}
        <div style={{
          position: 'absolute',
          bottom: '-6px',
          background: stream.featured ? 'rgba(37,244,238,0.18)' : 'var(--red)',
          border: stream.featured ? '1px solid var(--cyan)' : 'none',
          color: stream.featured ? 'var(--cyan)' : '#fff',
          fontSize: '8px',
          fontWeight: 700,
          fontFamily: 'var(--font-ui)',
          padding: '1px 5px',
          borderRadius: '3px',
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
        }}>
          {stream.featured ? '✨ FEATURED' : 'LIVE'}
        </div>
      </div>

      {/* Handle */}
      <span style={{
        fontFamily: 'var(--font-ui)',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text)',
        marginTop: '8px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '92px',
        textAlign: 'center',
      }}>
        @{stream.handle}
      </span>

      {/* Topic */}
      <span style={{
        fontFamily: 'var(--font-ui)',
        fontSize: '10px',
        color: 'var(--cyan)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '92px',
        textAlign: 'center',
      }}>
        #{stream.topic}
      </span>

      {/* Viewer count */}
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        color: 'var(--dim)',
      }}>
        👁 {formatCount(stream.viewers)}
      </span>

      {/* Hype bar */}
      <div style={{
        width: '100%',
        height: '3px',
        background: 'rgba(255,255,255,0.08)',
        marginTop: '6px',
      }}>
        <div style={{
          height: '100%',
          width: hypeBarWidth,
          background: stream.hype > 60
            ? 'var(--red)'
            : stream.hype > 30
              ? 'var(--gold, #f5a623)'
              : 'var(--dim)',
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}

function LiveNowRail() {
  const liveDirectory = useGameStore(s => s.liveDirectory);
  const setSheet = useGameStore(s => s.setSheet);

  const sorted = [...liveDirectory].sort((a, b) => {
    // Real streams always sort before featured fillers (06 §4).
    if (!!a.featured !== !!b.featured) return a.featured ? 1 : -1;
    if (b.creatorLevel !== a.creatorLevel) return b.creatorLevel - a.creatorLevel;
    return b.viewers - a.viewers;
  });

  if (sorted.length === 0) {
    return (
      <div style={{
        width: '100%',
        maxWidth: '384px',
        padding: '0 16px',
        marginBottom: '20px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--dim)', letterSpacing: '0.06em' }}>
            LIVE NOW
          </span>
        </div>
        <div style={{
          borderRadius: '10px',
          border: '1px dashed rgba(255,255,255,0.1)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--dim)', textAlign: 'center' }}>
            nobody's live — be the first
          </span>
          <button
            onClick={() => setSheet('create')}
            style={{
              background: 'var(--red)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 16px',
              fontFamily: 'var(--font-ui)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            GO LIVE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: '384px',
      padding: '0 16px',
      marginBottom: '20px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--dim)', letterSpacing: '0.06em' }}>
          LIVE NOW
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)' }}>
          {sorted.length} live
        </span>
      </div>
      <div style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '6px',
        // hide scrollbar but keep it scrollable
        scrollbarWidth: 'none',
      }}>
        {sorted.map(stream => (
          <LiveNowCard key={stream.streamId} stream={stream} />
        ))}
      </div>
    </div>
  );
}

export function Discover() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', paddingBottom: '32px' }}>

      {/* Top bar */}
      <div style={{ width: '100%', maxWidth: '384px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px 16px 14px' }}>
        <div
          className="chroma"
          style={{ fontFamily: 'var(--font-display)', fontSize: '26px', letterSpacing: '0.05em', color: 'var(--text)' }}
        >
          DISCOVER
        </div>
      </div>

      {/* Hairline rule */}
      <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', marginBottom: '16px' }}>
        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, var(--dim), transparent)' }} />
      </div>

      <AlgorithmBar />

      <LiveNowRail />

      <TrendList />
      <Leaderboard />
    </div>
  );
}
