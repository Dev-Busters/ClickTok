import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BALANCE } from "../../features/economy/balance";
import { VIRAL_LETTERS } from "../../features/onboarding/bubbles";
import { useGameStore } from "../../store";

/**
 * The V·I·R·A·L chain readout.
 *
 * **Only on screen while a chain is actually running** — i.e. from the first letter
 * caught until the word completes or the chain goes cold. Screen real estate in the
 * opening is scarce, and a permanent five-slot row of mostly-empty boxes was pure chrome
 * (playtest 2026-07-25). Its appearance is now itself the feedback that a chain started.
 */
export function ViralLetterTracker() {
  const collected = useGameStore(s => s.openingViralLetters);
  const setExpiresAt = useGameStore(s => s.openingLetterSetExpiresAt);
  const reduced = useReducedMotion();

  const active = collected.length > 0 && setExpiresAt > 0;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          data-viral-tracker
          initial={{ opacity: 0, y: -6, scale: .92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: .92 }}
          transition={{ type: "spring", stiffness: 420, damping: 26 }}
          style={{
            // `translate`, not `transform: translateX(-50%)` — Framer writes the element's
            // `transform` for the y/scale animation and would clobber the centring.
            position: "absolute", left: "50%", top: 138, translate: "-50% 0", zIndex: 8,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
            pointerEvents: "none",
          }}
        >
          <div style={{ display: "flex", gap: 6 }}>
            {VIRAL_LETTERS.map((letter, index) => {
              const has = index < collected.length;
              const isNext = index === collected.length;
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
                    // The next letter is outlined so the player knows what to hunt for —
                    // letters only ever arrive in order.
                    border: `1px solid ${has ? "var(--gold)" : isNext ? "rgba(255,210,0,.5)" : "rgba(255,255,255,.14)"}`,
                    color: has ? "var(--gold)" : isNext ? "rgba(255,210,0,.75)" : "rgba(255,255,255,.26)",
                    textShadow: has ? "0 0 10px var(--gold)" : "none",
                    boxShadow: has ? "0 0 12px rgba(255,210,0,.4)" : "none",
                    transition: "background .2s, border-color .2s, color .2s",
                  }}
                >{letter}</motion.span>
              );
            })}
          </div>

          {/* Countdown to the NEXT letter — refreshes on every catch. */}
          <motion.div
            key={setExpiresAt}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ width: 140, height: 3, borderRadius: 2, background: "rgba(255,255,255,.14)", overflow: "hidden" }}
          >
            <motion.div
              initial={{ width: `${Math.max(0, Math.min(1, (setExpiresAt - Date.now()) / BALANCE.onboarding.viralLetters.letterWindowMs)) * 100}%` }}
              animate={{ width: "0%" }}
              transition={{ duration: Math.max(0, (setExpiresAt - Date.now()) / 1000), ease: "linear" }}
              style={{ height: "100%", background: "var(--gold)" }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
