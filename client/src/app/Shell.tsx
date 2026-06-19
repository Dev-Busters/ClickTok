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
import { isFeatureUnlocked } from "../features/metrics/unlocks";
import { buildChart, offsetChart } from "../features/teb/chartBuilder";
import type { SequenceId } from "../features/teb/types";

const Live = lazy(() => import("../screens/Live").then(m => ({ default: m.Live })));

const WELCOME_BACK_THRESHOLD_SEC = 60;

export function Shell() {
  const activeTab = useGameStore(s => s.activeTab);
  const openSheet = useGameStore(s => s.openSheet);
  const setSheet = useGameStore(s => s.setSheet);
  const phase = useGameStore(s => s.phase);
  const metricsReached = useGameStore(s => s.metricsReached);
  const navUnlocked = isFeatureUnlocked("bottom_nav", metricsReached);
  const applyIdleIncome = useGameStore(s => s.applyIdleIncome);
  const spectating = useGameStore(s => s.spectating);
  const pendingDrop = useGameStore(s => s.pendingDrop);
  const royaltyToast = useGameStore(s => s.royaltyToast);
  const tebSession = useGameStore(s => s.session);
  const rhythmOwnsField = tebSession?.phase === "count_in" || tebSession?.phase === "playing" || tebSession?.phase === "result";

  const [idleReport, setIdleReport] = useState<IdleReport | null>(null);

  useEffect(() => {
    const report = applyIdleIncome(Date.now());
    if (report && report.elapsedSec > WELCOME_BACK_THRESHOLD_SEC) {
      setIdleReport(report);
    }
  }, [applyIdleIncome]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const sequence = new URLSearchParams(window.location.search).get("rhythmQa") as SequenceId | null;
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

          {navUnlocked && !rhythmOwnsField && (
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
      <CelebrationLayer />

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
