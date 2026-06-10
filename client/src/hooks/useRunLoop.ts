import { useEffect, useRef } from "react";
import { useGameStore } from "../store";

// Fixed 100ms logic step (02 §5) for deterministic-ish run dynamics.
const STEP_SEC = 0.1;
const MAX_FRAME_SEC = 0.5; // avoid spiraling on tab restore

export function useRunLoop() {
  const runTick = useGameStore(s => s.runTick);
  const lastRef = useRef<number>(0);
  const accRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const loop = (now: number) => {
      if (lastRef.current) {
        const dt = Math.min((now - lastRef.current) / 1000, MAX_FRAME_SEC);
        accRef.current += dt;
        while (accRef.current >= STEP_SEC) {
          runTick(STEP_SEC);
          accRef.current -= STEP_SEC;
        }
      }
      lastRef.current = now;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [runTick]);
}
