import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../store";
import { formatCount } from "../lib/format";
import { SKILL_CATALOG, SKILL_PILLAR } from "../features/skills/catalog";
import type { UpgradePillar } from "../features/upgrades/types";
import type { SkillId } from "../features/skills/types";
import { computeStatFlash, type StatFlash, type StatKind } from "../features/economy/statFeedback";

// 09 §A2: only charisma/editing move one of the 4 channel stats — the other
// 3 skills are run-stat-only (covered by 09 §B/§C instead), so no inline flash.
const SKILL_STAT_KIND: Partial<Record<SkillId, StatKind>> = {
  charisma: "postPower",
  editing: "followerConversion",
};

export function SkillsPanel({ pillar }: { pillar?: UpgradePillar } = {}) {
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

      {visibleSkills.map((def, idx) => (
        <SkillRow key={def.id} def={def} idx={idx} />
      ))}
    </div>
  );
}

function SkillRow({ def, idx }: { def: typeof SKILL_CATALOG[number]; idx: number }) {
  const skillLevels = useGameStore(s => s.skillLevels);
  const wallet = useGameStore(s => s.wallet);
  const skillCost = useGameStore(s => s.skillCost);
  const levelSkill = useGameStore(s => s.levelSkill);
  const pulseStat = useGameStore(s => s.pulseStat);
  const [flash, setFlash] = useState<StatFlash | null>(null);

  const level = skillLevels[def.id];
  const maxed = level >= def.maxLevel;
  const locked = !maxed && def.requires?.followers !== undefined && wallet.followers < def.requires.followers;
  const cost = skillCost(def.id);
  const canAfford = !maxed && !locked && wallet.coins >= cost;
  const buyable = canAfford;
  const dimmed = maxed || locked;

  // 09 §A1–A2: same before/after snapshot pattern as RepeatableRow.
  const handleBuy = () => {
    if (!buyable) return;
    const kind = SKILL_STAT_KIND[def.id];
    const before = useGameStore.getState();
    const ok = levelSkill(def.id);
    if (ok && kind) {
      const after = useGameStore.getState();
      const delta = computeStatFlash(kind, before, after);
      if (delta) {
        setFlash(delta);
        pulseStat();
        setTimeout(() => setFlash(null), 1500);
      }
    }
  };

  return (
          <motion.button
            whileTap={buyable ? { scale: 0.985 } : undefined}
            onClick={handleBuy}
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
              <AnimatePresence>
                {flash && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      letterSpacing: '0.04em',
                      color: 'var(--cyan)',
                      marginTop: '2px',
                    }}
                  >
                    {flash.label} {formatCount(flash.before)} → {formatCount(flash.after)}{' '}
                    <span style={{ color: 'var(--gold)' }}>+{Math.round(flash.pct)}% 🔥</span>
                  </motion.div>
                )}
              </AnimatePresence>
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
                  {canAfford && (
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '8px',
                      color: 'var(--dim)',
                      letterSpacing: '0.04em',
                    }}>
                      after {formatCount(wallet.coins - cost)}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.button>
  );
}
