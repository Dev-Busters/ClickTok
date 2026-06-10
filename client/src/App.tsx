import { useGameStore } from "./store";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { Shell } from "./app/Shell";

function App() {
  const handle = useGameStore(s => s.handle);
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
