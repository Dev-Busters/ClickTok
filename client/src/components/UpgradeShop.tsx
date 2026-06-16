import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "../store";
import { formatCount } from "../lib/format";
import { UPGRADE_CATALOG } from "../features/upgrades/catalog";
import type { UpgradeDef, UpgradePillar } from "../features/upgrades/types";
import { isFeatureUnlocked } from "../features/metrics/unlocks";
import { effectStatKind, computeStatFlash, type StatFlash } from "../features/economy/statFeedback";
import { pushCelebration } from "./fx/CelebrationLayer";

function requirementLabel(def: UpgradeDef): string | null {
  const req = def.requires;
  if (!req) return null;
  const parts: string[] = [];
  if (req.followers !== undefined) {
    parts.push(`${formatCount(req.followers)} followers`);
  }
  if (req.upgrades) {
    for (const id of req.upgrades) {
      const reqDef = UPGRADE_CATALOG.find(u => u.id === id);
      parts.push(reqDef ? reqDef.name : id);
    }
  }
  return parts.join(", ");
}

export function UpgradeShop({ pillar }: { pillar?: UpgradePillar } = {}) {
  const metricsReached = useGameStore(s => s.metricsReached);
  const upgradesUnlocked = isFeatureUnlocked("upgrades", metricsReached);

  return (
    <div style={{ width: '100%', maxWidth: '384px', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <RepeatableSection pillar={pillar} />
      {upgradesUnlocked && <UpgradeCategorySection category="gear" title="GEAR" pillar={pillar} />}
      {upgradesUnlocked && <UpgradeCategorySection category="software" title="SOFTWARE" pillar={pillar} />}
    </div>
  );
}

// ── Repeatable / leveled upgrades ─────────────────────────────────────────────

function RepeatableSection({ pillar }: { pillar?: UpgradePillar }) {
  const items = UPGRADE_CATALOG.filter(u => u.repeatable && (!pillar || u.pillar === pillar));

  if (items.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--cyan)', letterSpacing: '0.2em' }}>
          LEVEL UP
        </span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(37,244,238,0.15)' }} />
      </div>

      {items.map(def => (
        <RepeatableRow key={def.id} def={def} />
      ))}
    </div>
  );
}

function RepeatableRow({ def }: { def: UpgradeDef }) {
  const level = useGameStore(s => s.upgradeLevels[def.id] ?? 0);
  const wallet = useGameStore(s => s.wallet);
  const levelUpgrade = useGameStore(s => s.levelUpgrade);
  const upgradeCost = useGameStore(s => s.upgradeCost);
  const pulseStat = useGameStore(s => s.pulseStat);
  const [flash, setFlash] = useState<StatFlash | null>(null);

  const cost = upgradeCost(def.id);
  const isMaxed = def.maxLevel !== undefined && level >= def.maxLevel;
  const canAfford = !isMaxed && wallet.coins >= cost;
  const buyable = canAfford && !isMaxed;

  // 09 §A1–A2: snapshot the 4 derived stats before/after, flash the headline
  // delta on this row + pulse the TEB. No modal — keeps rapid-buy rhythm.
  const handleBuy = () => {
    if (!buyable) return;
    const kind = effectStatKind(def.effect);
    const before = useGameStore.getState();
    const ok = levelUpgrade(def.id);
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
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      width: '100%',
      padding: '13px 14px',
      background: 'rgba(37,244,238,0.03)',
      border: `1px solid ${buyable ? 'rgba(37,244,238,0.12)' : 'rgba(255,255,255,0.03)'}`,
    }}>
      {/* Level badge */}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: '22px',
        color: isMaxed ? 'var(--gold)' : level > 0 ? 'var(--cyan)' : 'var(--dim)',
        lineHeight: 1,
        width: '34px',
        flexShrink: 0,
        textAlign: 'center',
      }}>
        {isMaxed ? '★' : `L${level}`}
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
          {def.name.toUpperCase()}
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
      </div>

      {/* Cost + button */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        {isMaxed ? (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--gold)',
            letterSpacing: '0.18em',
          }}>
            MAXED
          </div>
        ) : (
          <>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              color: canAfford ? 'var(--cyan)' : 'var(--dim)',
              lineHeight: 1,
            }}>
              {formatCount(cost)}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '8px',
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
            <motion.button
              whileTap={buyable ? { scale: 0.95 } : undefined}
              onClick={handleBuy}
              style={{
                marginTop: '2px',
                padding: '4px 10px',
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                letterSpacing: '0.15em',
                color: buyable ? '#000' : 'var(--dim)',
                background: buyable ? 'var(--cyan)' : 'rgba(255,255,255,0.06)',
                border: 'none',
                cursor: buyable ? 'pointer' : 'default',
              }}>
              LEVEL UP
            </motion.button>
          </>
        )}
      </div>
    </div>
  );
}

