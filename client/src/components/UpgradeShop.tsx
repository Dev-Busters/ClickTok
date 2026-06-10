import { motion } from "framer-motion";
import { useGameStore, type UpgradeId } from "../store/gameStore";
import { formatCount } from "../lib/format";

export function UpgradeShop() {
  const upgrades = useGameStore(s => s.upgrades);
  const followers = useGameStore(s => s.followers);
  const buyUpgrade = useGameStore(s => s.buyUpgrade);

  const available = upgrades.filter(u => !u.purchased);

  if (available.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '32px 0',
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        color: 'var(--dim)',
        letterSpacing: '0.12em',
      }}>
        ALL UPGRADES ACQUIRED — YOU ARE THE ALGORITHM
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)', letterSpacing: '0.2em' }}>
          UPGRADE CATALOG
        </span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)' }}>
          {available.length}
        </span>
      </div>

      {available.map((u, idx) => {
        const canAfford = followers >= u.cost;
        return (
          <motion.button
            key={u.id}
            whileTap={{ scale: 0.985 }}
            onClick={() => canAfford && buyUpgrade(u.id as UpgradeId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              width: '100%',
              textAlign: 'left',
              padding: '13px 14px',
              background: canAfford ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)',
              border: `1px solid ${canAfford ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.03)'}`,
              cursor: canAfford ? 'pointer' : 'not-allowed',
              opacity: canAfford ? 1 : 0.4,
            }}
          >
            {/* Index */}
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '30px',
              color: canAfford ? 'var(--red)' : 'var(--dim)',
              lineHeight: 1,
              width: '34px',
              flexShrink: 0,
            }}>
              {String(idx + 1).padStart(2, '0')}
            </div>

            {/* Name + description */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '19px',
                color: 'var(--text)',
                lineHeight: 1,
                letterSpacing: '0.03em',
              }}>
                {u.name.toUpperCase()}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--dim)',
                letterSpacing: '0.04em',
              }}>
                {u.description}
              </div>
            </div>

            {/* Cost */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '22px',
                color: canAfford ? 'var(--cyan)' : 'var(--dim)',
                lineHeight: 1,
              }}>
                {formatCount(u.cost)}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                color: 'var(--dim)',
                letterSpacing: '0.1em',
              }}>
                FOLLOWERS
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
