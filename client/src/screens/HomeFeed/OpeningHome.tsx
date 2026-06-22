import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BALANCE } from "../../features/economy/balance";
import { goalById, isOnboardingFeatureAvailable, isOpeningEngagementAvailable, requirementValue } from "../../features/onboarding/helpers";
import { formatCount } from "../../lib/format";
import { useGameStore } from "../../store";
import { RhythmPlayfield } from "./rhythm/RhythmPlayfield";

function OpeningTeb() {
  const openingTap = useGameStore(state => state.openingTap);
  const beginCharge = useGameStore(state => state.beginCharge);
  const releaseCharge = useGameStore(state => state.releaseCharge);
  const session = useGameStore(state => state.session);
  const fill = useGameStore(state => state.engagementFill);
  const completed = useGameStore(state => state.completedOnboardingGoals);
  const teaches = useGameStore(state => state.onboardingTeachesSeen);
  const reveal = useGameStore(state => state.activeOnboardingReveal);
  const completeTeach = useGameStore(state => state.completeOnboardingTeach);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const nextReactionId = useRef(0);
  const [tapReactions, setTapReactions] = useState<Array<{ id: number; success: boolean; full: boolean; drift: number; glyph: string }>>([]);
  const reduced = useReducedMotion();
  const meterVisible = isOpeningEngagementAvailable(completed);
  const rhythmUnlocked = isOnboardingFeatureAvailable("engagement_meter", completed);
  const meterFull = meterVisible && fill >= BALANCE.onboarding.engagement.cap;
  const ready = rhythmUnlocked && meterFull;

  const start = useCallback(() => {
    const followersBefore = useGameStore.getState().wallet.totalFollowers;
    openingTap();
    const tapState = useGameStore.getState();
    const success = tapState.wallet.totalFollowers > followersBefore;
    const full = tapState.engagementFill >= BALANCE.onboarding.engagement.cap;
    const id = nextReactionId.current++;
    const glyphs = ["♥", "💬", "↗", "✦"];
    setTapReactions(current => [...current.slice(-5), { id, success, full, drift: (Math.random() - .5) * 72, glyph: glyphs[id % glyphs.length] }]);
    const timer = setTimeout(() => {
      setTapReactions(current => current.filter(reaction => reaction.id !== id));
      reactionTimers.current.delete(id);
    }, full ? 1300 : 1100);
    reactionTimers.current.set(id, timer);
    if (!ready || session) return;
    holdTimer.current = setTimeout(() => {
      beginCharge();
      if (reveal?.feature === "engagement_meter" && reveal.dismissed && !teaches.rhythm_first_hold) completeTeach("rhythm_first_hold");
    }, BALANCE.teb.holdLaunchThresholdMs);
  }, [beginCharge, completeTeach, openingTap, ready, reveal, session, teaches.rhythm_first_hold]);
  const end = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    if (useGameStore.getState().session?.phase === "charging") releaseCharge({ width: window.innerWidth, height: window.innerHeight });
  }, [releaseCharge]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
      event.preventDefault();
      start();
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") end();
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, [end, start]);

  useEffect(() => () => {
    reactionTimers.current.forEach(clearTimeout);
    reactionTimers.current.clear();
  }, []);

  return (
    <div data-onboarding="teb" style={{ position: "absolute", left: "50%", top: "52%", transform: "translate(-50%,-50%)", zIndex: 5, textAlign: "center" }}>
      <motion.button
        aria-label={ready ? "Ready. Hold Engagement to launch TAP THREE" : "Tap Engagement to roll for a Follower"}
        onPointerDown={event => { event.stopPropagation(); start(); }}
        animate={meterFull && !reduced ? { scale: [1, 1.055, 1], boxShadow: ["0 0 38px rgba(255,210,0,.42),inset 0 0 30px rgba(255,210,0,.2)", "0 0 68px rgba(255,210,0,.78),inset 0 0 46px rgba(255,210,0,.34)", "0 0 38px rgba(255,210,0,.42),inset 0 0 30px rgba(255,210,0,.2)"] } : { scale: 1 }}
        transition={meterFull && !reduced ? { duration: 1.05, repeat: Infinity, ease: "easeInOut" } : { duration: .2 }}
        whileTap={{ scale: .96 }}
        style={{
          width: 188, height: 188, borderRadius: "50%", cursor: "pointer", color: "white",
          border: `3px solid ${meterFull ? "var(--gold)" : "var(--cyan)"}`,
          background: meterFull ? "radial-gradient(circle at 50% 45%,rgba(255,210,0,.2),rgba(7,8,12,.97) 68%)" : "radial-gradient(circle at 38% 32%,rgba(255,255,255,.15),rgba(7,8,12,.96) 66%)",
          boxShadow: meterFull ? "0 0 38px rgba(255,210,0,.42),inset 0 0 30px rgba(255,210,0,.2)" : "0 0 28px rgba(37,244,238,.18),inset 0 0 24px rgba(37,244,238,.12)",
          position: "relative", overflow: "hidden",
        }}
      >
        {meterVisible && <span aria-hidden style={{ position: "absolute", inset: 7, borderRadius: "50%", background: `conic-gradient(var(--gold) ${fill}%,rgba(255,255,255,.08) 0)`, mask: "radial-gradient(farthest-side,transparent calc(100% - 5px),#000 0)" }} />}
        <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".28em", color: meterFull ? "var(--gold)" : "var(--dim)", transform: "translateX(.14em)" }}>THE</span>
        <span style={{ display: "block", margin: "2px 0", fontFamily: "var(--font-display)", fontSize: 34, lineHeight: 1, letterSpacing: ".06em", color: meterFull ? "var(--gold)" : "white", textShadow: meterFull ? "0 0 18px rgba(255,210,0,.9),-2px 0 var(--red),2px 0 var(--cyan)" : "-2px 0 var(--cyan),2px 0 var(--red)" }}>ENGAGEMENT</span>
        <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".28em", color: meterFull ? "var(--gold)" : "var(--dim)", transform: "translateX(.14em)" }}>BUTTON</span>
      </motion.button>
      <AnimatePresence>
        {meterFull && <motion.div key="engagement-full" data-engagement-full initial={{ opacity: 0, scale: .45, y: 12 }} animate={{ opacity: 1, scale: reduced ? 1 : [.45, 1.24, 1], y: 0 }} transition={{ duration: reduced ? .2 : .7, ease: "easeOut" }} style={{ position: "absolute", left: "50%", top: -48, translate: "-50% 0", width: "max-content", padding: "7px 12px", borderRadius: 999, border: "1px solid var(--gold)", background: "rgba(35,28,2,.94)", boxShadow: "0 0 24px rgba(255,210,0,.42)", color: "var(--gold)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 900, letterSpacing: ".14em" }}>⚡ ENGAGEMENT FULL</motion.div>}
      </AnimatePresence>
      <AnimatePresence>
        {tapReactions.map(reaction => <motion.div
          key={`reaction-${reaction.id}`}
          data-tap-reaction={reaction.success ? "follower" : "engaged"}
          initial={{ opacity: 0, scale: .45, x: reaction.drift * .2, y: -92 }}
          animate={{ opacity: [0, 1, 1, 0], scale: reaction.full ? [.45, 1.55, 1.25, 1.05] : [.45, 1.35, 1.12, 1], x: reaction.full ? reaction.drift * .35 : reaction.drift, y: reaction.full ? -236 : -218 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reaction.full ? 1.2 : 1, ease: "easeOut" }}
          style={{ position: "absolute", left: "50%", top: "50%", translate: "-50% -50%", zIndex: 8, pointerEvents: "none", whiteSpace: "nowrap", fontFamily: "var(--font-mono)", fontSize: reaction.full ? (reaction.success ? 16 : 30) : reaction.success ? 18 : 36, fontWeight: 900, letterSpacing: reaction.full && reaction.success ? ".06em" : ".1em", color: reaction.full || reaction.success ? "var(--gold)" : "var(--cyan)", textShadow: reaction.full ? "0 0 26px currentColor,0 0 8px white,0 2px 4px rgba(0,0,0,.9)" : "0 0 18px currentColor,0 2px 4px rgba(0,0,0,.9)" }}
        >
          {reaction.full ? (reaction.success ? "+1 FOLLOWER · FULL" : `${reaction.glyph} FULL`) : reaction.success ? "+1 FOLLOWER" : reaction.glyph}
        </motion.div>)}
      </AnimatePresence>
      {meterVisible && <div style={{ marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: meterFull ? 900 : 400, letterSpacing: ".1em", color: meterFull ? "var(--gold)" : "rgba(255,255,255,.72)", textShadow: meterFull ? "0 0 12px rgba(255,210,0,.72)" : "none" }}>ENGAGEMENT {Math.round(fill)} / 100{meterFull ? (rhythmUnlocked ? " · HOLD TO LAUNCH" : " · FULL · TAP THREE LOCKED") : !rhythmUnlocked ? " · BUILDING FOR TAP THREE" : ""}</div>}
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
  const copy = reveal.feature === "creator_studio" ? ["CREATOR STUDIO UNLOCKED", "Turn Coins into stronger taps"]
    : reveal.feature === "engagement_meter" ? ["TAP THREE UNLOCKED", "Fill Engagement, then hold the button"]
    : ["YOUR FYP IS READY", "Meet your audience"];
  const showReveal = () => {
    acknowledge();
    if (reveal.feature !== "creator_studio") return;
    setSheet("creatorStudio");
    completeTeach("studio_first_use");
  };
  return <motion.div initial={{ opacity: 0, y: reduced ? 0 : -8 }} animate={{ opacity: 1, y: 0 }} style={{ position: "absolute", top: 76, right: 14, zIndex: 30, width: 238, padding: 14, borderRadius: 14, background: "rgba(8,10,15,.96)", border: "1px solid var(--cyan)", boxShadow: "0 12px 40px rgba(0,0,0,.45)" }}>
    <strong style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 20, letterSpacing: ".06em" }}>{copy[0]}</strong>
    <span style={{ display: "block", margin: "4px 0 12px", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--dim)" }}>{copy[1]}</span>
    <button onClick={showReveal} style={{ width: "100%", padding: "9px 12px", borderRadius: 999, border: 0, background: "var(--cyan)", color: "#050608", fontFamily: "var(--font-mono)", fontWeight: 800, letterSpacing: ".12em" }}>{reveal.feature === "creator_studio" ? "TAKE ME THERE" : "SHOW ME"}</button>
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
  const engagementFill = useGameStore(state => state.engagementFill);
  const setSheet = useGameStore(state => state.setSheet);
  const completeTeach = useGameStore(state => state.completeOnboardingTeach);
  const session = useGameStore(state => state.session);
  const rhythm = session?.phase === "count_in" || session?.phase === "playing" || session?.phase === "result";
  const studio = isOnboardingFeatureAvailable("creator_studio", completed);
  const goal = goalById(step);
  const progress = requirementValue(goal.requirement, { viewsTotal, totalFollowers: wallet.totalFollowers, openingUpgradeLevels: levels, tapThreeCompletions });
  const openingChapterComplete = completed.includes("complete_first_rhythm");

  const openStudio = () => {
    if (reveal?.feature === "creator_studio" && !reveal.dismissed) return;
    setSheet("creatorStudio");
    if (reveal?.feature === "creator_studio" && reveal.dismissed && !teaches.studio_first_use) completeTeach("studio_first_use");
  };

  return <main data-onboarding="pre-video-home" style={{ position: "relative", height: "100%", minHeight: "100%", overflow: "hidden", background: "radial-gradient(circle at 50% 44%,rgba(37,244,238,.09),transparent 32%),linear-gradient(155deg,#11131a,#06070a 58%,#16070c)" }}>
    <motion.div aria-hidden animate={{ opacity: [.25, .5, .25], x: [-10, 12, -10] }} transition={{ duration: 9, repeat: Infinity }} style={{ position: "absolute", width: 250, height: 250, borderRadius: "50%", filter: "blur(70px)", background: "rgba(255,31,75,.16)", right: -100, bottom: 30 }} />
    <header style={{ position: "absolute", inset: "0 0 auto", height: 66, padding: "14px 16px", zIndex: 10, display: "flex", alignItems: "baseline", gap: 8, background: "linear-gradient(rgba(0,0,0,.62),transparent)" }}>
      <strong style={{ fontFamily: "var(--font-display)", fontSize: 32 }}>{formatCount(wallet.followers)}</strong>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--dim)", letterSpacing: ".16em" }}>FOLLOWERS</span>
      {studio && <><strong style={{ marginLeft: "auto", color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: 24 }}>{formatCount(wallet.coins)}</strong><span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--gold)" }}>COINS</span></>}
    </header>
    <div data-onboarding="goal" style={{ position: "absolute", top: 72, left: 14, right: studio ? 104 : 14, zIndex: 9, padding: "9px 11px", borderRadius: 10, background: "rgba(0,0,0,.48)", border: "1px solid rgba(255,255,255,.1)" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--cyan)", letterSpacing: ".1em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{openingChapterComplete ? "REFILL ENGAGEMENT · PLAY TAP THREE" : goal.label}</div>
      <div style={{ marginTop: 3, fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--dim)" }}>{openingChapterComplete ? `${Math.round(engagementFill)} / ${BALANCE.onboarding.engagement.cap} · REPEATABLE COINS` : `${Math.min(progress.current, progress.target).toLocaleString()} / ${progress.target.toLocaleString()}${goal.reward?.coins ? ` · +${goal.reward.coins} COINS` : ""}`}</div>
    </div>
    {studio && <motion.button data-onboarding="studio" animate={reveal?.feature === "creator_studio" && reveal.dismissed && !teaches.studio_first_use ? { boxShadow: ["0 0 0 var(--cyan)", "0 0 18px var(--cyan)", "0 0 0 var(--cyan)"] } : {}} transition={{ repeat: Infinity, duration: 1.8 }} onClick={openStudio} style={{ position: "absolute", top: 72, right: 14, zIndex: 11, padding: "10px 12px", borderRadius: 999, border: "1px solid rgba(37,244,238,.55)", background: "rgba(37,244,238,.12)", color: "var(--cyan)", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em" }}>STUDIO</motion.button>}
    {!rhythm && <OpeningTeb />}
    <AnimatePresence>{rhythm && <RhythmPlayfield />}</AnimatePresence>
    <RevealCard />
  </main>;
}
