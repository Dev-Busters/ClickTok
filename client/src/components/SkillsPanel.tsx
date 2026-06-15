import { motion } from "framer-motion";
import { useGameStore } from "../store";
import { formatCount } from "../lib/format";
import { SKILL_CATALOG, SKILL_PILLAR } from "../features/skills/catalog";
import type { UpgradePillar } from "../features/upgrades/types";

export function SkillsPanel({ pillar }: { pillar?: UpgradePillar } = {}) {
  const skillLevels = useGameStore(s => s.skillLevels);
  const wallet = useGameStore(s => s.wallet);
  const skillCost = useGameStore(s => s.skillCost);
  const levelSkill = useGameStore(s => s.levelSkill);

  const visibleSkills = pillar
    ? SKILL_CATALOG.filter(def => SKILL_PILLAR[def.id] === pillar)
    : SKILL_CATALOG;

  if (visibleSkills.length === 0) return null;

  return (
    <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)', letterSpacing: '0.2em' }}>
          SKILLS
        </span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
      </div>

      {visibleSkills.map((def, idx) => {
        const level = skillLevels[def.id];
        const maxed = level >= def.maxLevel;
        const locked = !maxed && def.requires?.followers !== undefined && wallet.followers < def.requires.followers;
        const cost = skillCost(def.id);
        const canAfford = !maxed && !locked && wallet.coins >= cost;
        const buyable = canAfford;
        const dimmed = maxed || locked;

        return (
          <motion.button
            key={def.id}
            whileTap={buyable ? { scale: 0.985 } : undefined}
            onClick={() => buyable && levelSkill(def.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              width: '100%',
              textAlign: 'left',
              padding: '13px 14px',
              background: buyable ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.015)',
              border: `1px solid ${buyable ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.03)'}`,
              cursor: buyable ? 'pointer' : 'default',
              opacity: dimmed ? 0.4 : 1,
            }}
          >
            {/* Index */}
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '30px',
              color: buyable ? 'var(--red)' : 'var(--dim)',
              lineHeight: 1,
              width: '34px',
              flexShrink: 0,
            }}>
              {String(idx + 1).padStart(2, '0')}
            </div>

            {/* Name + description */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '8px',
              }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '19px',
                  color: 'var(--text)',
                  lineHeight: 1,
                  letterSpacing: '0.03em',
                }}>
                  {def.name.toUpperCase()}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--cyan)',
                  letterSpacing: '0.1em',
                }}>
                  LV {level}/{def.maxLevel}
                </div>
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                color: 'var(--dim)',
                letterSpacing: '0.04em',
              }}>
                {def.description}
              </div>
              {locked && (
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  color: 'var(--gold)',
                  letterSpacing: '0.08em',
                  marginTop: '2px',
                }}>
                  REQUIRES {formatCount(def.requires!.followers!).toUpperCase()} FOLLOWERS
                </div>
              )}
            </div>

            {/* Cost / maxed state */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
              {maxed ? (
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--cyan)',
                  letterSpacing: '0.18em',
                }}>
                  MAXED
                </div>
              ) : (
                <>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '22px',
                    color: canAfford ? 'var(--cyan)' : 'var(--dim)',
                    lineHeight: 1,
                  }}>
                    {formatCount(cost)}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    color: 'var(--dim)',
                    letterSpacing: '0.1em',
                  }}>
                    COINS
                  </div>
                </>
              )}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
