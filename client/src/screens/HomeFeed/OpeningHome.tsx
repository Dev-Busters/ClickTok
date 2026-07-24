import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BALANCE } from "../../features/economy/balance";
import { goalById, isOnboardingFeatureAvailable, isOpeningEngagementAvailable, openingComboMult, requirementValue } from "../../features/onboarding/helpers";
import { formatCount } from "../../lib/format";
import { useGameStore } from "../../store";
import { RhythmPlayfield } from "./rhythm/RhythmPlayfield";
import { EngagementBubbles } from "./EngagementBubbles";
import { FypFrame } from "./FypFrame";
import { momentumBonusById } from "../../features/onboarding/momentumBonuses";

const COMBO_R = 100;
const COMBO_CIRC = 2 * Math.PI * COMBO_R;

function OpeningTeb() {
  const beginCharge = useGameStore(state => state.beginCharge);
  const releaseCharge = useGameStore(state => state.releaseCharge);
  const session = useGameStore(state => state.session);
  const fill = useGameStore(state => state.engagementFill);
  const tebReadyAt = useGameStore(state => state.tebReadyAt);
  const completed = useGameStore(state => state.completedOnboardingGoals);
  const teaches = useGameStore(state => state.onboardingTeachesSeen);
  const reveal = useGameStore(state => state.activeOnboardingReveal);
  const completeTeach = useGameStore(state => state.completeOnboardingTeach);
  const openingCombo = useGameStore(state => state.openingCombo);
  const viralUntil = useGameStore(state => state.openingViralUntil);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const nextReactionId = useRef(0);
  const activePointer = useRef<number | null>(null);
  const activeKey = useRef(false);
  const [tapReactions, setTapReactions] = useState<Array<{ id: number; kind: "normal" | "shout_out" | "momentum" | "viral"; followers: number; drift: number; label?: string; color?: string }>>([]);
  const [momentumPop, setMomentumPop] = useState(false);
  const momentumPopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useReducedMotion();
  const meterVisible = isOpeningEngagementAvailable(completed);
  const rhythmUnlocked = isOnboardingFeatureAvailable("engagement_meter", completed);
  // TAP THREE readiness is a plain cooldown now (decoupled from Momentum, which
  // auto-fires/resets on its own) — same shape as the main game's "HOLD READY".
  const rhythmReady = rhythmUnlocked && !session && Date.now() >= tebReadyAt;
  const comboFraction = Math.min(1, openingCombo / BALANCE.onboarding.combo.cap);
  const momentumFraction = Math.min(1, fill / BALANCE.onboarding.engagement.cap);
  const isViral = viralUntil > Date.now();
  const comboMult = openingComboMult(Math.floor(openingCombo)) * (isViral ? BALANCE.onboarding.viral.mult : 1);
  const comboColor = isViral ? "var(--gold)" : "var(--cyan)";

  const start = useCallback((at?: { x: number; y: number }) => {
    const now = Date.now();
    const result = useGameStore.getState().openingTap(now, at);
    if (result.followers > 0) {
      const id = nextReactionId.current++;
      const kind = result.shoutOut ? "shout_out" : "normal";
      setTapReactions(current => [...current.slice(-5), { id, kind, followers: result.followers, drift: (Math.random() - .5) * 72 }]);
      const timer = setTimeout(() => {
        setTapReactions(current => current.filter(reaction => reaction.id !== id));
        reactionTimers.current.delete(id);
      }, result.shoutOut ? 1400 : 1100);
      reactionTimers.current.set(id, timer);
    }
    if (result.viralStarted) {
      const id = nextReactionId.current++;
      setTapReactions(current => [...current.slice(-5), { id, kind: "viral", followers: 0, drift: 0 }]);
      const timer = setTimeout(() => {
        setTapReactions(current => current.filter(reaction => reaction.id !== id));
        reactionTimers.current.delete(id);
      }, 1500);
      reactionTimers.current.set(id, timer);
    }
    if (result.bonus) {
      const def = momentumBonusById(result.bonus.id);
      const id = nextReactionId.current++;
      // Non-follower bonuses (storms, duets, pushes) still get a callout so the player
      // always learns which one rolled, even when nothing lands in the wallet.
      const amount = result.bonus.coins > 0 ? `+${formatCount(result.bonus.coins)} 🪙`
        : result.bonus.followers > 0 ? `+${formatCount(result.bonus.followers)}`
        : "";
      setTapReactions(current => [...current.slice(-5), {
        id, kind: "momentum", followers: result.bonus!.followers,
        drift: (Math.random() - .5) * 40, label: `${def.callout}${amount ? ` ${amount}` : ""}`, color: def.color,
      }]);
      const timer = setTimeout(() => {
        setTapReactions(current => current.filter(reaction => reaction.id !== id));
        reactionTimers.current.delete(id);
      }, 1400);
      reactionTimers.current.set(id, timer);
      setMomentumPop(true);
      if (momentumPopTimer.current) clearTimeout(momentumPopTimer.current);
      momentumPopTimer.current = setTimeout(() => setMomentumPop(false), 650);
    }
    if (!rhythmReady || session) return;
    holdTimer.current = setTimeout(() => {
      beginCharge();
      if (reveal?.feature === "engagement_meter" && reveal.dismissed && !teaches.rhythm_first_hold) completeTeach("rhythm_first_hold");
    }, BALANCE.teb.holdLaunchThresholdMs);
  }, [beginCharge, completeTeach, reveal, rhythmReady, session, teaches.rhythm_first_hold]);
  const end = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    if (useGameStore.getState().session?.phase === "charging") releaseCharge({ width: window.innerWidth, height: window.innerHeight });
  }, [releaseCharge]);

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  useEffect(() => () => {
    reactionTimers.current.forEach(clearTimeout);
    reactionTimers.current.clear();
    if (momentumPopTimer.current) clearTimeout(momentumPopTimer.current);
  }, []);

  return (
    <div data-onboarding="teb" style={{ position: "absolute", left: "50%", top: "52%", transform: "translate(-50%,-50%)", zIndex: 5, textAlign: "center" }}>
      <div style={{ position: "relative", width: 206, minHeight: 206, margin: "0 auto" }}>
        {/* Combo ring — builds per tap and visibly bleeds back down while idle. */}
        <svg aria-hidden width={206} height={206} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)", filter: isViral ? "drop-shadow(0 0 14px var(--gold))" : openingCombo > 0 ? "drop-shadow(0 0 6px var(--cyan))" : "none" }}>
          <circle cx={103} cy={103} r={COMBO_R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={3} />
          <circle
            cx={103} cy={103} r={COMBO_R} fill="none"
            stroke={comboColor} strokeWidth={isViral ? 5 : 3} strokeLinecap="round"
            strokeDasharray={COMBO_CIRC} strokeDashoffset={COMBO_CIRC * (1 - comboFraction)}
            style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.3s, stroke-width 0.3s" }}
          />
        </svg>

        {/* Live multiplier readout — makes the decaying bar legible as a number. */}
        <div style={{
          position: "absolute", left: "50%", top: -34, transform: "translateX(-50%)",
          fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 900, letterSpacing: ".08em",
          color: openingCombo > 0 || isViral ? comboColor : "rgba(255,255,255,.35)",
          textShadow: isViral ? "0 0 14px var(--gold)" : "none",
          transition: "color .3s", pointerEvents: "none", whiteSpace: "nowrap",
        }}>
          ×{comboMult.toFixed(2)}
        </div>
        {/* TAP THREE ready cue — small pill, independent of Momentum's fill state */}
        <AnimatePresence>
          {rhythmReady && (
            <motion.div
              key="rhythm-ready"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: [0.55, 1, 0.55], y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              style={{ position: "absolute", left: "50%", top: -6, transform: "translateX(-50%)", zIndex: 6, padding: "3px 10px", borderRadius: 999, background: "rgba(245,166,35,.14)", border: "1px solid rgba(245,166,35,.4)", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 900, letterSpacing: ".12em", color: "var(--gold)", whiteSpace: "nowrap" }}
            >
              HOLD FOR TAP THREE
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
        aria-label={rhythmReady ? "Ready. Hold Engagement to launch TAP THREE" : "Tap Engagement to earn Followers"}
        onPointerDown={event => {
          if (!event.isPrimary || !["mouse", "touch", "pen"].includes(event.pointerType) || activePointer.current !== null) return;
          event.preventDefault();
          event.stopPropagation();
          activePointer.current = event.pointerId;
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Synthetic automation events may not own a native pointer. A normal
            // click still supplies pointerup on the button; real touch/mouse input captures.
          }
          start({ x: event.clientX, y: event.clientY });
        }}
        onPointerUp={event => {
          if (activePointer.current !== event.pointerId) return;
          activePointer.current = null;
          end();
        }}
        onPointerCancel={event => {
          if (activePointer.current !== event.pointerId) return;
          activePointer.current = null;
          end();
        }}
        onLostPointerCapture={event => {
          if (activePointer.current !== event.pointerId) return;
          activePointer.current = null;
          end();
        }}
        onKeyDown={event => {
          if (event.repeat || activeKey.current || (event.key !== " " && event.key !== "Enter")) return;
          event.preventDefault();
          activeKey.current = true;
          start();
        }}
        onKeyUp={event => {
          if (!activeKey.current || (event.key !== " " && event.key !== "Enter")) return;
          event.preventDefault();
          activeKey.current = false;
          end();
        }}
        animate={momentumPop && !reduced ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={momentumPop && !reduced ? { duration: 0.5, ease: "easeOut" } : { duration: .2 }}
        whileTap={{ scale: .96 }}
        style={{
          position: "absolute",
          top: 9,
          left: 9,
          width: 188,
          height: 188,
          borderRadius: "50%",
          cursor: "pointer",
          color: "white",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          border: "3px solid rgba(255,255,255,.12)",
          background: "radial-gradient(circle at 38% 32%,rgba(255,255,255,.15),rgba(7,8,12,.96) 66%)",
          boxShadow: momentumPop ? "0 0 40px rgba(37,244,238,.5),inset 0 0 26px rgba(37,244,238,.24)" : "0 0 28px rgba(37,244,238,.18),inset 0 0 24px rgba(37,244,238,.12)",
          overflow: "hidden",
          touchAction: "none",
          userSelect: "none",
          transition: "box-shadow 0.3s",
        }}
      >
        {/* Momentum ring — fills every tap, pops + resets on its own at cap (see openingTap) */}
        {meterVisible && <span aria-hidden style={{ position: "absolute", inset: 7, borderRadius: "50%", background: `conic-gradient(var(--cyan) ${momentumFraction * 360}deg,rgba(255,255,255,.08) 0)`, mask: "radial-gradient(farthest-side,transparent calc(100% - 5px),#000 0)", transition: momentumPop ? "none" : "background 0.1s linear" }} />}
        <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".28em", color: "var(--dim)", transform: "translateX(.14em)" }}>THE</span>
        <span style={{ display: "block", margin: "2px 0", fontFamily: "var(--font-display)", fontSize: 34, lineHeight: 1, letterSpacing: ".06em", color: "white", textShadow: "-2px 0 var(--cyan),2px 0 var(--red)" }}>ENGAGEMENT</span>
        <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".28em", color: "var(--dim)", transform: "translateX(.14em)" }}>BUTTON</span>
        </motion.button>
      </div>
      <AnimatePresence>
        {tapReactions.map(reaction => <motion.div
          key={`reaction-${reaction.id}`}
          data-tap-reaction={reaction.kind}
          initial={{ opacity: 0, scale: .45, x: reaction.drift * .2, y: -92 }}
          animate={{ opacity: [0, 1, 1, 0], scale: reaction.kind === "shout_out" ? [.45, 1.7, 1.35, 1.1] : reaction.kind === "momentum" ? [.45, 1.5, 1.2, 1] : [.45, 1.35, 1.12, 1], x: reaction.drift, y: reaction.kind === "momentum" ? -246 : -218 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reaction.kind === "shout_out" ? 1.3 : reaction.kind === "momentum" ? 1.2 : 1, ease: "easeOut" }}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            translate: "-50% -50%",
            zIndex: 8,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            fontFamily: "var(--font-mono)",
            fontSize: reaction.kind === "viral" ? 26 : reaction.kind === "shout_out" ? 20 : reaction.kind === "momentum" ? 17 : 18,
            fontWeight: 900,
            letterSpacing: ".06em",
            color: reaction.color ?? (reaction.kind === "shout_out" || reaction.kind === "viral" ? "var(--gold)" : reaction.kind === "momentum" ? "var(--cyan)" : "#4dff9a"),
            textShadow: reaction.kind === "shout_out" || reaction.kind === "viral"
              ? "0 0 26px currentColor,0 0 38px rgba(255,210,0,.92),0 0 10px rgba(255,210,0,.82),0 2px 4px rgba(0,0,0,.9)"
              : reaction.kind === "momentum"
                ? "0 0 26px currentColor,0 0 10px rgba(37,244,238,.85),0 2px 4px rgba(0,0,0,.9)"
                : "0 0 18px currentColor,0 2px 4px rgba(0,0,0,.9)",
          }}
        >
          {reaction.kind === "viral"
            ? "🔥 GOING VIRAL"
            : reaction.kind === "shout_out"
              ? <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span>SHOUT-OUT!</span><span>+{formatCount(reaction.followers)}</span></span>
              : reaction.label
                ? reaction.label
                : `+${formatCount(reaction.followers)}`}
        </motion.div>)}
      </AnimatePresence>

      {/* VIRAL window banner with a draining timer bar. */}
      <AnimatePresence>
        {isViral && (
          <motion.div
            key="viral-banner"
            data-viral-banner
            initial={{ opacity: 0, y: -8, scale: .9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: .9 }}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
            style={{
              position: "absolute", left: "50%", top: -78, translate: "-50% 0",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              padding: "5px 14px", borderRadius: 999,
              background: "rgba(35,28,2,.92)", border: "1px solid var(--gold)",
              boxShadow: "0 0 22px rgba(255,210,0,.5)", pointerEvents: "none", whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontFamily: "var(--font-display)", fontSize: 15, letterSpacing: ".1em", color: "var(--gold)", textShadow: "0 0 10px var(--gold)" }}>
              🔥 VIRAL ×{BALANCE.onboarding.viral.mult}
            </span>
            <div style={{ width: 92, height: 3, borderRadius: 2, background: "rgba(255,255,255,.15)", overflow: "hidden" }}>
              <motion.div
                key={viralUntil}
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: BALANCE.onboarding.viral.durationMs / 1000, ease: "linear" }}
                style={{ height: "100%", background: "var(--gold)" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {meterVisible && <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", color: "rgba(255,255,255,.72)" }}>MOMENTUM {Math.round(fill)} / {BALANCE.onboarding.engagement.cap}{!rhythmUnlocked ? " · BUILDING FOR TAP THREE" : rhythmReady ? " · TAP THREE READY" : session ? "" : " · TAP THREE ON COOLDOWN"}</div>}
    </div>
  );
}

function RevealCard() {
  const reveal = useGameStore(state => state.activeOnboardingReveal);
  const acknowledge = useGameStore(state => state.acknowledgeOnboardingReveal);
  const setSheet = useGameStore(state => state.setSheet);
  const completeTeach = useGameStore(state => state.completeOnboardingTeach);
  const reduced = useReducedMotion();
  if (!reveal || reveal.dismissed) return null;
  const copy = reveal.feature === "shout_out" ? ["SHOUT-OUTS UNLOCKED", "Lucky taps now trigger a big bonus"]
    : reveal.feature === "creator_studio" ? ["CREATOR STUDIO UNLOCKED", "Turn Coins into stronger taps"]
    : reveal.feature === "engagement_meter" ? ["TAP THREE UNLOCKED", "Hold the button whenever it's ready"]
    : ["YOUR FYP IS READY", "Meet your audience"];
  const showReveal = () => {
    acknowledge();
    if (reveal.feature === "shout_out") {
      completeTeach("shout_out_seen");
      return;
    }
    if (reveal.feature !== "creator_studio") return;
    setSheet("creatorStudio");
    completeTeach("studio_first_use");
  };
  return <motion.div initial={{ opacity: 0, y: reduced ? 0 : -8 }} animate={{ opacity: 1, y: 0 }} style={{ position: "absolute", top: 76, right: 14, zIndex: 30, width: 238, padding: 14, borderRadius: 14, background: "rgba(8,10,15,.96)", border: "1px solid var(--cyan)", boxShadow: "0 12px 40px rgba(0,0,0,.45)" }}>
    <strong style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 20, letterSpacing: ".06em" }}>{copy[0]}</strong>
    <span style={{ display: "block", margin: "4px 0 12px", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--dim)" }}>{copy[1]}</span>
    <button onClick={showReveal} style={{ width: "100%", padding: "9px 12px", borderRadius: 999, border: 0, background: "var(--cyan)", color: "#050608", fontFamily: "var(--font-mono)", fontWeight: 800, letterSpacing: ".12em" }}>{reveal.feature === "creator_studio" ? "TAKE ME THERE" : "GOT IT"}</button>
  </motion.div>;
}

