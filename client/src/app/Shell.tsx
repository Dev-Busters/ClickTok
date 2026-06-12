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
import { BottomNav } from "../navigation/BottomNav";
import { WelcomeBackSheet } from "../components/WelcomeBackSheet";

const Live = lazy(() => import("../screens/Live").then(m => ({ default: m.Live })));

const WELCOME_BACK_THRESHOLD_SEC = 60;

export function Shell() {
  const activeTab = useGameStore(s => s.activeTab);
  const openSheet = useGameStore(s => s.openSheet);
  const setSheet = useGameStore(s => s.setSheet);
  const phase = useGameStore(s => s.phase);
  const applyIdleIncome = useGameStore(s => s.applyIdleIncome);
  const spectating = useGameStore(s => s.spectating);
  const pendingDrop = useGameStore(s => s.pendingDrop);

  const [idleReport, setIdleReport] = useState<IdleReport | null>(null);

  useEffect(() => {
    const report = applyIdleIncome(Date.now());
    if (report && report.elapsedSec > WELCOME_BACK_THRESHOLD_SEC) {
      setIdleReport(report);
    }
  }, [applyIdleIncome]);

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

          <BottomNav />

          {openSheet === 'create' && (
            <CreateSheet onClose={() => setSheet(null)} />
          )}
        </>
      )}

      {idleReport && (
        <WelcomeBackSheet report={idleReport} onDismiss={() => setIdleReport(null)} />
      )}
    </div>
  );
}
