import { useGameStore } from "../store";
import { formatCount } from "../lib/format";

export function CurrencyBar() {
  const wallet = useGameStore(s => s.wallet);

  return (
    <div style={{
      flexShrink: 0,
      display: 'flex', justifyContent: 'center', gap: '8px',
      padding: '10px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <CurrencyPill color="var(--gold)" label="coins" value={formatCount(wallet.coins)} shape="coin" />
      <CurrencyPill color="var(--red)" label="followers" value={formatCount(wallet.followers)} shape="followers" />
      <CurrencyPill color="var(--cyan)" label="diamonds" value={formatCount(wallet.diamonds)} shape="diamond" />
    </div>
  );
}

export function CurrencyPill({ color, label, value, shape }: { color: string; label: string; value: string; shape: "coin" | "diamond" | "followers" }) {
  return (
    <div
      title={label}
      style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 14px', borderRadius: '999px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {shape === "coin" && (
        <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
      )}
      {shape === "diamond" && (
        <span style={{ width: '10px', height: '10px', background: color, boxShadow: `0 0 6px ${color}`, transform: 'rotate(45deg)', flexShrink: 0 }} />
      )}
      {shape === "followers" && (
        <span style={{
          width: 0, height: 0, flexShrink: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderBottom: `9px solid ${color}`,
          filter: `drop-shadow(0 0 4px ${color})`,
        }} />
      )}
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, color }}>
        {value}
      </span>
    </div>
  );
}
