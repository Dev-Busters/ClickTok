/**
 * Input-shape signals used to distinguish human tapping from automation.
 *
 * IMPORTANT — what this is and is not:
 *  - This is *evidence collection*, not enforcement. Nothing here blocks a player.
 *    Client-side enforcement is pointless: anyone can patch it out, and false positives
 *    would punish legitimate players (accessibility hardware, styluses, trackpads).
 *  - Enforcement belongs server-side, on top of plausibility checks that don't care
 *    *how* the client cheated. See `docs/15-integrity-and-anticheat.md`.
 *  - These signals exist so the server (and PostHog) can see whether automation is
 *    actually happening, and so a future server-side score can weigh input shape as one
 *    input among several — never as a sole ban criterion.
 *
 * The tells, and why they work:
 *  - Interval CV: humans vary tap spacing a lot (CV typically > 0.15). A macro firing
 *    every 100ms has CV ≈ 0. Very low CV over many taps is hard to produce by hand.
 *  - Position jitter: humans never hit the same pixel twice. A synthetic click usually
 *    reports an identical coordinate every time.
 *  - Sustained duration: humans micro-pause. Hundreds of taps with no gap > 1s is odd.
 */

export type TapSample = { at: number; x: number; y: number };

export type IntegritySignals = {
  sampleCount: number;
  medianIntervalMs: number;
  /** Coefficient of variation of inter-tap intervals. ~0 ⇒ metronomic. */
  intervalCv: number;
  /** Mean pixel distance from the centroid of tap positions. 0 ⇒ identical coords. */
  positionJitterPx: number;
  /** Longest run of taps with no gap above `restGapMs`. */
  longestUnbrokenRun: number;
  /** 0..1 heuristic. Advisory only — never an automatic penalty. */
  suspicion: number;
};

export const MAX_SAMPLES = 120;
const REST_GAP_MS = 1000;

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeIntegritySignals(samples: readonly TapSample[]): IntegritySignals {
  const empty: IntegritySignals = {
    sampleCount: samples.length, medianIntervalMs: 0, intervalCv: 1,
    positionJitterPx: 0, longestUnbrokenRun: samples.length, suspicion: 0,
  };
  // Too few taps to say anything. Reporting "suspicious" here would be noise.
  if (samples.length < 12) return empty;

  const intervals: number[] = [];
  for (let i = 1; i < samples.length; i++) intervals.push(samples[i].at - samples[i - 1].at);

  const mean = intervals.reduce((sum, v) => sum + v, 0) / intervals.length;
  const variance = intervals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / intervals.length;
  const intervalCv = mean > 0 ? Math.sqrt(variance) / mean : 1;

  const cx = samples.reduce((sum, s) => sum + s.x, 0) / samples.length;
  const cy = samples.reduce((sum, s) => sum + s.y, 0) / samples.length;
  const positionJitterPx = samples.reduce((sum, s) => sum + Math.hypot(s.x - cx, s.y - cy), 0) / samples.length;

  let run = 1, longestUnbrokenRun = 1;
  for (const gap of intervals) {
    if (gap <= REST_GAP_MS) { run++; longestUnbrokenRun = Math.max(longestUnbrokenRun, run); }
    else run = 1;
  }

  // Each term is 0 when clearly human and approaches 1 as the input looks synthetic.
  // Weighted so no single term can convict on its own.
  const cvTerm = Math.max(0, 1 - intervalCv / 0.18);
  const jitterTerm = Math.max(0, 1 - positionJitterPx / 6);
  const runTerm = Math.min(1, Math.max(0, (longestUnbrokenRun - 120) / 380));
  const suspicion = Math.min(1, cvTerm * 0.5 + jitterTerm * 0.3 + runTerm * 0.2);

  return {
    sampleCount: samples.length,
    medianIntervalMs: median(intervals),
    intervalCv,
    positionJitterPx,
    longestUnbrokenRun,
    suspicion,
  };
}

/** Ring-buffer push, keeping the most recent `MAX_SAMPLES`. */
export function pushSample(samples: readonly TapSample[], sample: TapSample): TapSample[] {
  const next = samples.length >= MAX_SAMPLES ? samples.slice(samples.length - MAX_SAMPLES + 1) : samples.slice();
  next.push(sample);
  return next;
}
