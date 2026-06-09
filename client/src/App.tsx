import { useGameStore } from "./store/gameStore";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { GameScreen } from "./components/GameScreen";

function App() {
  const handle = useGameStore(s => s.handle);
  return handle ? <GameScreen /> : <OnboardingScreen />;
}

export default App
