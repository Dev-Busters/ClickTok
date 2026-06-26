import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BALANCE } from "../../features/economy/balance";
import { goalById, isOnboardingFeatureAvailable, isOpeningEngagementAvailable, isOpeningPulseModifierPlacementValid, OPENING_PULSE_MODIFIER_DEFAULT_DEG, OPENING_PULSE_ZONE_COST, openingPulseHit, requirementValue, type OpeningPulseZone } from "../../features/onboarding/helpers";
import type { OpeningPulseModifierId, OpeningPulseModifierKind } from "../../features/onboarding/types";
import { formatCount } from "../../lib/format";
import { useGameStore } from "../../store";
import { RhythmPlayfield } from "./rhythm/RhythmPlayfield";
import { OpeningPulseDial } from "./OpeningPulseDial";
import { OpeningPulseModifierEditor } from "./OpeningPulseModifierEditor";

type OpeningTebProps = {
  manualEditing: boolean;
  setManualEditing: (value: boolean) => void;
  selectedModifierId: OpeningPulseModifierId;
  setSelectedModifierId: (value: OpeningPulseModifierId) => void;
  draftAngle: number;
  setDraftAngle: (value: number) => void;
};

function OpeningTeb({ manualEditing, setManualEditing, selectedModifierId, setSelectedModifierId, draftAngle, setDraftAngle }: OpeningTebProps) {
  const wallet = useGameStore(state => state.wallet);
  const openingTap = useGameStore(state => state.openingTap);
  const updatePassivePulse = useGameStore(state => state.updateOpeningPulsePassive);
  const beginCharge = useGameStore(state => state.beginCharge);
  const releaseCharge = useGameStore(state => state.releaseCharge);
  const session = useGameStore(state => state.session);
  const fill = useGameStore(state => state.engagementFill);
  const completed = useGameStore(state => state.completedOnboardingGoals);
  const teaches = useGameStore(state => state.onboardingTeachesSeen);
  const reveal = useGameStore(state => state.activeOnboardingReveal);
  const completeTeach = useGameStore(state => state.completeOnboardingTeach);
  const acknowledgeReveal = useGameStore(state => state.acknowledgeOnboardingReveal);
  const modifiers = useGameStore(state => state.openingPulseModifiers);
  const pulseDirection = useGameStore(state => state.openingPulseDirection);
  const pulseOffsetDeg = useGameStore(state => state.openingPulseOffsetDeg);
  const passiveArmed = useGameStore(state => state.openingPulsePassiveArmed);
  const setModifier = useGameStore(state => state.setOpeningPulseModifier);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const nextReactionId = useRef(0);
  const activePointer = useRef<number | null>(null);
  const activeKey = useRef(false);
  const [tapReactions, setTapReactions] = useState<Array<{ id: number; full: boolean; drift: number; zone: OpeningPulseZone; followers: number; passiveBoosted: boolean }>>([]);
  const [pulseFeedback, setPulseFeedback] = useState<{ id: number; zone: OpeningPulseZone; passiveBoosted: boolean } | null>(null);
  const reduced = useReducedMotion();
  const meterVisible = isOpeningEngagementAvailable(completed);
  const rhythmUnlocked = isOnboardingFeatureAvailable("engagement_meter", completed);
  const meterFull = meterVisible && fill >= BALANCE.onboarding.engagement.cap;
  const ready = rhythmUnlocked && meterFull;
  const selectedKind: OpeningPulseModifierKind = selectedModifierId === "blue_event_1" ? "event" : "passive";
  const selectedModifier = modifiers.find(item => item.id === selectedModifierId);
  const selectedOwned = selectedModifier !== undefined;
  const firstPlacement = reveal?.feature === "pulse_modifier";
  const editing = firstPlacement || manualEditing;
  const placementValid = isOpeningPulseModifierPlacementValid(draftAngle, modifiers, selectedModifierId, selectedKind);
  const canAffordSelected = wallet.coins >= OPENING_PULSE_ZONE_COST;

  useEffect(() => {
    if (!firstPlacement) return;
    setDraftAngle(selectedModifier?.centerDeg ?? OPENING_PULSE_MODIFIER_DEFAULT_DEG);
  }, [firstPlacement, selectedModifier?.centerDeg, setDraftAngle]);

  const selectZone = (id: OpeningPulseModifierId) => {
    const existing = modifiers.find(item => item.id === id);
    setSelectedModifierId(id);
    setDraftAngle(existing?.centerDeg ?? OPENING_PULSE_MODIFIER_DEFAULT_DEG);
  };

  const start = useCallback(() => {
    const now = Date.now();
    const state = useGameStore.getState();
    const hit = openingPulseHit(now, state.openingPulseModifiers, state.openingPulseDirection, state.openingPulseOffsetDeg);
    const followers = openingTap(now);
    const full = useGameStore.getState().engagementFill >= BALANCE.onboarding.engagement.cap;
    const passiveBoosted = state.openingPulsePassiveArmed && state.openingPulsePassiveTarget !== null && hit.eventKey === state.openingPulsePassiveTarget;
    const id = nextReactionId.current++;
    setPulseFeedback({ id, zone: hit.zone, passiveBoosted });
    setTapReactions(current => [...current.slice(-5), { id, full, drift: (Math.random() - .5) * 72, zone: hit.zone, followers, passiveBoosted }]);
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

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  const confirmModifier = () => {
    if (!setModifier(selectedModifierId, selectedKind, draftAngle)) return;
    setManualEditing(false);
    if (!firstPlacement) return;
    acknowledgeReveal();
    completeTeach("pulse_modifier_first_place");
  };

  useEffect(() => () => {
    reactionTimers.current.forEach(clearTimeout);
    reactionTimers.current.clear();
  }, []);

  return (
    <div data-onboarding="teb" style={{ position: "absolute", left: "50%", top: "52%", transform: "translate(-50%,-50%)", zIndex: 5, textAlign: "center" }}>
      <div style={{ position: "relative", width: 206, height: 206, margin: "0 auto" }}>
        <OpeningPulseDial
          feedback={pulseFeedback}
          modifiers={modifiers}
          showTimingGuide={teaches.pulse_timing_first_perfect !== true}
          direction={pulseDirection}
          offsetDeg={pulseOffsetDeg}
          passiveArmed={passiveArmed}
          onPulseFrame={updatePassivePulse}
          editing={editing ? { id: selectedModifierId, kind: selectedKind, centerDeg: draftAngle, valid: placementValid } : undefined}
        />
        {editing && <OpeningPulseModifierEditor
          angle={draftAngle}
          valid={placementValid}
          canAfford={canAffordSelected}
          coins={wallet.coins}
          firstPlacement={firstPlacement}
          selectedId={selectedModifierId}
          selectedKind={selectedKind}
          selectedOwned={selectedOwned}
          ownedIds={modifiers.map(modifier => modifier.id)}
          onSelectZone={selectZone}
          onAngleChange={setDraftAngle}
          onConfirm={confirmModifier}
          onCancel={() => { setDraftAngle(selectedModifier?.centerDeg ?? OPENING_PULSE_MODIFIER_DEFAULT_DEG); setManualEditing(false); }}
        />}
        <motion.button
        aria-label={ready ? "Ready. Hold Engagement to launch TAP THREE" : "Tap Engagement on the moving pulse to earn followers"}
        disabled={editing}
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
          start();
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
        animate={meterFull && !reduced ? { scale: [1, 1.055, 1], boxShadow: ["0 0 38px rgba(255,210,0,.42),inset 0 0 30px rgba(255,210,0,.2)", "0 0 68px rgba(255,210,0,.78),inset 0 0 46px rgba(255,210,0,.34)", "0 0 38px rgba(255,210,0,.42),inset 0 0 30px rgba(255,210,0,.2)"] } : { scale: 1 }}
        transition={meterFull && !reduced ? { duration: 1.05, repeat: Infinity, ease: "easeInOut" } : { duration: .2 }}
        whileTap={{ scale: .96 }}
        style={{
          position: "absolute",
          top: 9,
          left: 9,
          width: 188,
          height: 188,
          borderRadius: "50%",
          cursor: editing ? "default" : "pointer",
          color: "white",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          border: "3px solid rgba(255,255,255,.12)",
          background: meterFull ? "radial-gradient(circle at 50% 45%,rgba(255,210,0,.2),rgba(7,8,12,.97) 68%)" : "radial-gradient(circle at 38% 32%,rgba(255,255,255,.15),rgba(7,8,12,.96) 66%)",
          boxShadow: meterFull ? "0 0 38px rgba(255,210,0,.42),inset 0 0 30px rgba(255,210,0,.2)" : "0 0 28px rgba(37,244,238,.18),inset 0 0 24px rgba(37,244,238,.12)",
          overflow: "hidden",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        {meterVisible && <span aria-hidden style={{ position: "absolute", inset: 7, borderRadius: "50%", background: `conic-gradient(var(--gold) ${fill}%,rgba(255,255,255,.08) 0)`, mask: "radial-gradient(farthest-side,transparent calc(100% - 5px),#000 0)" }} />}
        <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".28em", color: meterFull ? "var(--gold)" : "var(--dim)", transform: "translateX(.14em)" }}>THE</span>
        <span style={{ display: "block", margin: "2px 0", fontFamily: "var(--font-display)", fontSize: 34, lineHeight: 1, letterSpacing: ".06em", color: meterFull ? "var(--gold)" : "white", textShadow: meterFull ? "0 0 18px rgba(255,210,0,.9),-2px 0 var(--red),2px 0 var(--cyan)" : "-2px 0 var(--cyan),2px 0 var(--red)" }}>ENGAGEMENT</span>
        <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".28em", color: meterFull ? "var(--gold)" : "var(--dim)", transform: "translateX(.14em)" }}>BUTTON</span>
        </motion.button>
      </div>
      <AnimatePresence>
        {meterFull && <motion.div key="engagement-full" data-engagement-full initial={{ opacity: 0, scale: .45, y: 12 }} animate={{ opacity: 1, scale: reduced ? 1 : [.45, 1.24, 1], y: 0 }} transition={{ duration: reduced ? .2 : .7, ease: "easeOut" }} style={{ position: "absolute", left: "50%", top: -48, translate: "-50% 0", width: "max-content", padding: "7px 12px", borderRadius: 999, border: "1px solid var(--gold)", background: "rgba(35,28,2,.94)", boxShadow: "0 0 24px rgba(255,210,0,.42)", color: "var(--gold)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 900, letterSpacing: ".14em" }}>⚡ ENGAGEMENT FULL</motion.div>}
      </AnimatePresence>
      <AnimatePresence>
        {tapReactions.map(reaction => <motion.div
          key={`reaction-${reaction.id}`}
          data-tap-reaction={reaction.followers > 0 ? "follower" : "miss"}
          initial={{ opacity: 0, scale: .45, x: reaction.drift * .2, y: -92 }}
          animate={{ opacity: [0, 1, 1, 0], scale: reaction.full ? [.45, 1.55, 1.25, 1.05] : [.45, 1.35, 1.12, 1], x: reaction.full ? reaction.drift * .35 : reaction.drift, y: reaction.full ? -236 : -218 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reaction.full ? 1.2 : 1, ease: "easeOut" }}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            translate: "-50% -50%",
            zIndex: 8,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            fontFamily: "var(--font-mono)",
            fontSize: reaction.full ? (reaction.followers > 0 ? 16 : 30) : reaction.followers > 0 ? 18 : 30,
            fontWeight: 900,
            letterSpacing: reaction.full && reaction.followers > 0 ? ".06em" : ".1em",
            color: reaction.zone === "green" ? "#4dff9a" : reaction.zone === "blue" ? "#37a6ff" : reaction.zone === "passive" ? "#b56cff" : "var(--red)",
            textShadow: reaction.passiveBoosted
              ? "0 0 26px currentColor,0 0 38px rgba(181,108,255,.92),0 0 10px rgba(181,108,255,.82),0 2px 4px rgba(0,0,0,.9)"
              : reaction.full
                ? "0 0 26px currentColor,0 0 8px white,0 2px 4px rgba(0,0,0,.9)"
                : "0 0 18px currentColor,0 2px 4px rgba(0,0,0,.9)",
          }}
        >
          {reaction.zone === "green"
            ? `PERFECT${reaction.passiveBoosted ? " ✦ BOOST" : ""} · +${formatCount(reaction.followers)}`
            : reaction.zone === "blue"
              ? `BLUE${reaction.passiveBoosted ? " ✦ BOOST" : ""} · +${formatCount(reaction.followers)} · REVERSE`
              : reaction.zone === "passive"
                ? "READY"
                : "MISS"}
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
  if (!reveal || reveal.dismissed || reveal.feature === "pulse_modifier") return null;
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
  const modifiers = useGameStore(state => state.openingPulseModifiers);
  const completeTeach = useGameStore(state => state.completeOnboardingTeach);
  const session = useGameStore(state => state.session);
  const [manualEditing, setManualEditing] = useState(false);
  const [selectedModifierId, setSelectedModifierId] = useState<OpeningPulseModifierId>("blue_event_1");
  const [draftAngle, setDraftAngle] = useState(OPENING_PULSE_MODIFIER_DEFAULT_DEG);
  const rhythm = session?.phase === "count_in" || session?.phase === "playing" || session?.phase === "result";
  const studio = isOnboardingFeatureAvailable("creator_studio", completed);
  const goal = goalById(step);
  const progress = requirementValue(goal.requirement, { viewsTotal, totalFollowers: wallet.totalFollowers, openingUpgradeLevels: levels, tapThreeCompletions });
  const studioReadyToClaim = goal.id === "unlock_studio" && progress.current >= progress.target;
  const modifierTeachActive = reveal?.feature === "pulse_modifier";
  const analyticsUnlocked = wallet.totalFollowers >= BALANCE.onboarding.analyticsFollowers;
  const analyticsOpened = teaches.analytics_first_open === true;
  const pulseModifierReadyToClaim = goal.id === "meet_teb" && progress.current >= progress.target;
  const openingChapterComplete = completed.includes("complete_first_rhythm");
  const editorUnlocked = completed.includes("meet_teb");
  const firstPlacement = reveal?.feature === "pulse_modifier";
  const editing = firstPlacement || manualEditing;

  useEffect(() => {
    if (!firstPlacement) return;
    const selectedModifier = modifiers.find(item => item.id === selectedModifierId);
    setDraftAngle(selectedModifier?.centerDeg ?? OPENING_PULSE_MODIFIER_DEFAULT_DEG);
  }, [firstPlacement, modifiers, selectedModifierId]);

  const openStudio = () => {
    if (reveal?.feature === "creator_studio" && !reveal.dismissed) return;
    setSheet("creatorStudio");
    if (reveal?.feature === "creator_studio" && reveal.dismissed && !teaches.studio_first_use) completeTeach("studio_first_use");
  };

  const openEditor = () => {
    const nextId = modifiers[0]?.id ?? selectedModifierId;
    const existing = modifiers.find(item => item.id === nextId);
    setSelectedModifierId(nextId);
    setDraftAngle(existing?.centerDeg ?? OPENING_PULSE_MODIFIER_DEFAULT_DEG);
    setManualEditing(true);
  };

  return <main data-onboarding="pre-video-home" style={{ position: "relative", height: "100%", minHeight: "100%", overflow: "hidden", background: "radial-gradient(circle at 50% 44%,rgba(37,244,238,.09),transparent 32%),linear-gradient(155deg,#11131a,#06070a 58%,#16070c)" }}>
    <motion.div aria-hidden animate={{ opacity: [.25, .5, .25], x: [-10, 12, -10] }} transition={{ duration: 9, repeat: Infinity }} style={{ position: "absolute", width: 250, height: 250, borderRadius: "50%", filter: "blur(70px)", background: "rgba(255,31,75,.16)", right: -100, bottom: 30 }} />
    <header style={{ position: "absolute", inset: "0 0 auto", height: 66, padding: "14px 16px", zIndex: 10, display: "flex", alignItems: "baseline", gap: 8, background: "linear-gradient(rgba(0,0,0,.62),transparent)" }}>
      <strong style={{ fontFamily: "var(--font-display)", fontSize: 32 }}>{formatCount(wallet.followers)}</strong>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--dim)", letterSpacing: ".16em" }}>FOLLOWERS</span>
      {studio && <><strong style={{ marginLeft: "auto", color: "var(--gold)", fontFamily: "var(--font-display)", fontSize: 24 }}>{formatCount(wallet.coins)}</strong><span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--gold)" }}>GOLD</span></>}
    </header>
    <div data-onboarding="goal" style={{ position: "absolute", top: 72, left: 14, right: studio || (editorUnlocked && !editing) ? 112 : 14, zIndex: 9, padding: "9px 11px", borderRadius: 10, background: "rgba(0,0,0,.48)", border: "1px solid rgba(255,255,255,.1)" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: studioReadyToClaim || pulseModifierReadyToClaim ? "var(--gold)" : "var(--cyan)", letterSpacing: ".1em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{openingChapterComplete ? "REFILL ENGAGEMENT · PLAY TAP THREE" : modifierTeachActive ? "PLACE YOUR FIRST TEB ZONE" : analyticsUnlocked && !analyticsOpened ? "ANALYTICS UNLOCKED · OPEN INBOX" : pulseModifierReadyToClaim ? "CLAIM TEB EDITOR · INBOX → ANALYTICS" : studioReadyToClaim ? "CLAIM STUDIO · INBOX → ANALYTICS" : goal.label}</div>
      <div style={{ marginTop: 3, fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--dim)" }}>{openingChapterComplete ? `${Math.round(engagementFill)} / ${BALANCE.onboarding.engagement.cap} · REPEATABLE GOLD` : modifierTeachActive ? "CHOOSE PASSIVE OR BLUE · DRAG THE GHOST" : analyticsUnlocked && !analyticsOpened ? "FIRST ENTRY: TEB EDITOR · +5 GOLD" : `${Math.min(progress.current, progress.target).toLocaleString()} / ${progress.target.toLocaleString()}${goal.reward?.coins ? ` · +${goal.reward.coins} GOLD` : ""}`}</div>
    </div>
    {studio && <motion.button data-onboarding="studio" animate={reveal?.feature === "creator_studio" && reveal.dismissed && !teaches.studio_first_use ? { boxShadow: ["0 0 0 var(--cyan)", "0 0 18px var(--cyan)", "0 0 0 var(--cyan)"] } : {}} transition={{ repeat: Infinity, duration: 1.8 }} onClick={openStudio} style={{ position: "absolute", top: 72, right: 14, zIndex: 11, padding: "10px 12px", borderRadius: 999, border: "1px solid rgba(37,244,238,.55)", background: "rgba(37,244,238,.12)", color: "var(--cyan)", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: ".1em" }}>STUDIO</motion.button>}
    {editorUnlocked && !editing && <motion.button data-open-pulse-modifier initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22 }} onClick={openEditor} style={{ position: "absolute", top: studio ? 114 : 72, right: 14, zIndex: 11, minHeight: 34, padding: "7px 11px", borderRadius: 999, border: "1px solid rgba(55,166,255,.44)", background: "rgba(55,166,255,.09)", color: "#65bdff", fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 900, letterSpacing: ".12em", cursor: "pointer" }}>✦ TEB EDITOR</motion.button>}
    {!rhythm && <OpeningTeb
      manualEditing={manualEditing}
      setManualEditing={setManualEditing}
      selectedModifierId={selectedModifierId}
      setSelectedModifierId={setSelectedModifierId}
      draftAngle={draftAngle}
      setDraftAngle={setDraftAngle}
    />}
    <AnimatePresence>{rhythm && <RhythmPlayfield />}</AnimatePresence>
    <RevealCard />
  </main>;
}
