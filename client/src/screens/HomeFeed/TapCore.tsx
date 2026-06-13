import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "../../store";
import { BALANCE } from "../../features/economy/balance";
import { formatCount } from "../../lib/format";
import { coreCoinMult, viralMult } from "../../features/feed/mods";
import { pushFloatText } from "../../components/fx/FloatingTextLayer";

// ── Constants ──────────────────────────────────────────────────────────────────
const RING_R = 80;
const RING_SVG = 170;
const RING_CIRC = 2 * Math.PI * RING_R;
const IDLE_SEC = 6;
const TIER_COLORS = ["var(--dim)", "var(--cyan)", "var(--red)", "var(--gold)"] as const;
const TIER_CALLOUTS = ["", "NICE!", "ON FIRE!", "UNSTOPPABLE!"] as const;

function getTier(combo: number): number {
  return Math.min(BALANCE.feed.comboMilestones.filter(m => combo >= m).length, 3);
}

// ── Particle data generated at tap time ────────────────────────────────────────
type Particle = { angle: number; dist: number; size: number; isGlyph: boolean };
type TapFx = {
  id: number;
  ringColor: string;
  comboMult: number;
  particles: Particle[];
};
let _nextId = 0;

function mkParticles(tier: number, count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    angle: Math.random() * 2 * Math.PI,
    dist: 55 + Math.random() * 40,
    size: 3 + Math.random() * 4,
    isGlyph: tier >= 2 && Math.random() < 0.28,
  }));
}

// ── Tier skin layers (transforms + opacity only per 06 §3 perf rules) ─────────

function GlassSkin({ op }: { op: number }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, borderRadius: '50%',
      opacity: op, transition: 'opacity 0.4s',
      background: 'radial-gradient(circle at 38% 38%, rgba(255,255,255,0.11), rgba(0,0,0,0.45))',
      boxShadow: 'inset 0 0 18px rgba(0,0,0,0.5)',
    }}>
      {/* Faint inner rings */}
      <div style={{ position: 'absolute', inset: '12%', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.07)' }} />
      <div style={{ position: 'absolute', inset: '28%', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)' }} />
    </div>
  );
}

function NeonSkin({ op }: { op: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', opacity: op, transition: 'opacity 0.4s', overflow: 'hidden' }}>
      {/* Base disc */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(37,244,238,0.06)' }} />
      {/* Rotating sweep arc */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'conic-gradient(transparent 0deg, rgba(37,244,238,0.35) 60deg, transparent 120deg)',
        }}
      />
      {/* Edge glow */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: 'inset 0 0 22px rgba(37,244,238,0.22)' }} />
    </div>
  );
}