export function OpeningHome() {
  const wallet = useGameStore(state => state.wallet);
  const step = useGameStore(state => state.onboardingStep);
  const completed = useGameStore(state => state.completedOnboardingGoals);
  const reveal = useGameStore(state => state.activeOnboardingReveal);
  const teaches = useGameStore(state => state.onboardingTeachesSeen);
  const levels = useGameStore(state => state.openingUpgradeLevels);
  const viewsTotal = useGameStore(state => state.viewsTotal);
  const tapThreeCompletions = useGameStore(state => state.tapThreeCompletions);
  const setSheet = useGameStore(state => state.setSheet);
  const session = useGameStore(state => state.session);
  const rhythm = session?.phase === "count_in" || session?.phase === "playing" || session?.phase === "result";
  const studio = isOnboardingFeatureAvailable("creator_studio", completed);
  const goal = goalById(step);
  const progress = requirementValue(goal.requirement, { viewsTotal, totalFollowers: wallet.totalFollowers, openingUpgradeLevels: levels, tapThreeCompletions });
  const studioReadyToClaim = goal.id === "unlock_studio" && progress.current >= progress.target;
  const shoutOutTeachActive = reveal?.feature === "shout_out" && !reveal.dismissed;
  const analyticsUnlocked = wallet.totalFollowers >= BALANCE.onboarding.analyticsFollowers;
  const analyticsOpened = teaches.analytics_first_open === true;
  const shoutOutReadyToClaim = goal.id === "meet_teb" && progress.current >= progress.target;
  const openingChapterComplete = completed.includes("complete_first_rhythm");

  const openStudio = () => {
    if (reveal?.feature === "creator_studio" && !reveal.dismissed) return;
    setSheet("creatorStudio");
    if (reveal?.feature === "creator_studio" && reveal.dismissed && !teaches.studio_first_use) useGameStore.getState().completeOnboardingTeach("studio_first_use");
  };

  return <main data-onboarding="pre-video-home" style={{ position: "relative", height: "100%", minHeight: "100%", overflow: "hidden", background: "radial-gradient(circle at 50% 44%,rgba(37,244,238,.09),transparent 32%),linear-gradient(155deg,#11131a,#06070a 58%,#16070c)" }}>
    <motion.div aria-hidden animate={{ opacity: [.25, .5, .25], x: [-10, 12, -10] }} transition={{ duration: 9, repeat: Infinity }} style={{ position: "absolute", width: 250, height: 250, borderRadius: "50%", filter: "blur(70px)", background: "rgba(255,31,75,.16)", right: -100, bottom: 30 }} />
    <header style={{ position: "absolute", inset: "0 0 auto", height: 66, padding: "14px 16px", zIndex: 10, display: "flex", alignItems: "baseline", gap: 8, background: "linear-gradient(rgba(0,0,0,.62),transparent)" }}>
      <strong style={{ fontFamily: "var(--font-display)", fontSize: 32 }}>{formatCount(wallet.followers)}</strong>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--dim)", letterSpacing: ".16em" }}>FOLLOWERS</span>
      {studio && <><strong style={{ marginLeft: "auto", color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: 24 }}>{formatCount(wallet.coins)}</strong><span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--gold)" }}>GOLD</span></>}
    </header>
    <div data-onboarding="goal" style={{ position: "absolute", top: 72, left: 14, right: studio || (reveal && !reveal.dismissed) ? 112 : 14, zIndex: 9, padding: "9px 11px", borderRadius: 10, background: "rgba(0,0,0,.48)", border: "1px solid rgba(255,255,255,.1)" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: studioReadyToClaim || shoutOutReadyToClaim ? "var(--gold)" : "var(--cyan)", letterSpacing: ".1em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{openingChapterComplete ? "PLAY TAP THREE · REPEATABLE GOLD" : shoutOutTeachActive ? "SHOUT-OUTS UNLOCKED" : analyticsUnlocked && !analyticsOpened ? "ANALYTICS UNLOCKED · OPEN INBOX" : shoutOutReadyToClaim ? "CLAIM SHOUT-OUTS · INBOX → ANALYTICS" : studioReadyToClaim ? "CLAIM STUDIO · INBOX → ANALYTICS" : goal.label}</div>
      <div style={{ marginTop: 3, fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--dim)" }}>{openingChapterComplete ? "HOLD TEB WHEN READY" : shoutOutTeachActive ? "LUCKY TAPS NOW PAY A BIG BONUS" : analyticsUnlocked && !analyticsOpened ? "FIRST ENTRY: SHOUT-OUTS · +5 GOLD" : `${Math.min(progress.current, progress.target).toLocaleString()} / ${progress.target.toLocaleString()}${goal.reward?.coins ? ` · +${goal.reward.coins} GOLD` : ""}`}</div>
    </div>
    {studio && <motion.button data-onboarding="studio" animate={reveal?.feature === "creator_studio" && reveal.dismissed && !teaches.studio_first_use ? { boxShadow: ["0 0 0 var(--cyan)", "0 0 18px var(--cyan)", "0 0 0 var(--cyan)"] } : {}} transition={{ repeat: Infinity, duration: 1.8 }} onClick={openStudio} style={{ position: "absolute", top: 72, right: 14, zIndex: 11, padding: "10px 12px", borderRadius: 999, border: "1px solid rgba(37,244,238,.55)", background: "rgba(37,244,238,.12)", color: "var(--cyan)", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em" }}>STUDIO</motion.button>}
    {!rhythm && <EngagementBubbles />}
    {!rhythm && <FypFrame />}
    {!rhythm && <OpeningTeb />}
    <AnimatePresence>{rhythm && <RhythmPlayfield />}</AnimatePresence>
    <RevealCard />
  </main>;
}
