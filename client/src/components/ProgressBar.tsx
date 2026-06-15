// 10.5: cohesive CRT/arcade meter — glowing fill + scanline texture + optional
// tick segments, shared by hype meters (Live) and heat meters (Discover).
export function ProgressBar({
  value,
  max = 100,
  color,
  label,
  segments,
}: {
  value: number;
  max?: number;
  color: string;
  label?: string;
  segments?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          color: 'var(--dim)',
          letterSpacing: '0.22em',
          marginBottom: '4px',
        }}>
          {label}
        </div>
      )}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '8px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          boxShadow: pct > 0 ? `0 0 8px ${color}, 0 0 2px ${color}` : 'none',
          transition: 'width 0.1s linear, background 0.3s ease, box-shadow 0.3s ease',
        }} />
        {/* CRT scanline texture across the whole track */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'repeating-linear-gradient(90deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 4px)',
          pointerEvents: 'none',
        }} />
        {/* Tick segment dividers */}
        {segments && segments > 1 && Array.from({ length: segments - 1 }, (_, i) => (
          <div key={i} style={{
            position: 'absolute', top: 0, bottom: 0,
            left: `${((i + 1) / segments) * 100}%`,
            width: '1px',
            background: 'rgba(0,0,0,0.4)',
          }} />
        ))}
      </div>
    </div>
  );
}
