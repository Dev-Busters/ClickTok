import { useEffect } from "react";
import { useGameStore } from "./store";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { Shell } from "./app/Shell";
import { track } from "./lib/telemetry";

function App() {
  const handle = useGameStore(s => s.handle);

  // 14.5 (10 §E): session_start on mount; session_end when tab hides or unloads.
  useEffect(() => {
    track('session_start', { handle: useGameStore.getState().handle });
    const onVisChange = () => {
      if (document.visibilityState === 'hidden') {
        track('session_end', { handle: useGameStore.getState().handle });
      }
    };
    const onUnload = () => track('session_end', { handle: useGameStore.getState().handle });
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);

  return (
    <>
      {/* Vignette overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'radial-gradient(ellipse 130% 130% at 50% 35%, transparent 40%, rgba(0,0,0,0.75) 100%)',
          pointerEvents: 'none',
          zIndex: 9998,
        }}
      />
      {handle ? <Shell /> : <OnboardingScreen />}
    </>
  );
}

export default App;