function PlasmaSkin({ op }: { op: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', opacity: op, transition: 'opacity 0.4s', overflow: 'hidden' }}>
      {/* Base */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(255,31,75,0.08)' }} />
      {/* Layer A: clockwise red blob */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(ellipse 70% 40% at 30% 30%, rgba(255,31,75,0.45), transparent 70%)',
        }}
      />
      {/* Layer B: counter-clockwise */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(ellipse 60% 35% at 70% 65%, rgba(255,31,75,0.32), transparent 70%)',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: 'inset 0 0 24px rgba(255,31,75,0.28)' }} />
    </div>
  );
}

function GoldSkin({ op }: { op: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', opacity: op, transition: 'opacity 0.4s', overflow: 'hidden' }}>
      {/* Sunburst rays (static, rotate via animation) */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', inset: '-20%', borderRadius: '50%',
          background: 'repeating-conic-gradient(rgba(245,166,35,0.22) 0deg, transparent 12deg, transparent 18deg)',
        }}
      />
      {/* Gold disc base */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, rgba(245,166,35,0.28), rgba(180,110,0,0.18) 70%)' }} />
      {/* Shimmer pulse */}
      <motion.div
        animate={{ opacity: [0.15, 0.45, 0.15] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, rgba(255,220,80,0.5), transparent 55%)',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: 'inset 0 0 24px rgba(245,166,35,0.3)' }} />
    </div>
  );
}

// ── VIRAL skin: white-hot overlay, painted on top of the tier skin ─────────────
function ViralSkin({ op }: { op: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', opacity: op, transition: 'opacity 0.25s', pointerEvents: 'none' }}>
      <motion.div
        animate={{ opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 50%, #fff 0%, var(--gold) 55%, var(--red) 100%)',
          mixBlendMode: 'screen',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: 'inset 0 0 30px rgba(255,255,255,0.85)' }} />
    </div>
  );
}

// ── Shockwave: two staggered rings + flash disc ────────────────────────────────
function ShockwaveFx({ ringColor, comboMult }: { ringColor: string; comboMult: number }) {
  const flashOpacity = Math.min(0.55, 0.15 + (comboMult - 1) * 0.12);
  return (
    <>
      {/* Ring 1 */}
      <motion.div
        initial={{ scale: 0.75, opacity: 0.9 }}
        animate={{ scale: 2.2, opacity: 0 }}
        exit={{}}
        transition={{ duration: 0.44, ease: 'easeOut' }}
        style={{
          position: 'absolute', top: '50%', left: '50%',
          width: RING_SVG, height: RING_SVG,
          marginTop: -(RING_SVG / 2), marginLeft: -(RING_SVG / 2),
          borderRadius: '50%', border: `2px solid ${ringColor}`,
          boxShadow: `0 0 12px ${ringColor}55`,
          pointerEvents: 'none',
        }}
      />
      {/* Ring 2 (staggered) */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0.6 }}
        animate={{ scale: 2.55, opacity: 0 }}
        exit={{}}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.09 }}
        style={{
          position: 'absolute', top: '50%', left: '50%',
          width: RING_SVG, height: RING_SVG,
          marginTop: -(RING_SVG / 2), marginLeft: -(RING_SVG / 2),
          borderRadius: '50%', border: `1.5px solid ${ringColor}99`,
          pointerEvents: 'none',
        }}
      />
      {/* Flash disc scaled by comboMult */}
      <motion.div
        initial={{ scale: 1, opacity: flashOpacity }}
        animate={{ scale: 1.28, opacity: 0 }}
        exit={{}}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 140, height: 140,
          marginTop: -70, marginLeft: -70,
          borderRadius: '50%', background: ringColor,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}

// ── Gravity-arc particle ───────────────────────────────────────────────────────
function GravParticle({ p, ringColor }: { p: Particle; ringColor: string }) {
  const dx = Math.cos(p.angle) * p.dist;
  const dy = Math.sin(p.angle) * p.dist;
  // Arc: go up-and-out, then curve down (gravity)
  const midY = dy < 0 ? dy * 1.4 : -Math.abs(dy) * 0.5 - 30;
  const endY = dy + 35; // falls past endpoint

  if (p.isGlyph) {
    const glyph = Math.random() < 0.5 ? "♪" : "✦";
    return (
      <motion.span
        initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
        animate={{ x: [0, dx * 0.6, dx], y: [0, midY, endY], opacity: [1, 0.7, 0], scale: [1, 0.8, 0.4] }}
        exit={{}}
        transition={{ duration: 0.72, ease: 'easeOut', times: [0, 0.4, 1] }}
        style={{
          position: 'absolute', top: '50%', left: '50%',
          marginTop: -8, marginLeft: -6,
          fontFamily: 'var(--font-display)', fontSize: `${Math.round(p.size + 4)}px`,
          color: ringColor, pointerEvents: 'none', userSelect: 'none',
        }}
      >
        {glyph}
      </motion.span>
    );
  }

  return (
    <motion.div
      initial={{ x: 0, y: 0, opacity: 1 }}
      animate={{ x: [0, dx * 0.6, dx], y: [0, midY, endY], opacity: [1, 0.8, 0] }}
      exit={{}}
      transition={{ duration: 0.68, ease: 'easeOut', times: [0, 0.4, 1] }}
      style={{
        position: 'absolute', top: '50%', left: '50%',
        width: p.size, height: p.size,
        marginTop: -(p.size / 2), marginLeft: -(p.size / 2),
        borderRadius: '50%', background: ringColor,
        pointerEvents: 'none',
      }}
    />
  );
}

