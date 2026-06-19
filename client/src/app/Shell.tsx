import { lazy, Suspense, useEffect, useState } from "react";
import { useGameLoop } from "../hooks/useGameLoop";
import { useLobby } from "../hooks/useLobby";
import { useStreamerRoom, useSpectatorRoom } from "../hooks/useStreamRoom";
import { useSimSpectator } from "../hooks/useSimSpectator";
import { useCloudSync } from "../hooks/useCloudSync";
import { useGameStore, type IdleReport } from "../store";
import { HomeFeed } from "../screens/HomeFeed";
import { Discover } from "../screens/Discover";
import { Inbox } from "../screens/Inbox";
import { Profile } from "../screens/Profile";
import { CreateSheet } from "../screens/Create";
import { CreatorStudio } from "../screens/CreatorStudio";
import { BottomNav } from "../navigation/BottomNav";
import { WelcomeBackSheet } from "../components/WelcomeBackSheet";
import { CelebrationLayer } from "../components/fx/CelebrationLayer";
import { AnimatePresence, motion } from "framer-motion";
import { buildChart, offsetChart } from "../features/teb/chartBuilder";
import type { SequenceId } from "../features/teb/types";
import { isOnboardingFeatureAvailable } from "../features/onboarding/helpers";

const Live = lazy(() => import("../screens/Live").then(m => ({ default: m.Live })));

const WELCOME_BACK_THRESHOLD_SEC = 60;

export function Shell() {
  const activeTab = useGameStore(s => s.activeTab);
  const openSheet = useGameStore(s => s.openSheet);
  const setSheet = useGameStore(s => s.setSheet);
  const phase = useGameStore(s => s.phase);
  const completedOnboardingGoals = useGameStore(s => s.completedOnboardingGoals);
  const onboardingTeachesSeen = useGameStore(s => s.onboardingTeachesSeen);
  const navUnlocked = isOnboardingFeatureAvailable("video_fyp", completedOnboardingGoals)
    && onboardingTeachesSeen.video_fyp_first_action === true;
  const applyIdleIncome = useGameStore(s => s.applyIdleIncome);
  const spectating = useGameStore(s => s.spectating);
  const pendingDrop = useGameStore(s => s.pendingDrop);
  const royaltyToast = useGameStore(s => s.royaltyToast);

  const [idleReport, setIdleReport] = useState<IdleReport | null>(null);

  useEffect(() => {
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("onboardingQa")) return;
    const report = applyIdleIncome(Date.now());
    if (report && report.elapsedSec > WELCOME_BACK_THRESHOLD_SEC) {
      setIdleReport(report);
    }
  }, [applyIdleIncome]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    const onboardingQa = params.get("onboardingQa");
    if (onboardingQa === "fresh") useGameStore.getState().resetOnboardingRevision();
    if (onboardingQa === "studio") useGameStore.setState({
      wallet: { followers: 400, totalFollowers: 400, coins: 10, likes: 0, diamonds: 0 },
      viewsTotal: 400,
      onboardingStep: "unlock_studio",
      completedOnboardingGoals: ["meet_teb", "unlock_studio"],
      activeOnboardingReveal: { feature: "creator_studio", shownAt: Date.now(), dismissed: false },
      onboardingTeachesSeen: {},
      openingUpgradeLevels: { audience_reach: 0, engagement_rate: 0 },
    });
    if (onboardingQa === "rhythm") useGameStore.setState({
      wallet: { followers: 2400, totalFollowers: 2400, coins: 40, likes: 0, diamonds: 0 },
      viewsTotal: 1800,
      onboardingStep: "unlock_rhythm",
      completedOnboardingGoals: ["meet_teb", "unlock_studio", "buy_audience_reach", "reach_700", "own_three_fyp_levels", "reach_1200", "unlock_rhythm"],
      activeOnboardingReveal: { feature: "engagement_meter", shownAt: Date.now(), dismissed: true },
      onboardingTeachesSeen: { studio_first_use: true },
      openingUpgradeLevels: { audience_reach: 2, engagement_rate: 1 },
      engagementFill: 100,
    });
    if (onboardingQa === "video" || onboardingQa === "videoReady") useGameStore.setState({
      wallet: { followers: 10000, totalFollowers: 10000, coins: 60, likes: 0, diamonds: 0 },
      onboardingStep: "unlock_video_fyp",
      completedOnboardingGoals: ["meet_teb", "unlock_studio", "buy_audience_reach", "reach_700", "own_three_fyp_levels", "reach_1200", "unlock_rhythm", "complete_first_rhythm", "unlock_video_fyp"],
      activeOnboardingReveal: onboardingQa === "video" ? { feature: "video_fyp", shownAt: Date.now(), dismissed: false } : null,
      onboardingTeachesSeen: onboardingQa === "video" ? { studio_first_use: true, rhythm_first_hold: true } : { studio_first_use: true, rhythm_first_hold: true, video_fyp_first_action: true },
      openingUpgradeLevels: { audience_reach: 3, engagement_rate: 2 },
      metricsReached: [],
      passiveFollowersPerSec: 0,
      passiveCoinsPerSec: 0,
      ownedElements: {},
    });
    const sequence = params.get("rhythmQa") as SequenceId | null;
    if (!sequence || !["tap_three", "hold_pulse", "swipe_chain", "trace_arc"].includes(sequence)) return;
    const startsAt = Date.now() + 1200;
    useGameStore.setState({
      session: { phase: "count_in", chart: offsetChart(buildChart(sequence, 17017, { width: window.innerWidth, height: window.innerHeight }), startsAt), chargeQuality: 1, startsAt },
      tebSequenceTeachSeen: { tap_three: true, hold_pulse: true, swipe_chain: true, trace_arc: true },
    });
  }, []);

  useGameLoop();
  useLobby();
  useStreamerRoom();
  useSpectatorRoom();
  useSimSpectator();
  useCloudSync();

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '420px',
        height: '100svh',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        borderLeft: '1px solid rgba(255,255,255,0.04)',
        borderRight: '1px solid rgba(255,255,255,0.04)',
        overflow: 'hidden',
      }}
    >
      {phase === 'live' || phase === 'results' || spectating !== null || pendingDrop !== null ? (
        <Suspense fallback={<div style={{ position: 'absolute', inset: 0, background: 'var(--bg)' }} />}>
          <Live />
        </Suspense>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {activeTab === 'home' && <HomeFeed />}
            {activeTab === 'discover' && <Discover />}
            {activeTab === 'inbox' && <Inbox />}
            {activeTab === 'profile' && <Profile />}
          </div>

          {navUnlocked && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              style={{ flexShrink: 0 }}
            >
              <BottomNav />
            </motion.div>
          )}

          {openSheet === 'create' && (
            <CreateSheet onClose={() => setSheet(null)} />
          )}

          <AnimatePresence>
            {openSheet === 'creatorStudio' && (
              <CreatorStudio onClose={() => setSheet(null)} />
            )}
          </AnimatePresence>
        </>
      )}

      {idleReport && (
        <WelcomeBackSheet report={idleReport} onDismiss={() => setIdleReport(null)} />
      )}

      {/* 10.5: celebration popups — element/pillar unlocks, affordable alerts */}
      {onboardingTeachesSeen.legacy_preserved === true && <CelebrationLayer />}
      <VideoFypTeach />

      {/* 7.6: royalty toast — appears on any tab when someone engages your video */}
      {royaltyToast && (
        <div style={{
          position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.82)', border: '1px solid var(--dim)',
          borderRadius: 20, padding: '8px 16px', whiteSpace: 'nowrap',
          fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--text)',
          pointerEvents: 'none', zIndex: 200,
        }}>
          {royaltyToast}
        </div>
      )}
    </div>
  );
}

