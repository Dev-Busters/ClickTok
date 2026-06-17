import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { AnimatePresence, motion, useAnimationControls, type PanInfo } from "framer-motion";
import { useGameStore } from "../../store";
import { BALANCE } from "../../features/economy/balance";
import { computeRunParams } from "../../features/livestream/computeRunParams";
import { avatarGradient } from "../../lib/avatar";
import { formatCount } from "../../lib/format";
import { VideoCanvas } from "../../components/VideoCanvas";
import { ElementStage } from "../../components/ElementStage";
import { generateNpcDeck, formatCaption } from "../../features/feed/npcVideos";
import { MOD_CATALOG, isModRelevant, viralMult } from "../../features/feed/mods";
import { TeachCaption } from "../../components/TeachCaption";
import { TapCore } from "./TapCore";
import { FloatingTextLayer, pushFloatText } from "../../components/fx/FloatingTextLayer";
import {
  isFeatureUnlocked,
  getNextMetric,
  metricCurrentValue,
  featureLabel,
  statLabel,
  type UnlockStatCtx,
} from "../../features/metrics/unlocks";
import type { MetricDef } from "../../features/metrics/types";
import type { VideoCard, ReactionKind, FeedModId } from "../../party/types";

// 06 §3 Phase 8: canned comment one-liner pool — cosmetic only, moderation-safe.
const COMMENT_LINES = [
  "this is fire", "POV: quality content", "no thoughts just vibes",
  "underrated‼️", "the algorithm blessed us", "need this on repeat",
  "okay but why is this so good", "not me watching this 3 times",
];

