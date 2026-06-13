import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { useGameStore } from "../../store";
import { BALANCE } from "../../features/economy/balance";
import { computeRunParams } from "../../features/livestream/computeRunParams";
import { avatarGradient } from "../../lib/avatar";
import { formatCount } from "../../lib/format";
import { VideoCanvas } from "../../components/VideoCanvas";
import { ElementStage } from "../../components/ElementStage";
import { generateNpcDeck, formatCaption } from "../../features/feed/npcVideos";
import { MOD_CATALOG } from "../../features/feed/mods";
import { TapCore } from "./TapCore";
import { FloatingTextLayer } from "../../components/fx/FloatingTextLayer";
import type { VideoCard } from "../../party/types";

// ── Pager (06 §3 task 7.5 / 8.3 true scroll feel) ────────────────────────────
const SWIPE_THRESHOLD_PX = 80;
const PAGE_SLIDE_PX = 900; // off-screen distance for card slide-in/out
const IDLE_HINT_MS = 10_000;

const cardVariants = {
  initial: (dir: 1 | -1) => ({ y: dir === 1 ? PAGE_SLIDE_PX : -PAGE_SLIDE_PX }),
  animate: { y: 0 },
  exit: (dir: 1 | -1) => ({ y: dir === 1 ? -PAGE_SLIDE_PX : PAGE_SLIDE_PX }),
};

