import { useEffect, useRef, useState } from "react";

// TikTok LIVE-style ambient hearts rising from the bottom-right.
// Spawn rate scales with hype: a dead stream barely flickers, a hyped one pours.
const HEART_COLORS = ["#ff1f4b", "#ff5e7e", "#ff8da8", "#e8e4d8", "#25f4ee"];
const MAX_HEARTS = 18;

type Heart = { id: number; x: number; drift: number; bloom: number; color: string; size: number };

let nextHeartId = 0;

export function HeartRain({ hype }: { hype: number }) {
  const [hearts, setHearts] = useState<Heart[]>([]);
  const hypeRef = useRef(hype);
  hypeRef.current = hype;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const spawn = () => {
      setHearts(prev => [
        ...prev.slice(-(MAX_HEARTS - 1)),
        {
          id: nextHeartId++,
          x: Math.random() * 40 - 8,
          drift: Math.random() * 36 - 18,
          bloom: 0.9 + Math.random() * 0.5,
          color: HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)],
          size: 14 + Math.random() * 10,
        },
      ]);
      // hype 0 → every ~1400ms, hype 100 → every ~220ms (with jitter)
      const delay = 1400 - (hypeRef.current / 100) * 1180 + Math.random() * 160;
      timer = setTimeout(spawn, delay);
    };
    timer = setTimeout(spawn, 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ position: "absolute", right: "18px", bottom: "120px", width: "48px", height: "360px", pointerEvents: "none" }}>
      {hearts.map(h => (
        <span
          key={h.id}
          onAnimationEnd={() => setHearts(prev => prev.filter(p => p.id !== h.id))}
          style={{
            position: "absolute",
            bottom: 0,
            left: `${h.x}px`,
            fontSize: `${h.size}px`,
            color: h.color,
            // @ts-expect-error CSS custom properties drive the keyframe
            "--drift": `${h.drift}px`,
            "--bloom": h.bloom,
            animation: "heart-float 2.6s ease-out forwards",
            filter: `drop-shadow(0 0 6px ${h.color}66)`,
          }}
        >
          {/* Filled heart as SVG so color is controllable */}
          <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </span>
      ))}
    </div>
  );
}
