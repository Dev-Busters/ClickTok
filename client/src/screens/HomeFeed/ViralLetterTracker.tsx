import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BALANCE } from "../../features/economy/balance";
import { areViralLettersAvailable, VIRAL_LETTERS } from "../../features/onboarding/bubbles";
import { useGameStore } from "../../store";

/**
 * The V·I·R·A·L progress readout. Without it the letter set is invisible state — the
 * player would have to remember which letters they'd already grabbed while chasing the
 * next one, which is memory work, not reaction work.
 *
 * Hidden until the set unlocks (`reach_700`) and while VIRAL is already running, since
 * the banner owns the screen then.
 */
export function ViralLetterTracker() {
  const completed = useGameStore(s => s.completedOnboardingGoals);
  const collected = useGameStore(s => s.openingViralLetters);
  const setExpiresAt = useGameStore(s => s.openingLetterSetExpiresAt);
  const viralUntil = useGameStore(s => s.openingViralUntil);
  const reveal = useGameStore(s => s.activeOnboardingReveal);
  const reduced = useReducedMotion();

  // An open reveal card owns the top-right of the screen and already spells the
  // mechanic out — don't stack the tracker under it.
  if (!areViralLettersAvailable(completed) || viralUntil > Date.now()) return null;
  if (reveal && !reveal.dismissed) return null;
  const setLive = setExpiresAt > 0;

  return (
    <div
      data-viral-tracker
      style={{
        position: "absolute", left: "50%", top: 140, transform: "translateX(-50%)", zIndex: 8,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", gap: 6 }}>
        {VIRAL_LETTERS.map(letter => {
          const has = collected.includes(letter);
          return (
            <motion.span
              key={letter}
              animate={has && !reduced ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ duration: .3, ease: "easeOut" }}
              style={{
                width: 22, height: 22, borderRadius: 6,
                display: "grid", placeItems: "center",
                fontFamily: "var(--font-display)", fontSize: 14, lineHeight: 1,
                background: has ? "rgba(245,166,35,.2)" : "rgba(0,0,0,.42)",
                border: `1px solid ${has ? "var(--gold)" : "rgba(255,255,255,.16)"}`,
                color: has ? "var(--gold)" : "rgba(255,255,255,.3)",
                textShadow: has ? "0 0 10px var(--gold)" : "none",
                boxShadow: has ? "0 0 12px rgba(255,210,0,.4)" : "none",
                transition: "background .2s, border-color .2s, color .2s",
              }}
            >{letter}</motion.span>
          );
        })}
      </div>

      {/* Set countdown — the whole reason the word is a challenge and not a formality. */}
      <AnimatePresence>
        {setLive && (
          <motion.div
            key={setExpiresAt}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ width: 140, height: 3, borderRadius: 2, background: "rgba(255,255,255,.14)", overflow: "hidden" }}
          >
            <motion.div
              initial={{ width: `${Math.max(0, Math.min(1, (setExpiresAt - Date.now()) / BALANCE.onboarding.viralLetters.setWindowMs)) * 100}%` }}
              animate={{ width: "0%" }}
              transition={{ duration: Math.max(0, (setExpiresAt - Date.now()) / 1000), ease: "linear" }}
              style={{ height: "100%", background: "var(--gold)" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