function VideoFypTeach() {
  const reveal = useGameStore(state => state.activeOnboardingReveal);
  const acknowledge = useGameStore(state => state.acknowledgeOnboardingReveal);
  const completeTeach = useGameStore(state => state.completeOnboardingTeach);
  const react = useGameStore(state => state.reactToCard);
  if (reveal?.feature !== "video_fyp") return null;
  if (!reveal.dismissed) return <><div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 349, background: "transparent" }} /><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ position: "absolute", top: 76, right: 14, zIndex: 350, width: 240, padding: 14, borderRadius: 14, background: "rgba(8,10,15,.96)", border: "1px solid var(--cyan)" }}>
    <strong style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 22 }}>YOUR VIDEO FYP</strong>
    <span style={{ display: "block", margin: "4px 0 12px", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--dim)" }}>Creators, captions and reactions are now live.</span>
    <button onClick={acknowledge} style={{ width: "100%", padding: 9, border: 0, borderRadius: 999, background: "var(--cyan)", color: "#050608", fontFamily: "var(--font-mono)", fontWeight: 800 }}>SHOW ME</button>
  </motion.div></>;
  return <><div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 349, background: "transparent" }} /><motion.button initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: [1, 1.06, 1] }} transition={{ scale: { repeat: Infinity, duration: 1.4 } }} onClick={() => { react("like"); completeTeach("video_fyp_first_action"); }} style={{ position: "absolute", right: 12, bottom: 242, zIndex: 350, padding: "10px 14px", borderRadius: 999, border: "2px solid var(--cyan)", background: "rgba(0,0,0,.9)", color: "white", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em" }}>♥ TRY LIKE</motion.button></>;
}
