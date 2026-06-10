import { useGameStore } from "../../store";
import { UpgradeShop } from "../../components/UpgradeShop";
import { SkillsPanel } from "../../components/SkillsPanel";

export function Profile() {
  const handle = useGameStore(s => s.handle);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', paddingBottom: '32px' }}>

      {/* Top bar */}
      <div style={{ width: '100%', maxWidth: '384px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px 16px 14px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text)' }}>
          @{handle}
        </span>
      </div>

      {/* Hairline rule */}
      <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', marginBottom: '16px' }}>
        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, var(--dim), transparent)' }} />
      </div>

      <UpgradeShop />

      <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', margin: '20px 0' }}>
        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, var(--dim), transparent)' }} />
      </div>

      <SkillsPanel />
    </div>
  );
}
