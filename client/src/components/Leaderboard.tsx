import { useGameStore } from "../store/gameStore";
import { formatCount } from "../lib/format";

export function Leaderboard() {
  const leaderboard = useGameStore(s => s.leaderboard);
  const myHandle = useGameStore(s => s.handle);
  const trendTopic = useGameStore(s => s.trendTopic);

  if (!trendTopic || leaderboard.length === 0) return null;

  return (
    <div className="w-full max-w-sm px-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[#fe2c55] text-xs font-black tracking-widest uppercase">🔥 Trending</span>
        <span className="text-white/60 text-xs">#{trendTopic}</span>
      </div>
      <div className="flex flex-col gap-1">
        {leaderboard.slice(0, 5).map(entry => (
          <div
            key={entry.id}
            className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
              entry.handle === myHandle ? "bg-[#fe2c55]/20 border border-[#fe2c55]/40" : "bg-white/5"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-white/40 w-4 text-xs">{entry.rank}</span>
              <span className={`font-bold ${entry.handle === myHandle ? "text-[#fe2c55]" : "text-white"}`}>
                @{entry.handle}
              </span>
            </div>
            <span className="text-white/70 font-mono text-xs tabular-nums">
              {formatCount(entry.followers)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