const REACTION_ORDER: ReactionKind[] = ["follow", "like", "comment", "share"];

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
  const wallet        = useGameStore(s => s.wallet);
  const multiplier    = useGameStore(s => s.multiplier);
  const passiveFollowersPerSec = useGameStore(s => s.passiveFollowersPerSec);
  const activeTrend   = useGameStore(s => s.activeTrend);
  const trendsAvailable = useGameStore(s => s.trendsAvailable);
  const combo         = useGameStore(s => s.combo);
  const viralUntil    = useGameStore(s => s.viralUntil);
  const viewBuffUntil = useGameStore(s => s.viewBuffUntil);
  const viewBuffMult  = useGameStore(s => s.viewBuffMult);
  const setSheet      = useGameStore(s => s.setSheet);
  const deck          = useGameStore(s => s.deck);
  const deckIndex     = useGameStore(s => s.deckIndex);
  const setDeck       = useGameStore(s => s.setDeck);
  const advance       = useGameStore(s => s.advance);
  const flushEngage   = useGameStore(s => s.flushEngage);
  const tapPower      = useGameStore(s => s.tapPower);
  const reactedByVideo = useGameStore(s => s.reactedByVideo);
  const reactToCard   = useGameStore(s => s.reactToCard);
  const metricsReached = useGameStore(s => s.metricsReached);
  const viewsTotal    = useGameStore(s => s.viewsTotal);
  const streams       = useGameStore(s => s.streams);
  const coinsEarned   = useGameStore(s => s.coinsEarned);

  // 12.2 (08 §B): granular unlock flags — one feature per metric crossing.
  const fypVideoUnlocked       = isFeatureUnlocked("fyp_video",       metricsReached);
  const engagementRailUnlocked = isFeatureUnlocked("engagement_rail", metricsReached);
  const feedScrollUnlocked     = isFeatureUnlocked("feed_scroll",     metricsReached);
  const elementStageUnlocked   = isFeatureUnlocked("element_stage",   metricsReached);
  const studioUnlocked         = isFeatureUnlocked("studio",          metricsReached);
  const goLiveUnlocked         = isFeatureUnlocked("live",            metricsReached);
  const diamondsUnlocked       = isFeatureUnlocked("diamonds",        metricsReached);
  const affordablePillars = useGameStore(s => s.affordablePillars);
  const hasAffordableBadge = affordablePillars.length > 0;

  // 9.3: next-metric chip (shown from first crossing onward)
  const unlockCtx: UnlockStatCtx = {
    viewsTotal,
    totalFollowers: wallet.totalFollowers,
    streams,
    coinsEarned,
  };
  const nextMetric = metricsReached.length > 0 ? getNextMetric(metricsReached) : null;

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

  // 15.3 (11 §C): tick `nowMs` once per second to drive the buff pill countdown.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (viewBuffUntil <= Date.now()) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [viewBuffUntil]);

  // combo only needed here for canvasIntensity (TapCore reads it from store directly)
  const fillFraction    = Math.min(combo, BALANCE.feed.comboCap) / BALANCE.feed.comboCap;
  // 8.4: VIRAL pins canvas intensity to max.
  const canvasIntensity = viralUntil > Date.now() ? 1 : 0.15 + fillFraction * 0.85;

  // 8.5: engagement rail — SUPERFAN sweep flash trigger + canned comment one-liner.
  const [sweepTrigger, setSweepTrigger] = useState(0);
  const [commentLine, setCommentLine] = useState<{ text: string; id: number } | null>(null);
  useEffect(() => {
    if (!commentLine) return;
    const t = setTimeout(() => setCommentLine(null), 2500);
    return () => clearTimeout(t);
  }, [commentLine]);

  // 04 §13.7: press a rail reaction — computes the float-text gain BEFORE
  // mutating the store (reactedByVideo/reactions only update on success).
  const pressReaction = useCallback((kind: ReactionKind): boolean => {
    if (!activeCard) return false;
    if (reactedByVideo[activeCard.videoId]?.[kind]) return false;

    const cap = BALANCE.feed.comboCap;
    const comboMult = 1 + Math.min(combo, cap) * BALANCE.feed.comboPerTap;
    const vMult = viralMult(viralUntil, Date.now());
    const reactedAfter = { ...reactedByVideo[activeCard.videoId], [kind]: true };
    const isSweep = REACTION_ORDER.every(k => reactedAfter[k]);

    const k = (BALANCE.feed.railReactionMult[kind] + (isSweep ? BALANCE.feed.railSweepBonus : 0)) * comboMult * vMult;
    const gainCoins = tapPower * BALANCE.postCoinConversion * multiplier * k;

    if (!reactToCard(kind)) return false;

    pushFloatText({ text: `+${formatCount(gainCoins)}`, kind: "coin", magnitude: k });
    if (kind === "comment") {
      const text = COMMENT_LINES[Math.floor(Math.random() * COMMENT_LINES.length)];
      setCommentLine({ text, id: Date.now() });
    }
    if (isSweep) {
      pushFloatText({ text: "SUPERFAN!", kind: "callout", magnitude: 0 });
      setSweepTrigger(t => t + 1);
    }
    return true;
  }, [activeCard, reactedByVideo, combo, viralUntil, tapPower, multiplier, reactToCard]);

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

      {/* ── Background layer ─────────────────────────────────────────────── */}
      {/* No FYP: anonymous static canvas                                   */}
      {/* fyp_video: active card canvas + overlay + info (no swipe yet)    */}
      {/* feed_scroll: drag-to-page pager wraps the card                   */}
      {!fypVideoUnlocked ? (
        <div style={{ position: 'absolute', inset: 0 }}>
          <VideoCanvas seed="fyp" topic="trending" intensity={canvasIntensity} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.48)', pointerEvents: 'none' }} />
        </div>
      ) : feedScrollUnlocked ? (
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
              <VideoCanvas
                seed={activeCard?.handle ?? "fyp"}
                topic={activeCard?.topic ?? "trending"}
                intensity={canvasIntensity}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.48)', pointerEvents: 'none' }} />
              {activeCard && <ModBanner mod={activeCard.mod} />}
              <VideoInfoOverlay card={activeCard} />
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        <div style={{ position: 'absolute', inset: 0 }}>
          <VideoCanvas seed={activeCard?.handle ?? "fyp"} topic={activeCard?.topic ?? "trending"} intensity={canvasIntensity} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.48)', pointerEvents: 'none' }} />
          {activeCard && <ModBanner mod={activeCard.mod} />}
          <VideoInfoOverlay card={activeCard} />
        </div>
      )}

      {/* ── Idle swipe-up hint (feed_scroll only) ───────────────────────── */}
      {feedScrollUnlocked && (
        <AnimatePresence>
          {showSwipeHint && <SwipeUpHint />}
        </AnimatePresence>
      )}

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
          {diamondsUnlocked && (
            <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
              <CurrencyPill value={wallet.diamonds} icon="💎" color="var(--cyan)" />
            </motion.div>
          )}
        </div>

        {/* Creator Studio HUD button (studio unlock) */}
        {studioUnlocked && (
          <motion.button
            onPointerDown={e => { e.stopPropagation(); setSheet('creatorStudio'); }}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            whileTap={{ scale: 0.9 }}
            style={{
              position: 'relative',
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 9px',
              borderRadius: 999,
              background: hasAffordableBadge ? 'rgba(37,244,238,0.18)' : 'rgba(37,244,238,0.1)',
              border: `1px solid ${hasAffordableBadge ? 'rgba(37,244,238,0.55)' : 'rgba(37,244,238,0.3)'}`,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '11px' }}>🎬</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', letterSpacing: '0.12em', color: 'var(--cyan)' }}>
              STUDIO
            </span>
            {hasAffordableBadge && (
              <span style={{
                position: 'absolute', top: -3, right: -3,
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--red)',
                boxShadow: '0 0 6px var(--red)',
              }} />
            )}
          </motion.button>
        )}
      </div>

      {/* ── View-buff pill (15.3 — 11 §C) ──────────────────────────────── */}
      <AnimatePresence>
        {viewBuffUntil > nowMs && (
          <motion.div
            key="view-buff-pill"
            initial={{ opacity: 0, y: -8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute', top: 62, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(255,210,0,0.18)',
              border: '1px solid rgba(255,210,0,0.45)',
              zIndex: 3,
              pointerEvents: 'none',
            }}
          >
            <span style={{ fontSize: '11px' }}>⚡</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '0.12em', color: 'var(--gold)' }}>
              +{Math.round((viewBuffMult - 1) * 100)}% COINS {Math.ceil((viewBuffUntil - nowMs) / 1000)}s
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Element stage (element_stage unlock) ────────────────────────── */}
      {elementStageUnlocked && (
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <ElementStage />
        </motion.div>
      )}

      {/* ── TAP CORE v2 — dead center ─────────────────────────────────────── */}
      <TapCore />

      {/* ── Arcade FX layer ───────────────────────────────────────────────── */}
      <FloatingTextLayer />

      {/* ── Engagement rail (engagement_rail unlock) ────────────────────── */}
      {engagementRailUnlocked && (
        <motion.div
          onPointerDown={e => e.stopPropagation()}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            position: 'absolute', right: 10, bottom: 120,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
            zIndex: 2,
          }}
        >
          <FollowBadge
            card={activeCard}
            active={!!(activeCard && reactedByVideo[activeCard.videoId]?.follow)}
            onPress={() => pressReaction("follow")}
            sweepTrigger={sweepTrigger}
            sweepDelay={0}
          />
          <RailButton
            count={activeCard?.reactions.likes ?? 0}
            active={!!(activeCard && reactedByVideo[activeCard.videoId]?.like)}
            activeColor="var(--red)"
            onPress={() => pressReaction("like")}
            sweepTrigger={sweepTrigger}
            sweepDelay={0.08}
            label="LIKE"
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            }
          />
          <RailButton
            count={activeCard?.reactions.comments ?? 0}
            active={!!(activeCard && reactedByVideo[activeCard.videoId]?.comment)}
            activeColor="var(--cyan)"
            onPress={() => pressReaction("comment")}
            sweepTrigger={sweepTrigger}
            sweepDelay={0.16}
            label="COMMENT"
            icon={
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.5 2 2 6 2 11c0 2.6 1.2 4.9 3.2 6.6-.2 1.2-.8 2.6-2 3.6 0 0 2.8.2 5-1.4 1.2.4 2.5.6 3.8.6 5.5 0 10-4 10-9S17.5 2 12 2Z" />
              </svg>
            }
          />
          <RailButton
            count={activeCard?.reactions.shares ?? 0}
            active={!!(activeCard && reactedByVideo[activeCard.videoId]?.share)}
            activeColor="var(--gold)"
            onPress={() => pressReaction("share")}
            sweepTrigger={sweepTrigger}
            sweepDelay={0.24}
            label="SHARE"
            icon={
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            }
          />
        </motion.div>
      )}

      {/* ── Canned comment one-liner (engagement_rail only) ─────────────── */}
      {engagementRailUnlocked && (
        <AnimatePresence>
          {commentLine && (
            <motion.div
              key={commentLine.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              style={{
                position: 'absolute', left: 12, bottom: 145,
                maxWidth: 240,
                padding: '5px 10px',
                borderRadius: 999,
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.12)',
                pointerEvents: 'none', zIndex: 2,
              }}
            >
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: '#fff' }}>
                💬 {commentLine.text}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* ── GO LIVE pill (live unlock) ──────────────────────────────────── */}
      {goLiveUnlocked && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          style={{ position: 'absolute', left: 12, bottom: 14, pointerEvents: 'none', zIndex: 2 }}
        >
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
        </motion.div>
      )}

      {/* ── Next metric tracker chip (from first crossing onward) ────────── */}
      {nextMetric && (
        <NextMetricChip metric={nextMetric} ctx={unlockCtx} />
      )}
    </div>
  );
}

