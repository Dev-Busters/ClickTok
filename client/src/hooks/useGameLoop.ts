import { useEffect, useRef } from "react";
import { useGameStore } from "../store/gameStore";

export function useGameLoop() {
  const tick = useGameStore(s => s.tick);
  const lastRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const loop = (now: number) => {
      if (lastRef.current) {
        const dt = (now - lastRef.current) / 1000;
        tick(Math.min(dt, 0.1)); // cap delta to avoid spiraling on tab restore
      }
      lastRef.current = now;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);
}
