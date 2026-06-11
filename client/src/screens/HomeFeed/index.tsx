import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "../../store";
import { BALANCE } from "../../features/economy/balance";
import { computeRunParams } from "../../features/livestream/computeRunParams";
import { avatarGradient } from "../../lib/avatar";
import { formatCount } from "../../lib/format";

type HeartBurst = { id: number; x: number; y: number; value: number; rot: number };

let nextBurstId = 0;

// TikTok "For You" page, reimagined as the clicker: the whole screen is your
// content — tapping it posts (the active clicker action) with a heart burst.
export function HomeFeed() {
  const handle = useGameStore(s => s.handle);
  const wallet = useGameStore(s => s.wallet);
  const comments = useGameStore(s => s.comments);
  const tapPower = useGameStore(s => s.tapPower);
  const multiplier = useGameStore(s => s.multiplier);
  const passiveFollowersPerSec = useGameStore(s => s.passiveFollowersPerSec);
  const activeTrend = useGameStore(s => s.activeTrend);
  const trendsAvailable = useGameStore(s => s.trendsAvailable);
  const tap = useGameStore(s => s.tap);
  const setSheet = useGameStore(s => s.setSheet);

  const [bursts, setBursts] = useState<HeartBurst[]>([]);

  const projectedViewers = useMemo(() => {
    const s = useGameStore.getState();
    const heat = trendsAvailable.find(t => t.topic === activeTrend)?.heat ?? 0;
    return computeRunParams(
      {
        followers: s.wallet.followers,
        followerConversion: s.followerConversion,
        skillLevels: s.skillLevels,
        ownedUpgrades: s.ownedUpgrades,
      },
      activeTrend ?? "fyp",
      heat,
    ).startViewers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTrend, trendsAvailable, wallet.followers]);

  const handleStageTap = (e: React.PointerEvent<HTMLDivElement>) => {
    tap();
    const rect = e.currentTarget.getBoundingClientRect();
    const value = Math.max(1, Math.floor(tapPower * BALANCE.postFollowerConversion * multiplier));
    setBursts(prev => [...prev.slice(-12), {
      id: nextBurstId++,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      value,
      rot: Math.random() * 24 - 12,
    }]);
  };

  return (
    <div
      onPointerDown={handleStageTap}
      style={{ position: 'relative', height: '100%', overflow: 'hidden', cursor: 'pointer', userSelect: 'none' }}
    >
      {/* ── The "video": ambient stage glows ── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse 90% 55% at 22% 78%, rgba(255,31,75,0.16), transparent 60%),
          radial-gradient(ellipse 80% 50% at 82% 20%, rgba(37,244,238,0.10), transparent 65%),
          linear-gradient(180deg, #101014 0%, var(--bg) 55%, #0c0a10 100%)
        `,
      }} />

      {/* ── Top: Following | For You (TikTok header) ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '22px', padding: '16px 0 10px', background: 'linear-gradient(180deg, rgba(0,0,0,0.45), transparent)' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
          Following
        </span>
        <span style={{ position: 'relative', fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: 700, color: '#fff' }}>
          For You
          <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: '-7px', width: '28px', height: '3px', borderRadius: '2px', background: 'var(--text)' }} />
        </span>
      </div>

      {/* ── Followers chip (your headline stat) ── */}
      <div style={{ position: 'absolute', top: '54px', left: '12px', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '999px', background: 'rgba(0,0,0,0.45)' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', lineHeight: 1, color: 'var(--text)' }}>
          {formatCount(wallet.followers)}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.18em', color: 'var(--dim)' }}>
          FOLLOWERS
        </span>
        {passiveFollowersPerSec > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--cyan)' }}>
            +{formatCount(passiveFollowersPerSec * multiplier)}/s
          </span>
        )}
      </div>

      {/* ── Right action rail (TikTok signature) ── */}
      <div
        onPointerDown={e => e.stopPropagation()}
        style={{ position: 'absolute', right: '10px', bottom: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}
      >
        {/* Avatar + follow badge */}
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", stiffness: 520, damping: 22 }}
          style={{ position: 'relative', width: '44px', height: '44px', cursor: 'pointer' }}
        >
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%',
            background: avatarGradient(handle),
            border: '1.5px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '17px', color: '#fff' }}>
              {(handle || "?").slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div style={{ position: 'absolute', left: '50%', bottom: '-7px', transform: 'translateX(-50%)', width: '16px', height: '16px', borderRadius: '50%', background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
            +
          </div>
        </motion.div>

        <RailStat count={wallet.likes} label="likes" icon={
          <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        } />
        <RailStat count={comments} label="comments" icon={
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff">
            <path d="M12 2C6.5 2 2 6 2 11c0 2.6 1.2 4.9 3.2 6.6-.2 1.2-.8 2.6-2 3.6 0 0 2.8.2 5-1.4 1.2.4 2.5.6 3.8.6 5.5 0 10-4 10-9S17.5 2 12 2Z" />
          </svg>
        } />
        <RailStat count={wallet.coins} label="coins" gold icon={
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2">
            <circle cx="12" cy="12" r="9" fill="rgba(245,166,35,0.2)" />
            <path d="M12 7v10M9.5 9.2c.6-.8 1.5-1.2 2.5-1.2 1.7 0 3 .9 3 2s-1.3 2-3 2-3 .9-3 2 1.3 2 3 2c1 0 1.9-.4 2.5-1.2" strokeLinecap="round" />
          </svg>
        } />
        <RailStat count={wallet.diamonds} label="diamonds" cyan icon={
          <svg width="28" height="28" viewBox="0 0 24 24" fill="rgba(37,244,238,0.25)" stroke="var(--cyan)" strokeWidth="1.6" strokeLinejoin="round">
            <path d="M6 4h12l4 5-10 12L2 9l4-5Z" />
            <path d="M2 9h20M9 4l3 5 3-5M7 9l5 11 5-11" fill="none" />
          </svg>
        } />
      </div>

      {/* ── Bottom-left: caption block (TikTok style) ── */}
      <div style={{ position: 'absolute', left: '12px', right: '76px', bottom: '14px', display: 'flex', flexDirection: 'column', gap: '7px', pointerEvents: 'none' }}>
        {/* GO LIVE pill */}
        <motion.button
          onPointerDown={e => { e.stopPropagation(); setSheet('create'); }}
          whileHover={{ scale: 1.05, boxShadow: '0 0 22px rgba(255,31,75,0.5)' }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 520, damping: 24 }}
          style={{
            pointerEvents: 'auto',
            alignSelf: 'flex-start',
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '7px 14px',
            borderRadius: '999px',
            background: 'rgba(255,31,75,0.16)',
            border: '1px solid var(--red)',
            cursor: 'pointer',
            marginBottom: '2px',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--red)', boxShadow: '0 0 8px var(--red)', animation: 'dot-pulse 1.6s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.14em', color: 'var(--red)' }}>
            GO LIVE
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text)' }}>
            ~{formatCount(projectedViewers)} viewers
          </span>
        </motion.button>

        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
          @{handle}
        </span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'rgba(255,255,255,0.92)', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
          grinding <span style={{ color: 'var(--gold)' }}>#{activeTrend ?? 'fyp'}</span> for the algorithm 🔥 tap to post
        </span>

        {/* Sound marquee */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff">
            <path d="M9 18.5A3.5 3.5 0 1 1 5.5 15c.54 0 1.05.12 1.5.34V4h11v3h-8.5v11.5h-.03c.02.16.03.33.03.5Z" />
          </svg>
          <div style={{ width: '170px', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <div style={{ display: 'inline-block', animation: 'marquee 7s linear infinite' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: '#fff' }}>
                original sound — {handle} &nbsp;·&nbsp; original sound — {handle} &nbsp;·&nbsp;
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Heart bursts on tap ── */}
      <AnimatePresence>
        {bursts.map(b => (
          <motion.div
            key={b.id}
            initial={{ opacity: 1, y: 0, scale: 0.6, rotate: b.rot }}
            animate={{ opacity: 0, y: -110, scale: 1.4, rotate: -b.rot }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            onAnimationComplete={() => setBursts(prev => prev.filter(p => p.id !== b.id))}
            style={{ position: 'absolute', left: b.x - 22, top: b.y - 22, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <svg width="44" height="44" viewBox="0 0 24 24" fill="var(--red)" style={{ filter: 'drop-shadow(0 0 10px rgba(255,31,75,0.8))' }}>
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.7)', lineHeight: 1 }}>
              +{formatCount(b.value)}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function RailStat({ count, label, icon, gold, cyan }: {
  count: number; label: string; icon: React.ReactNode; gold?: boolean; cyan?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.18, y: -2 }}
      whileTap={{ scale: 0.8 }}
      transition={{ type: "spring", stiffness: 520, damping: 22 }}
      title={label}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
      }}
    >
      <div style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>{icon}</div>
      <span style={{
        fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600,
        color: gold ? 'var(--gold)' : cyan ? 'var(--cyan)' : '#fff',
        textShadow: '0 1px 3px rgba(0,0,0,0.6)',
      }}>
        {formatCount(count)}
      </span>
    </motion.button>
  );
}