// ── Pager sub-components (06 §3 task 7.5) ───────────────────────────────────

// 12.3 (08 §C1–C3): gate by owned-element relevance; reframe as passive video perk;
// show one-time teach on first relevant show.
function ModBanner({ mod }: { mod: FeedModId }) {
  const ownedElements  = useGameStore(s => s.ownedElements);
  const modTeachSeen   = useGameStore(s => s.modTeachSeen);
  const setModTeachSeen = useGameStore(s => s.setModTeachSeen);

  if (!isModRelevant(mod, ownedElements)) return null;

  const def = MOD_CATALOG[mod];
  return (
    <>
      <div style={{
        position: 'absolute', top: 56, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 2,
          maxWidth: 340,
          padding: '5px 10px',
          borderRadius: 14,
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 7, letterSpacing: '0.13em',
              color: 'rgba(255,255,255,0.38)',
              background: 'rgba(255,255,255,0.07)',
              padding: '1px 5px', borderRadius: 3,
              flexShrink: 0,
            }}>
              VIDEO PERK
            </span>
            <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>{def.icon}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', color: 'var(--cyan)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {def.name}
            </span>
            <span style={{
              fontFamily: 'var(--font-ui)', fontSize: 10, color: 'rgba(255,255,255,0.75)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {def.effectLine}
            </span>
          </div>
          {/* 14.2 (10 §B): one-line playstyle hint, folded into this banner */}
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.02em',
            color: 'var(--dim)', textAlign: 'center',
          }}>
            {def.strategy}
          </span>
        </div>
      </div>
      {/* One-time teach — "what is a video perk?" */}
      <TeachCaption
        text="Each video carries a perk that boosts your taps & mini-games while it's on screen."
        seen={modTeachSeen}
        onDismiss={setModTeachSeen}
      />
    </>
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
        {/* 06 §3 Phase 8: ❤→👆 — the rail heart is the only heart on screen */}
        <span style={{ fontSize: 12, lineHeight: 1 }}>👆</span>
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


// ── Next metric tracker chip (09 §10.3) ─────────────────────────────────────

function NextMetricChip({ metric, ctx }: { metric: MetricDef; ctx: UnlockStatCtx }) {
  const current = Math.min(metricCurrentValue(metric, ctx), metric.threshold);
  const pct = current / metric.threshold;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        position: 'absolute', right: 12, bottom: 14, zIndex: 2,
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: '6px 10px',
        borderRadius: 10,
        background: 'rgba(0,0,0,0.62)',
        border: '1px solid rgba(255,255,255,0.10)',
        pointerEvents: 'none',
        minWidth: 110,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--dim)', letterSpacing: '0.15em' }}>
          NEXT
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text)', letterSpacing: '0.08em' }}>
          {formatCount(metric.threshold)} {statLabel(metric.stat)}
        </span>
      </div>
      {/* Progress bar */}
      <div style={{ height: 2, borderRadius: 999, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.round(pct * 100)}%`, background: 'var(--cyan)', borderRadius: 999, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--dim)' }}>
          {formatCount(current)} / {formatCount(metric.threshold)}
        </span>
        {metric.unlocks && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--cyan)', letterSpacing: '0.08em' }}>
            → {featureLabel(metric.unlocks)}
          </span>
        )}
      </div>
    </motion.div>
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

// 06 §3 Phase 8 (task 8.5): a rail action — icon fills/locks to `activeColor` on
// a successful (once-per-video) reaction; a spent press shakes ~2px and pays
// nothing. SUPERFAN sweep: all 4 rail icons flash gold in sequence, staggered
// by `sweepDelay`.
function RailButton({ icon, count, active, activeColor, onPress, sweepTrigger, sweepDelay, label }: {
  icon: React.ReactNode;
  count: number;
  active: boolean;
  activeColor: string;
  onPress: () => boolean;
  sweepTrigger: number;
  sweepDelay: number;
  label: string;
}) {
  const controls = useAnimationControls();
  const sweepRef = useRef(sweepTrigger);

  useEffect(() => {
    if (sweepTrigger === sweepRef.current) return;
    sweepRef.current = sweepTrigger;
    controls.start({
      color: ['var(--gold)', activeColor],
      scale: [1.3, 1],
      transition: { delay: sweepDelay, duration: 0.4 },
    });
  }, [sweepTrigger, controls, activeColor, sweepDelay]);

  const handlePress = () => {
    if (onPress()) {
      controls.start({ scale: [1, 1.35, 1], color: activeColor, transition: { duration: 0.3 } });
    } else {
      controls.start({ x: [0, -2, 2, -2, 2, 0], transition: { duration: 0.25 } });
    }
  };

  return (
    <motion.button
      onPointerDown={e => { e.stopPropagation(); handlePress(); }}
      whileHover={{ scale: 1.1 }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
      }}
    >
      <motion.div
        animate={controls}
        initial={false}
        style={{ color: active ? activeColor : '#fff', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}
      >
        {icon}
      </motion.div>
      <span style={{
        fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600,
        color: active ? activeColor : '#fff',
        textShadow: '0 1px 3px rgba(0,0,0,0.6)',
      }}>
        {formatCount(count)}
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '7px', letterSpacing: '0.12em',
        color: 'rgba(255,255,255,0.45)',
        textShadow: '0 1px 3px rgba(0,0,0,0.6)',
      }}>
        {label}
      </span>
    </motion.button>
  );
}

// 06 §3 Phase 8 (task 8.5): poster avatar + follow badge ("+" → "✓" once followed).
function FollowBadge({ card, active, onPress, sweepTrigger, sweepDelay }: {
  card: VideoCard | undefined;
  active: boolean;
  onPress: () => boolean;
  sweepTrigger: number;
  sweepDelay: number;
}) {
  const controls = useAnimationControls();
  const sweepRef = useRef(sweepTrigger);
  const restColor = active ? 'var(--cyan)' : 'var(--red)';

  useEffect(() => {
    if (sweepTrigger === sweepRef.current) return;
    sweepRef.current = sweepTrigger;
    controls.start({
      backgroundColor: ['var(--gold)', restColor],
      scale: [1.3, 1],
      transition: { delay: sweepDelay, duration: 0.4 },
    });
  }, [sweepTrigger, controls, restColor, sweepDelay]);

  const handlePress = () => {
    if (onPress()) {
      controls.start({ scale: [1, 1.35, 1], backgroundColor: 'var(--cyan)', transition: { duration: 0.3 } });
    } else {
      controls.start({ x: [0, -2, 2, -2, 2, 0], transition: { duration: 0.25 } });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: 44, height: 44 }}>
        <motion.div
          whileHover={{ scale: 1.1 }}
          style={{
            width: 44, height: 44, borderRadius: '50%',
            background: avatarGradient(card?.handle ?? "fyp"),
            border: '1.5px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '17px', color: '#fff' }}>
            {(card?.handle || "?").slice(0, 2).toUpperCase()}
          </span>
        </motion.div>
        <motion.button
          onPointerDown={e => { e.stopPropagation(); handlePress(); }}
          animate={controls}
          initial={false}
          whileTap={{ scale: 0.85 }}
          style={{
            position: 'absolute', left: '50%', bottom: '-7px', transform: 'translateX(-50%)',
            width: 18, height: 18, borderRadius: '50%',
            background: restColor,
            border: 'none', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1,
            cursor: 'pointer',
          }}
        >
          {active ? '✓' : '+'}
        </motion.button>
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: '7px', letterSpacing: '0.12em',
        color: active ? 'var(--cyan)' : 'rgba(255,255,255,0.45)',
        textShadow: '0 1px 3px rgba(0,0,0,0.6)',
      }}>
        {active ? 'FOLLOWING' : 'FOLLOW'}
      </span>
    </div>
  );
}