// ── Main component (self-contained — reads store directly) ────────────────────
export function TapCore() {
  const combo = useGameStore(s => s.combo);
  const lastTapAt = useGameStore(s => s.lastTapAt);
  const viralUntil = useGameStore(s => s.viralUntil);
  const engageTap = useGameStore(s => s.engageTap);
  const tapPower = useGameStore(s => s.tapPower);
  const multiplier = useGameStore(s => s.multiplier);
  const activeMod = useGameStore(s => s.deck[s.deckIndex]?.mod ?? null);

  const [tapFxs, setTapFxs] = useState<TapFx[]>([]);
  const [tierFlash, setTierFlash] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const [eruption, setEruption] = useState(false);
  const [ringDrain, setRingDrain] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const fxTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const eruptionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ringDrainTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prevTier = useRef(0);
  const prevViralUntil = useRef(0);

  const clampedCombo = Math.min(combo, BALANCE.feed.comboCap);
  const fillFraction = clampedCombo / BALANCE.feed.comboCap;
  const tier = getTier(combo);
  const comboMult = 1 + clampedCombo * BALANCE.feed.comboPerTap;
  const isViral = viralUntil > nowTick;
  const ringColor = isViral ? "var(--gold)" : TIER_COLORS[tier];
  const ringOffset = RING_CIRC * (1 - fillFraction);

  // 8.4: tick every 100ms while VIRAL is active — drives the blazing ring/core/banner.
  useEffect(() => {
    if (viralUntil <= Date.now()) return;
    const iv = setInterval(() => {
      const now = Date.now();
      setNowTick(now);
      if (now >= viralUntil) clearInterval(iv);
    }, 100);
    return () => clearInterval(iv);
  }, [viralUntil]);

  // 8.4: VIRAL just ended — give the ring a slow drain transition to viralExitCombo,
  // then revert to the snappy per-tap transition.
  useEffect(() => {
    if (prevViralUntil.current > 0 && viralUntil === 0) {
      setRingDrain(true);
      ringDrainTimer.current = setTimeout(() => setRingDrain(false), 1400);
    }
    prevViralUntil.current = viralUntil;
    return () => clearTimeout(ringDrainTimer.current);
  }, [viralUntil]);

  // Tier-up flash + callout
  useEffect(() => {
    if (tier > prevTier.current) {
      setTierFlash(true);
      const callout = TIER_CALLOUTS[tier];
      if (callout) pushFloatText({ text: callout, kind: "callout", magnitude: 0 });
      const t = setTimeout(() => setTierFlash(false), 600);
      prevTier.current = tier;
      return () => clearTimeout(t);
    }
    prevTier.current = tier;
  }, [tier]);

  // Idle attract: check every second whether lastTapAt is stale
  useEffect(() => {
    const check = setInterval(() => {
      setIsIdle(lastTapAt === 0 || (Date.now() - lastTapAt) / 1000 >= IDLE_SEC);
    }, 1000);
    return () => clearInterval(check);
  }, [lastTapAt]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      fxTimers.current.forEach(clearTimeout);
      clearTimeout(eruptionTimer.current);
      clearTimeout(ringDrainTimer.current);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const now = Date.now();
    const wasViral = viralUntil > now;
    // Compute gain at current combo BEFORE engageTap increments it
    const cMult = comboMult; // already computed from clampedCombo above
    const modMult = coreCoinMult(activeMod);
    const vMult = viralMult(viralUntil, now);
    const magnitude = cMult * modMult * vMult;
    const gainCoins = tapPower * BALANCE.postCoinConversion * multiplier * magnitude;

    // Push via shared FX layer (replaces old FloatingGain)
    pushFloatText({ text: `+${formatCount(gainCoins)}`, kind: "coin", magnitude, color: ringColor });

    engageTap();
    setIsIdle(false);

    const pCount = 8 + Math.floor(Math.random() * 5); // 8–12
    const id = _nextId++;
    setTapFxs(prev => [...prev.slice(-5), {
      id, ringColor, comboMult: cMult,
      particles: mkParticles(tier, pCount),
    }]);
    const t = setTimeout(() => {
      setTapFxs(prev => prev.filter(f => f.id !== id));
      fxTimers.current.delete(id);
    }, 1000);
    fxTimers.current.set(id, t);

    // 04 §13.8: this tap just pushed combo to comboCap → VIRAL triggers.
    if (!wasViral && useGameStore.getState().viralUntil > now) {
      const capComboMult = 1 + BALANCE.feed.comboCap * BALANCE.feed.comboPerTap;
      const burstMag = BALANCE.feed.viralBurstMult * capComboMult * modMult;
      const burstCoins = tapPower * BALANCE.postCoinConversion * multiplier * burstMag;
      pushFloatText({ text: `+${formatCount(burstCoins)}`, kind: "coin", magnitude: burstMag, color: "var(--gold)" });
      pushFloatText({ text: "VIRAL!!", kind: "callout", magnitude: 0 });
      setEruption(true);
      clearTimeout(eruptionTimer.current);
      eruptionTimer.current = setTimeout(() => setEruption(false), 450);
    }
  };

  const showTapLabel = lastTapAt === 0 || isIdle;

  return (
    <div style={{
      position: 'absolute', left: '50%', top: '50%',
      transform: 'translate(-50%, -50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      zIndex: 3,
    }}>
      {/* 8.4: "🔥 VIRAL ×2" banner with draining time bar — shown above the core */}
      <AnimatePresence>
        {isViral && (
          <motion.div
            key="viral-banner"
            initial={{ opacity: 0, y: -8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 24 }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '4px 14px', borderRadius: 999,
              background: 'rgba(0,0,0,0.55)',
              border: '1px solid var(--gold)',
              boxShadow: '0 0 18px var(--gold)',
            }}
          >
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '13px', letterSpacing: '0.12em',
              color: 'var(--gold)', textShadow: '0 0 10px var(--gold)',
            }}>
              🔥 VIRAL ×{BALANCE.feed.viralGainMult}
            </span>
            <div style={{ width: 90, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
              <motion.div
                key={viralUntil}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: BALANCE.feed.viralSec, ease: 'linear' }}
                style={{ height: '100%', background: 'var(--gold)' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Combo multiplier readout */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '13px', letterSpacing: '0.1em',
        color: combo > 0 ? ringColor : 'var(--dim)',
        transition: 'color 0.3s', minHeight: 18, textAlign: 'center',
      }}>
        ×{(comboMult * (isViral ? BALANCE.feed.viralGainMult : 1)).toFixed(2)}
      </div>

      {/* Ring + button container (220px gives shockwaves room to expand) */}
      <div style={{ position: 'relative', width: 220, height: 220 }}>

        {/* SVG combo ring */}
        <svg
          width={RING_SVG} height={RING_SVG}
          style={{
            position: 'absolute', top: 25, left: 25,
            transform: 'rotate(-90deg)', transition: 'filter 0.3s',
            filter: isViral
              ? `drop-shadow(0 0 16px #fff) drop-shadow(0 0 10px var(--gold))`
              : combo > 0 ? `drop-shadow(0 0 6px ${ringColor})` : 'none',
          }}
        >
          {isViral && (
            <defs>
              <motion.linearGradient
                id="viralGrad"
                animate={{
                  x1: ["0%", "100%", "0%"],
                  y1: ["0%", "100%", "0%"],
                  x2: ["100%", "0%", "100%"],
                  y2: ["100%", "0%", "100%"],
                }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
              >
                <stop offset="0%" stopColor="#fff" />
                <stop offset="40%" stopColor="var(--gold)" />
                <stop offset="100%" stopColor="var(--red)" />
              </motion.linearGradient>
            </defs>
          )}
          <circle cx={RING_R + 5} cy={RING_R + 5} r={RING_R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <circle
            cx={RING_R + 5} cy={RING_R + 5} r={RING_R} fill="none"
            stroke={isViral ? "url(#viralGrad)" : ringColor} strokeWidth={isViral ? 4 : 3}
            strokeLinecap="round" strokeDasharray={RING_CIRC} strokeDashoffset={ringOffset}
            style={{ transition: ringDrain ? 'stroke-dashoffset 1.4s ease-out, stroke 0.3s, stroke-width 0.3s' : 'stroke-dashoffset 0.08s linear, stroke 0.3s, stroke-width 0.3s' }}
          />
        </svg>

        {/* Tier-up flash ring */}
        <AnimatePresence>
          {tierFlash && (
            <motion.div
              key="tierflash"
              initial={{ scale: 1, opacity: 0.9 }}
              animate={{ scale: 1.6, opacity: 0 }}
              exit={{}}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                position: 'absolute', top: '50%', left: '50%',
                width: 140, height: 140, marginTop: -70, marginLeft: -70,
                borderRadius: '50%', border: `3px solid ${ringColor}`,
                boxShadow: `0 0 20px ${ringColor}`, pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>

        {/* TAP CORE button */}
        <motion.button
          onPointerDown={handlePointerDown}
          // Idle breathing: doubles amplitude when idle
          animate={isIdle
            ? { scale: [1, 1.10, 1] }
            : { scale: combo > 0 ? [1, 1.025, 1] : [1, 1.05, 1] }
          }
          transition={{ duration: isIdle ? 1.4 : combo > 0 ? 1.2 : 2.5, repeat: Infinity, ease: 'easeInOut' }}
          // Squash-and-stretch on press, spring overshoot on release
          whileTap={{ scaleX: 1.06, scaleY: 0.90 }}
          style={{
            position: 'absolute', top: 40, left: 40,
            width: 140, height: 140, borderRadius: '50%',
            border: `2px solid ${ringColor}`,
            background: 'transparent',
            boxShadow: combo > 0
              ? `0 0 24px ${ringColor}44, inset 0 0 16px rgba(0,0,0,0.35)`
              : `0 0 10px rgba(255,255,255,0.05), inset 0 0 12px rgba(0,0,0,0.4)`,
            cursor: 'pointer',
            overflow: 'hidden',
            transition: 'border-color 0.3s, box-shadow 0.3s',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {/* Tier skin layers (stacked, crossfaded by opacity) */}
          <GlassSkin op={tier === 0 ? 1 : 0} />
          <NeonSkin   op={tier === 1 ? 1 : 0} />
          <PlasmaSkin op={tier === 2 ? 1 : 0} />
          <GoldSkin   op={tier === 3 ? 1 : 0} />
          <ViralSkin  op={isViral ? 1 : 0} />

          {/* Center ♪ glyph */}
          <span style={{
            position: 'relative', zIndex: 1,
            fontFamily: 'var(--font-display)', fontSize: '28px',
            color: tier === 0 ? 'rgba(255,255,255,0.4)' : ringColor,
            textShadow: tier > 0 ? `0 0 14px ${ringColor}88` : 'none',
            lineHeight: 1, transition: 'color 0.4s, text-shadow 0.4s',
            pointerEvents: 'none', userSelect: 'none',
          }}>
            ♪
          </span>

          {/* "TAP" micro-label (pre-first-tap + idle attract) */}
          <AnimatePresence>
            {showTapLabel && (
              <motion.span
                key="taplabel"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                style={{
                  position: 'absolute', bottom: 22,
                  fontFamily: 'var(--font-mono)', fontSize: '9px',
                  letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)',
                  pointerEvents: 'none', userSelect: 'none',
                }}
              >
                TAP
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* FX: shockwaves + gravity-arc particles */}
        <AnimatePresence>
          {tapFxs.map(fx => (
            <div key={fx.id} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              <ShockwaveFx ringColor={fx.ringColor} comboMult={fx.comboMult} />
              {fx.particles.map((p, i) => (
                <GravParticle key={i} p={p} ringColor={fx.ringColor} />
              ))}
            </div>
          ))}
        </AnimatePresence>
      </div>

      {/* 8.4: VIRAL eruption — full-screen white flash on trigger */}
      <AnimatePresence>
        {eruption && (
          <motion.div
            key="eruption"
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            exit={{}}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            style={{ position: 'fixed', inset: 0, background: '#fff', pointerEvents: 'none', zIndex: 100 }}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
