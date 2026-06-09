import { useGameLoop } from "../hooks/useGameLoop";
import { useTrendRoom } from "../hooks/useTrendRoom";
import { useGameStore } from "../store/gameStore";
import { TapButton } from "./TapButton";
import { StatsBar } from "./StatsBar";
import { UpgradeShop } from "./UpgradeShop";
import { Leaderboard } from "./Leaderboard";

// Default trend topic — in the future this will rotate on a server schedule
const DEFAULT_TREND = "dancing";

export function GameScreen() {
  const handle = useGameStore(s => s.handle);
  const trendTopic = useGameStore(s => s.trendTopic);
  const setTrend = useGameStore(s => s.setTrend);

  // Boot into default trend on mount
  if (!trendTopic) setTrend(DEFAULT_TREND);

  useGameLoop();
  useTrendRoom(trendTopic);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center overflow-y-auto">
      {/* Top bar — TikTok nav style */}
      <div className="w-full max-w-sm flex items-center justify-between px-4 pt-safe pt-4 pb-2">
        <div className="text-white/40 text-sm">
          <span className="text-white font-bold">@{handle}</span>
        </div>
        <div className="text-2xl font-black tracking-tight">
          <span className="text-white">Click</span>
          <span className="text-[#fe2c55]">Tok</span>
        </div>
        <div className="text-white/40 text-sm w-16 text-right">
          {trendTopic && <span className="text-[#fe2c55] text-xs">#{trendTopic}</span>}
        </div>
      </div>

      {/* Main tap zone */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 py-8 w-full">
        <StatsBar />
        <TapButton />
        <Leaderboard />
        <UpgradeShop />
      </div>

      {/* Bottom padding for mobile */}
      <div className="h-8" />
    </div>
  );
}
