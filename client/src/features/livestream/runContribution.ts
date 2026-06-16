import { UPGRADE_CATALOG } from "../upgrades/catalog";
import { REACTION_CATALOG } from "./reactions";
import type { RunParamsBreakdown } from "./computeRunParams";

// 13.3 (09 §C1): one short headline per gear/software item that actually moved a
// run stat — skip cosmetics like postPowerAdd (covered by 09 §A, not run feedback).
function runEffectLabel(id: string): string | null {
  const def = UPGRADE_CATALOG.find(u => u.id === id);
  if (!def) return null;
  const e = def.effect;
  const parts: string[] = [];
  if (e.runStartViewersAdd) parts.push(`+${e.runStartViewersAdd} starting viewers`);
  if (e.runStartViewersMult) parts.push(`×${e.runStartViewersMult} starting viewers`);
  if (e.runGiftRateMult) parts.push(`×${e.runGiftRateMult} gift rate`);
  if (e.runTrollResistAdd) parts.push(`+${Math.round(e.runTrollResistAdd * 100)}% troll resistance`);
  if (e.unlocksReaction) parts.push(`unlocks ${REACTION_CATALOG[e.unlocksReaction].name}`);
  return parts.length > 0 ? parts.join(", ") : null;
}

export type ContributionItem = { name: string; effect: string };

// Active gear/software (owned, with a run effect) + skills that move a run
// stat (charisma/monetization/stagecraft) — read straight off the breakdown
// so the % figures can't drift from what computeRunParams actually used.
export function buildContributions(
  ownedUpgrades: Record<string, boolean>,
  skillLevels: { charisma: number; monetization: number; stagecraft: number },
  breakdown: RunParamsBreakdown,
): ContributionItem[] {
  const items: ContributionItem[] = [];

  for (const def of UPGRADE_CATALOG) {
    if (!ownedUpgrades[def.id]) continue;
    const effect = runEffectLabel(def.id);
    if (effect) items.push({ name: def.name, effect });
  }

  if (skillLevels.charisma > 0) {
    items.push({ name: `Charisma L${skillLevels.charisma}`, effect: `×${breakdown.viewers.charismaMult.toFixed(2)} starting viewers` });
  }
  if (skillLevels.monetization > 0) {
    items.push({ name: `Monetization L${skillLevels.monetization}`, effect: `×${breakdown.giftRate.monetizationMult.toFixed(2)} gift rate` });
  }
  if (skillLevels.stagecraft > 0) {
    items.push({ name: `Stagecraft L${skillLevels.stagecraft}`, effect: `−${Math.round(breakdown.hypeDecay.stagecraftReduction * 100)}% hype decay` });
  }

  return items;
}
