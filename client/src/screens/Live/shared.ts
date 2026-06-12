export function hypeColor(hype: number): string {
  if (hype >= 80) return 'var(--red)';
  if (hype >= 50) return 'var(--gold)';
  return 'var(--cyan)';
}

export function formatTimer(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
