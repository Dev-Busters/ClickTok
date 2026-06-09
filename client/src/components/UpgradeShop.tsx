import { motion } from "framer-motion";
import { useGameStore, type UpgradeId } from "../store/gameStore";
import { formatCount } from "../lib/format";

export function UpgradeShop() {
  const upgrades = useGameStore(s => s.upgrades);
  const followers = useGameStore(s => s.followers);
  const buyUpgrade = useGameStore(s => s.buyUpgrade);

  const available = upgrades.filter(u => !u.purchased);

  if (available.length === 0) {
    return (
      <div className="text-white/40 text-sm text-center py-8">
        All upgrades purchased — you are the algorithm. 👑
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm px-4 flex flex-col gap-2">
      <h2 className="text-white/60 text-xs font-bold tracking-widest uppercase mb-1">Upgrades</h2>
      {available.map(u => {
        const canAfford = followers >= u.cost;
        return (
          <motion.button
            key={u.id}
            whileTap={{ scale: 0.97 }}
            onClick={() => canAfford && buyUpgrade(u.id as UpgradeId)}
            className={`flex items-center justify-between rounded-2xl px-4 py-3 border transition-all ${
              canAfford
                ? "bg-white/10 border-white/20 hover:bg-white/15 cursor-pointer"
                : "bg-white/5 border-white/5 opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-white font-bold text-sm">{u.name}</span>
              <span className="text-white/50 text-xs">{u.description}</span>
            </div>
            <div className={`text-sm font-black tabular-nums ml-3 shrink-0 ${canAfford ? "text-[#fe2c55]" : "text-white/30"}`}>
              {formatCount(u.cost)}
              <span className="text-[10px] ml-0.5 opacity-70">👥</span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