// ── One-time gear / software ───────────────────────────────────────────────────

function UpgradeCategorySection({ category, title, pillar }: { category: "gear" | "software"; title: string; pillar?: UpgradePillar }) {
  const ownedUpgrades = useGameStore(s => s.ownedUpgrades);
  const wallet = useGameStore(s => s.wallet);
  const isUpgradeUnlocked = useGameStore(s => s.isUpgradeUnlocked);
  const buyUpgrade = useGameStore(s => s.buyUpgrade);

  const items = UPGRADE_CATALOG.filter(u => u.category === category && (!pillar || u.pillar === pillar));

  if (items.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--dim)', letterSpacing: '0.2em' }}>
          {title}
        </span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
      </div>

      {items.map((def, idx) => {
        const owned = !!ownedUpgrades[def.id];
        const unlocked = isUpgradeUnlocked(def.id);
        const cost = def.cost ?? {};
        const canAfford = (Object.entries(cost) as [keyof typeof wallet, number][])
          .every(([currency, amount]) => wallet[currency] >= amount);
        const buyable = unlocked && !owned && canAfford;
        const dimmed = owned || !unlocked;

        // 09 §A3: one-time gear/software buys are "milestone" buys — a small
        // celebration naming the stat/effect, reusing the existing copy.
        const handleBuy = () => {
          if (!buyable) return;
          if (buyUpgrade(def.id)) {
            pushCelebration({
              icon: category === "gear" ? "🎥" : "💾",
              label: `${def.name.toUpperCase()} EQUIPPED`,
              sublabel: category === "gear" ? "NEW GEAR" : "NEW SOFTWARE",
              detail: def.description,
              color: "var(--cyan)",
            });
          }
        };

        return (
          <motion.button
            key={def.id}
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
                color: 'var(--dim)',
                letterSpacing: '0.04em',
              }}>
                {def.description}
              </div>
              {!owned && !unlocked && (
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  color: 'var(--gold)',
                  letterSpacing: '0.08em',
                  marginTop: '2px',
                }}>
                  REQUIRES {requirementLabel(def)?.toUpperCase()}
                </div>
              )}
            </div>

            {/* Cost / owned state */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
              {owned ? (
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '10px',
                  color: 'var(--cyan)',
                  letterSpacing: '0.18em',
                }}>
                  OWNED
                </div>
              ) : (
                <>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '22px',
                    color: canAfford && unlocked ? 'var(--cyan)' : 'var(--dim)',
                    lineHeight: 1,
                  }}>
                    {formatCount(cost.coins ?? 0)}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    color: 'var(--dim)',
                    letterSpacing: '0.1em',
                  }}>
                    COINS
                  </div>
                  {canAfford && unlocked && (
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '8px',
                      color: 'var(--dim)',
                      letterSpacing: '0.04em',
                    }}>
                      after {formatCount(wallet.coins - (cost.coins ?? 0))}
                    </div>
                  )}
                  {cost.diamonds !== undefined && (
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      color: canAfford && unlocked ? 'var(--gold)' : 'var(--dim)',
                      letterSpacing: '0.1em',
                      marginTop: '2px',
                    }}>
                      +{formatCount(cost.diamonds)} 💎
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
