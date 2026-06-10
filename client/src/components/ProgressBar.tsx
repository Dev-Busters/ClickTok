export function ProgressBar({
  value,
  max = 100,
  color,
  label,
}: {
  value: number;
  max?: number;
  color: string;
  label?: string;
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
          transition: 'width 0.1s linear, background 0.3s ease',
        }} />
      </div>
    </div>
  );
}
