// 11.3: play-field layout for element waves (07 §C0).
// Pod positions are stored in wave state as fractions [0,1] of the stage dimensions,
// so the render matches the grade-check regardless of screen size.

// Reference dimensions used for the minimum-distance overlap check (px).
const REF_W = 390;
const REF_H = 225;   // ElementStage height = 30% × ~750px typical viewport
const MARGIN = 16;   // play-field inset from stage edges (px)

// Seeded PRNG (Mulberry32) — deterministic per wave so render and grading agree.
function seededRand(seed: number): () => number {
  let t = (seed + 0x6D2B79F5) | 0;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

// Pick N non-overlapping pod-center positions within the play-field.
// `seed` is the wave's startedAt ms epoch — same seed → same positions every time.
// Returns { x, y } as fractions of stage dimensions so components can use
// `left: calc(${x*100}% - ${podR}px)` etc. for responsive layout.
export function pickPositions(
  n: number,
  podSize: number,
  seed: number,
): { x: number; y: number }[] {
  const rand = seededRand(seed);
  const r = podSize / 2;

  // Fractional bounds (pod center must be within these)
  const xMin = (r + MARGIN) / REF_W;
  const xMax = 1 - (r + MARGIN) / REF_W;
  const yMin = (r + MARGIN) / REF_H;
  const yMax = 1 - (r + MARGIN) / REF_H;

  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    let attempts = 0;
    let pos: { x: number; y: number };
    do {
      pos = {
        x: xMin + rand() * (xMax - xMin),
        y: yMin + rand() * (yMax - yMin),
      };
      attempts++;
    } while (
      attempts < 100 &&
      positions.some(p => {
        const dx = (p.x - pos.x) * REF_W;
        const dy = (p.y - pos.y) * REF_H;
        return Math.sqrt(dx * dx + dy * dy) < podSize + 6;
      })
    );
    positions.push(pos);
  }
  return positions;
}