export function HomeFeed() {
  // Store reads
  const handle        = useGameStore(s => s.handle);
  const wallet        = useGameStore(s => s.wallet);
  const comments      = useGameStore(s => s.comments);
  const multiplier    = useGameStore(s => s.multiplier);
  const passiveFollowersPerSec = useGameStore(s => s.passiveFollowersPerSec);
  const activeTrend   = useGameStore(s => s.activeTrend);
  const trendsAvailable = useGameStore(s => s.trendsAvailable);
  const combo         = useGameStore(s => s.combo);
  const viralUntil    = useGameStore(s => s.viralUntil);
  const setSheet      = useGameStore(s => s.setSheet);
  const deck          = useGameStore(s => s.deck);
  const deckIndex     = useGameStore(s => s.deckIndex);
  const setDeck       = useGameStore(s => s.setDeck);
  const advance       = useGameStore(s => s.advance);
  const flushEngage   = useGameStore(s => s.flushEngage);

  // 7.5a: pad with a local NPC deck (offline-playable; server feed arrives in 7.5b)
  useEffect(() => {
    if (deck.length === 0) setDeck(generateNpcDeck(BALANCE.feed.feedMinDeck));
  }, [deck.length, setDeck]);

  const activeCard = deck[deckIndex];

  // 8.3: track swipe direction so the exiting/entering card slides off/in the right way
  const [swipeDir, setSwipeDir] = useState<1 | -1>(1);
  const handlePagerDragEnd = (_e: unknown, info: PanInfo) => {
    if (info.offset.y <= -SWIPE_THRESHOLD_PX) { setSwipeDir(1); advance(1); }
    else if (info.offset.y >= SWIPE_THRESHOLD_PX) { setSwipeDir(-1); advance(-1); }
  };

  // 8.3: idle swipe-up chevron hint — shows once after 10s without a tap/swipe
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const hintShownRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const resetIdleTimer = useCallback(() => {
    setShowSwipeHint(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (hintShownRef.current) return;
    idleTimerRef.current = setTimeout(() => {
      setShowSwipeHint(true);
      hintShownRef.current = true;
    }, IDLE_HINT_MS);
  }, []);
  useEffect(() => {
    resetIdleTimer();
    return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
  }, [resetIdleTimer]);

  // combo only needed here for canvasIntensity (TapCore reads it from store directly)
  const fillFraction    = Math.min(combo, BALANCE.feed.comboCap) / BALANCE.feed.comboCap;
  // 8.4: VIRAL pins canvas intensity to max.
  const canvasIntensity = viralUntil > Date.now() ? 1 : 0.15 + fillFraction * 0.85;

  // Projected viewers for GO LIVE pill
  const projectedViewers = useMemo(() => {
    const heat = trendsAvailable.find(t => t.topic === activeTrend)?.heat ?? 0;
    const s = useGameStore.getState();
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

  // Cleanup on unmount (tab-switch / navigate away): flush engage batch.
  useEffect(() => {
    return () => { flushEngage(); };
  // flushEngage is stable (Zustand action ref), empty dep array is correct.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onPointerDownCapture={resetIdleTimer}
      style={{ position: 'relative', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}
    >

      {/* ── Pager card layer (06 §3 / 8.3): backdrop + mod banner + poster
           block follow the finger during drag and slide off/in with a
           spring on release. The HUD (stat strip, stage, core, GO LIVE)
           lives outside this layer and stays fixed. ─────────────────── */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <AnimatePresence initial={false} custom={swipeDir}>
          <motion.div
            key={activeCard?.videoId ?? "loading"}
            custom={swipeDir}
            variants={cardVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ y: { type: "spring", stiffness: 300, damping: 32 } }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={1}
            dragMomentum={false}
            onDragEnd={handlePagerDragEnd}
            style={{ position: 'absolute', inset: 0 }}
          >
            {/* VideoCanvas ambient backdrop */}
            <VideoCanvas
              seed={activeCard?.handle ?? "fyp"}
              topic={activeCard?.topic ?? "trending"}
              intensity={canvasIntensity}
            />

            {/* Dark scrim */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.48)',
              pointerEvents: 'none',
            }} />

            {/* Mod banner (06 §3 Phase 8: own centered full-width band, y 56-88) */}
            {activeCard && <ModBanner mod={activeCard.mod} />}

            {/* Poster info: @handle, caption, #topic, tap counter, sound marquee */}
            <VideoInfoOverlay card={activeCard} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Idle swipe-up hint (06 §3 Phase 8: first session only) ──────── */}
      <AnimatePresence>
        {showSwipeHint && <SwipeUpHint />}
      </AnimatePresence>

      {/* ── Top stat strip ───────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 56,
        display: 'flex', alignItems: 'center',
        padding: '0 14px',
        gap: 10,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 100%)',
        zIndex: 2,
      }}>
        {/* Followers hero */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flex: 1 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '26px', color: 'var(--text)', lineHeight: 1 }}>
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
        {/* Currency pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          <CurrencyPill value={wallet.coins} icon="🪙" color="var(--gold)" />
          <CurrencyPill value={wallet.diamonds} icon="💎" color="var(--cyan)" />
        </div>
      </div>

      {/* ── Element stage (upper ~35%, waves spawn here) ────────────────── */}
      <ElementStage />

      {/* ── TAP CORE v2 — dead center ─────────────────────────────────────── */}
      <TapCore />

      {/* ── Arcade FX layer (task 8.2) — payout floats route here ─────────── */}
      <FloatingTextLayer />

      {/* ── Right action rail ────────────────────────────────────────────── */}
      <div
        onPointerDown={e => e.stopPropagation()}
        style={{
          position: 'absolute', right: 10, bottom: 120,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
          zIndex: 2,
        }}
      >
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", stiffness: 520, damping: 22 }}
          style={{ position: 'relative', width: 44, height: 44, cursor: 'pointer' }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: avatarGradient(handle),
            border: '1.5px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '17px', color: '#fff' }}>
              {(handle || "?").slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div style={{
            position: 'absolute', left: '50%', bottom: '-7px', transform: 'translateX(-50%)',
            width: 16, height: 16, borderRadius: '50%',
            background: 'var(--red)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1,
          }}>
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

      {/* ── Bottom: GO LIVE pill (persists across swipes) ────────────────── */}
      <div style={{
        position: 'absolute', left: 12, bottom: 14,
        pointerEvents: 'none',
        zIndex: 2,
      }}>
        <motion.button
          onPointerDown={e => { e.stopPropagation(); setSheet('create'); }}
          whileHover={{ scale: 1.05, boxShadow: '0 0 22px rgba(255,31,75,0.5)' }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 520, damping: 24 }}
          style={{
            pointerEvents: 'auto',
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 14px',
            borderRadius: 999,
            background: 'rgba(255,31,75,0.16)',
            border: '1px solid var(--red)',
            cursor: 'pointer',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', boxShadow: '0 0 8px var(--red)', animation: 'dot-pulse 1.6s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.14em', color: 'var(--red)' }}>
            GO LIVE
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text)' }}>
            ~{formatCount(projectedViewers)} viewers
          </span>
        </motion.button>
      </div>
    </div>
  );
}

// ── Pager sub-components (06 §3 task 7.5) ───────────────────────────────────

function ModBanner({ mod }: { mod: VideoCard["mod"] }) {
  const def = MOD_CATALOG[mod];
  return (
    <div style={{
      position: 'absolute', top: 56, left: 0, right: 0, height: 32,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        maxWidth: 320,
        padding: '5px 10px',
        borderRadius: 999,
        background: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.12)',
      }}>
        <span style={{ fontSize: 13, lineHeight: 1 }}>{def.icon}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', color: 'var(--cyan)', whiteSpace: 'nowrap' }}>
          {def.name}
        </span>
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: 10, color: 'rgba(255,255,255,0.75)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {def.effectLine}
        </span>
      </div>
    </div>
  );
}

function SwipeUpHint() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        position: 'absolute', left: 0, right: 0, bottom: 100,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        pointerEvents: 'none', zIndex: 2,
      }}
    >
      <motion.div
        animate={{ y: [0, -6, 0], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 15l6-6 6 6" />
        </svg>
      </motion.div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.6)' }}>
        SWIPE
      </span>
    </motion.div>
  );
}

function VideoInfoOverlay({ card }: { card: VideoCard | undefined }) {
  if (!card) return null;
  return (
    <div style={{
      position: 'absolute', left: 12, right: 76, bottom: 56,
      display: 'flex', flexDirection: 'column', gap: 6,
      pointerEvents: 'none',
    }}>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
        @{card.handle}
      </span>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'rgba(255,255,255,0.92)', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
        {formatCaption(card.captionId, card.topic)} <span style={{ color: 'var(--gold)' }}>#{card.topic}</span>
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
          {formatCount(card.tapCount)}
        </span>
      </div>
      {/* Sound marquee */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff">
          <path d="M9 18.5A3.5 3.5 0 1 1 5.5 15c.54 0 1.05.12 1.5.34V4h11v3h-8.5v11.5h-.03c.02.16.03.33.03.5Z" />
        </svg>
        <div style={{ width: 170, overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'inline-block', animation: 'marquee 7s linear infinite' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: '#fff' }}>
              original sound — {card.handle} &nbsp;·&nbsp; original sound — {card.handle} &nbsp;·&nbsp;
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}


function CurrencyPill({ value, icon, color }: { value: number; icon: string; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '3px 8px',
      borderRadius: 999,
      background: 'rgba(0,0,0,0.45)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color }}>
        {formatCount(value)}
      </span>
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
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
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
