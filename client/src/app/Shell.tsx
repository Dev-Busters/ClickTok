import { useEffect, useState } from "react";
import { useGameLoop } from "../hooks/useGameLoop";
import { useTrendRoom } from "../hooks/useTrendRoom";
import { useGameStore, type IdleReport } from "../store";
import { HomeFeed } from "../screens/HomeFeed";
import { Discover } from "../screens/Discover";
import { Profile } from "../screens/Profile";
import { Live } from "../screens/Live";
import { CreateSheet } from "../screens/Create";
import { BottomNav } from "../navigation/BottomNav";
import { WelcomeBackSheet } from "../components/WelcomeBackSheet";

const DEFAULT_TREND = "dancing";
const WELCOME_BACK_THRESHOLD_SEC = 60;

export function Shell() {
  const activeTab = useGameStore(s => s.activeTab);
  const openSheet = useGameStore(s => s.openSheet);
  const setSheet = useGameStore(s => s.setSheet);
  const phase = useGameStore(s => s.phase);
  const trendTopic = useGameStore(s => s.trendTopic);
  const setTrend = useGameStore(s => s.setTrend);
  const applyIdleIncome = useGameStore(s => s.applyIdleIncome);

  const [idleReport, setIdleReport] = useState<IdleReport | null>(null);

  useEffect(() => {
    if (!trendTopic) setTrend(DEFAULT_TREND);
  }, [trendTopic, setTrend]);

  useEffect(() => {
    const report = applyIdleIncome(Date.now());
    if (report && report.elapsedSec > WELCOME_BACK_THRESHOLD_SEC) {
      setIdleReport(report);
    }
  }, [applyIdleIncome]);

  useGameLoop();
  useTrendRoom(trendTopic);

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
      {phase === 'live' || phase === 'results' ? (
        <Live />
      ) : (
        <>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {activeTab === 'home' && <HomeFeed />}
            {activeTab === 'discover' && <Discover />}
            {activeTab === 'inbox' && (
              <PlaceholderScreen title="INBOX" subtitle="NOTIFICATIONS — COMING SOON" />
            )}
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

function PlaceholderScreen({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div
        className="chroma"
        style={{ fontFamily: 'var(--font-display)', fontSize: '36px', letterSpacing: '0.06em', color: 'var(--text)' }}
      >
        {title}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--dim)', letterSpacing: '0.12em' }}>
        {subtitle}
      </div>
    </div>
  );
}
