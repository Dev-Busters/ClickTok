import { useState } from "react";
import { motion } from "framer-motion";
import { useGameStore } from "../store/gameStore";

export function OnboardingScreen() {
  const [input, setInput] = useState("");
  const setHandle = useGameStore(s => s.setHandle);

  const submit = () => {
    const clean = input.trim().replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
    if (clean.length < 2) return;
    setHandle(clean);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-8 px-6">
      {/* TikTok-style wordmark */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-2"
      >
        <div className="text-5xl font-black tracking-tight">
          <span className="text-white">Click</span>
          <span className="text-[#fe2c55]">Tok</span>
        </div>
        <p className="text-white/50 text-sm">Become the most viral creator on the internet.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex flex-col items-center gap-4 w-full max-w-xs"
      >
        <div className="w-full relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold">@</span>
          <input
            autoFocus
            className="w-full bg-white/10 border border-white/20 rounded-2xl py-3 pl-8 pr-4 text-white placeholder:text-white/30 font-bold focus:outline-none focus:border-[#fe2c55] transition-colors"
            placeholder="your_handle"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            maxLength={20}
          />
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={submit}
          className="w-full bg-[#fe2c55] text-white font-black rounded-2xl py-3 text-base tracking-wide shadow-[0_0_24px_rgba(254,44,85,0.4)] hover:bg-[#e0243c] transition-colors"
        >
          Start Your Channel
        </motion.button>
      </motion.div>
    </div>
  );
}
