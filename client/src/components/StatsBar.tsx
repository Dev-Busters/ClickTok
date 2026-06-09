import { useGameStore } from "../store/gameStore";
import { formatCount } from "../lib/format";

export function StatsBar() {
  const followers = useGameStore(s => s.followers);
  const likes = useGameStore(s => s.likes);
  const comments = useGameStore(s => s.comments);
  const passiveFollowersPerSec = useGameStore(s => s.passiveFollowersPerSec);
  const multiplier = useGameStore(s => s.multiplier);

  return (
    <div className="w-full max-w-sm px-4">
      {/* Follower count — hero number */}
      <div className="text-center mb-4">
        <div className="text-5xl font-black text-white tabular-nums tracking-tight">
          {formatCount(followers)}
        </div>
        <div className="text-[#fe2c55] text-sm font-semibold mt-1 tracking-widest uppercase">followers</div>
        {passiveFollowersPerSec > 0 && (
          <div className="text-white/50 text-xs mt-1">
            +{formatCount(passiveFollowersPerSec * multiplier)}/sec
          </div>
        )}
      </div>

      {/* Secondary stats row — TikTok action bar style */}
      <div className="flex justify-around items-center bg-white/5 rounded-2xl px-6 py-3 border border-white/10">
        <Stat icon="❤️" label="Likes" value={formatCount(likes)} />
        <div className="w-px h-8 bg-white/10" />
        <Stat icon="💬" label="Comments" value={formatCount(comments)} />
        {multiplier > 1 && (
          <>
            <div className="w-px h-8 bg-white/10" />
            <Stat icon="⚡" label="Boost" value={`×${multiplier.toFixed(1)}`} highlight />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value, highlight }: { icon: string; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xl">{icon}</span>
      <span className={`text-sm font-bold tabular-nums ${highlight ? "text-[#fe2c55]" : "text-white"}`}>{value}</span>
      <span className="text-white/40 text-xs">{label}</span>
    </div>
  );
}
