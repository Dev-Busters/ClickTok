// Deterministic hash → hue, so the same handle always gets the same avatar color.
export function handleHue(handle: string): number {
  let hash = 0;
  for (let i = 0; i < handle.length; i++) {
    hash = (hash * 31 + handle.charCodeAt(i)) % 360;
  }
  return hash;
}

export function avatarGradient(handle: string): string {
  const hue = handleHue(handle || "creator");
  return `linear-gradient(135deg, hsl(${hue}, 70%, 45%), hsl(${(hue + 60) % 360}, 70%, 35%))`;
}
