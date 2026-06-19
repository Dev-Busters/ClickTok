import { useEffect, useState } from "react";

export function RhythmPerfOverlay() {
  const enabled = import.meta.env.DEV && new URLSearchParams(location.search).has("rhythmPerf");
  const [stats, setStats] = useState({ p95: 0, nodes: 0 });
  useEffect(() => {
    if (!enabled) return;
    const frames: number[] = [];
    let last = performance.now(), raf = 0, timer = 0;
    const frame = (now: number) => { frames.push(now - last); last = now; if (frames.length > 180) frames.shift(); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
    timer = window.setInterval(() => {
      const sorted = [...frames].sort((a, b) => a - b);
      setStats({ p95: sorted[Math.floor(sorted.length * .95)] ?? 0, nodes: document.querySelectorAll("[data-rhythm-node]").length });
    }, 500);
    return () => { cancelAnimationFrame(raf); clearInterval(timer); };
  }, [enabled]);
  if (!enabled) return null;
  return <output style={{ position: "absolute", left: 8, bottom: 8, zIndex: 9, padding: "3px 6px", background: "#000b", color: stats.p95 > 20 ? "var(--red)" : "var(--cyan)", font: "9px var(--font-mono)", pointerEvents: "none" }}>p95 {stats.p95.toFixed(1)}ms · DOM {stats.nodes}</output>;
}
