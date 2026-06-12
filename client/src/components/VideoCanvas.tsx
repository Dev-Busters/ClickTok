import { useMemo } from "react";
import { motion } from "framer-motion";

// FNV-1a hash → 32-bit uint for seeding the PRNG
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h;
}

// mulberry32 PRNG seeded from a string
function mkRng(seed: string) {
  let s = hashStr(seed);
  return (): number => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// CRT palette: --red, --cyan, off-white, gold-ish
const PALETTE = ["#ff1f4b", "#25f4ee", "#e8e4d8", "#c9a84c"] as const;

type BlobDef = {
  color: string;
  size: number;
  left: number;  // px offset from seed (placed via left: calc)
  top: number;
  driftX: number;
  driftY: number;
  period: number;
  opacity: number;
};

type LineDef = {
  cx: number;  // % of container
  cy: number;
  angle: number;
  length: number;
  color: string;
};

function buildScene(rand: () => number) {
  const blobs: BlobDef[] = Array.from({ length: 3 }, () => {
    const size = 90 + rand() * 200;
    return {
      color:   PALETTE[Math.floor(rand() * PALETTE.length)],
      size,
      left:    10 + rand() * 80,   // % of container
      top:     5  + rand() * 85,
      driftX:  (rand() - 0.5) * 70,
      driftY:  (rand() - 0.5) * 70,
      period:  5 + rand() * 9,
      opacity: 0.25 + rand() * 0.20,
    };
  });

  const lines: LineDef[] = Array.from({ length: 2 }, () => ({
    cx:     15 + rand() * 70,
    cy:     15 + rand() * 70,
    angle:  rand() * 180,
    length: 80 + rand() * 140,
    color:  PALETTE[Math.floor(rand() * PALETTE.length)],
  }));

  return { blobs, lines };
}

/**
 * Procedural "video" visual: deterministic from `seed` + `topic`.
 * - `intensity` 0–1 scales animation speed and brightness.
 * - `dim` adds a dark scrim (for use as Live stage backdrop).
 */
export function VideoCanvas({
  seed,
  topic,
  intensity = 1,
  dim = false,
}: {
  seed: string;
  topic: string;
  intensity?: number;
  dim?: boolean;
}) {
  const { blobs, lines } = useMemo(
    () => buildScene(mkRng(`${seed}\x00${topic}`)),
    [seed, topic],
  );

  const speed = Math.max(0.15, intensity);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "var(--bg)",
        pointerEvents: "none",
      }}
    >
      {/* Layered drifting gradient blobs.
          motion.div handles only the x/y animation; inner div owns background so
          Framer Motion can't intercept the color as an animation target. */}
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          style={{
            position:   "absolute",
            left:       `calc(${b.left}% - ${b.size / 2}px)`,
            top:        `calc(${b.top}% - ${b.size / 2}px)`,
            willChange: "transform",
          }}
          animate={{ x: [0, b.driftX * intensity, 0], y: [0, b.driftY * intensity, 0] }}
          transition={{
            duration:   b.period / speed,
            repeat:     Infinity,
            repeatType: "mirror",
            ease:       "easeInOut",
            delay:      i * 1.2,
          }}
        >
          <div style={{
            width:        b.size,
            height:       b.size,
            borderRadius: "50%",
            backgroundColor: b.color,
            filter:       `blur(${Math.round(b.size * 0.28)}px)`,
            opacity:      b.opacity * (0.5 + intensity * 0.5),
            mixBlendMode: "screen" as const,
          }} />
        </motion.div>
      ))}

      {/* Thin geometric lines — CRT-style accents */}
      {lines.map((l, i) => (
        <div
          key={`ln${i}`}
          style={{
            position:        "absolute",
            left:            `${l.cx}%`,
            top:             `${l.cy}%`,
            width:           l.length,
            height:          1,
            background:      l.color,
            opacity:         0.10 * (0.4 + intensity * 0.6),
            transform:       `translate(-50%, -50%) rotate(${l.angle}deg)`,
            transformOrigin: "center",
          }}
        />
      ))}

      {/* Big faint topic name */}
      <div
        style={{
          position:       "absolute",
          inset:          0,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily:    "var(--font-display)",
            fontSize:      "clamp(44px, 13vw, 76px)",
            color:         "rgba(255,255,255,0.05)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            userSelect:    "none",
            whiteSpace:    "nowrap",
          }}
        >
          #{topic}
        </span>
      </div>

      {/* Dark scrim for Live stage backdrop */}
      {dim && (
        <div
          style={{
            position:   "absolute",
            inset:      0,
            background: "rgba(0,0,0,0.55)",
          }}
        />
      )}
    </div>
  );
}
