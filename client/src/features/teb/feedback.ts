import type { RhythmJudgementLabel } from "./types";

let context: AudioContext | null = null;

export function playRhythmFeedback(label: RhythmJudgementLabel, muted: boolean, reducedFeedback: boolean): void {
  if (!muted) {
    try {
      context ??= new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = label === "perfect" ? 880 : label === "great" ? 660 : label === "good" ? 440 : 180;
      gain.gain.setValueAtTime(.035, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .07);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(); oscillator.stop(context.currentTime + .075);
    } catch { /* unsupported or gesture policy: silent by design */ }
  }
  if (!reducedFeedback && label === "perfect" && "vibrate" in navigator) navigator.vibrate?.(12);
}

export function chartCompleteFeedback(reducedFeedback: boolean): void {
  if (!reducedFeedback && "vibrate" in navigator) navigator.vibrate?.([12, 24, 18]);
}
