#!/usr/bin/env npx tsx
// client/scripts/simBalance.ts — headless balance regression harness (task 3.5)
// Usage:  npx tsx client/scripts/simBalance.ts
//
// Imports the REAL balance.ts, computeRunParams, and catalog modules so the sim
// cannot drift from the game. Simulates a plausible player policy and checks the
// 04 §11 targets (a)–(e) at three progression snapshots. Tune balance.ts values
// until all pass; if a target needs a formula change STOP and report it.

import { BALANCE } from "../src/features/economy/balance";
import { computeRunParams } from "../src/features/livestream/computeRunParams";
import { UPGRADE_CATALOG } from "../src/features/upgrades/catalog";
import { SKILL_CATALOG } from "../src/features/skills/catalog";
import type { SkillId } from "../src/features/skills/types";
import type { GiftTier } from "../src/features/livestream/types";

// ─── types ────────────────────────────────────────────────────────────────────

type Skills = Record<SkillId, number>;
type OwnedUpgrades = Record<string, boolean>;
type UpgradeLevels = Record<string, number>;
type Wallet = { coins: number; followers: number; totalFollowers: number; diamonds: number; likes: number };

interface Snapshot {
  label: string;
  wallet: Wallet;
  ownedUpgrades: OwnedUpgrades;
  upgradeLevels: UpgradeLevels;
  skillLevels: Skills;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function zeroSkills(): Skills {
  return { charisma: 0, editing: 0, stagecraft: 0, monetization: 0, network: 0 };
}

function zeroWallet(): Wallet {
  return { coins: 0, followers: 0, totalFollowers: 0, diamonds: 0, likes: 0 };
}

function zeroUpgrades(): OwnedUpgrades {
  return Object.fromEntries(UPGRADE_CATALOG.filter(u => !u.repeatable).map(u => [u.id, false]));
}

function zeroLevels(): UpgradeLevels {
  return {};
}

/** Recompute derived stats from owned upgrades, upgrade levels, and skill levels.
 *  Mirrors channelSlice.recomputeStats exactly (no boon/algo mult — sim is STARVED). */
function recomputeStats(owned: OwnedUpgrades, skills: Skills, levels: UpgradeLevels = {}) {
  let postPowerAdd = 0;
  let passiveCoinsAdd = 0;
  let multiplierMult = 1;
  let followerConversionAdd = 0;

  // One-time gear/software
  for (const def of UPGRADE_CATALOG) {
    if (def.repeatable) continue;
    if (!owned[def.id]) continue;
    const e = def.effect;
    if (e.postPowerAdd) postPowerAdd += e.postPowerAdd;
    if (e.passiveCoinsAdd) passiveCoinsAdd += e.passiveCoinsAdd;
    if (e.multiplierMult) multiplierMult *= e.multiplierMult;
    if (e.followerConversionAdd) followerConversionAdd += e.followerConversionAdd;
  }

  // Repeatable upgrades: effect × level
  for (const def of UPGRADE_CATALOG) {
    if (!def.repeatable) continue;
    const level = levels[def.id] ?? 0;
    if (level === 0) continue;
    const e = def.effect;
    if (e.postPowerAdd) postPowerAdd += e.postPowerAdd * level;
    if (e.passiveCoinsAdd) passiveCoinsAdd += e.passiveCoinsAdd * level;
    if (e.multiplierMult) multiplierMult *= Math.pow(e.multiplierMult, level);
    if (e.followerConversionAdd) followerConversionAdd += e.followerConversionAdd * level;
  }

  const tapPower = BALANCE.basePostPower + postPowerAdd + skills.charisma;
  const multiplier = multiplierMult;
  const followerConversion = 1 + followerConversionAdd + skills.editing * 0.05;
  const passiveCoinsPerSec = passiveCoinsAdd * multiplier;

  return { tapPower, multiplier, followerConversion, passiveCoinsPerSec };
}

/** One post: returns { coins, followers } gained. */
function postGain(owned: OwnedUpgrades, skills: Skills, levels: UpgradeLevels = {}) {
  const { tapPower, multiplier, followerConversion } = recomputeStats(owned, skills, levels);
  return {
    coins: tapPower * BALANCE.postCoinConversion * multiplier,
    followers: tapPower * BALANCE.postFollowerConversion * followerConversion * multiplier,
  };
}

/** Cheapest upgrade the player can afford next, or null. */
function nextAffordable(wallet: Wallet, owned: OwnedUpgrades, skills: Skills, levels: UpgradeLevels = {}): string | null {
  let bestId: string | null = null;
  let bestCost = Infinity;

  for (const def of UPGRADE_CATALOG) {
    if (def.repeatable) {
      // Repeatable: check if affordable at current level
      const level = levels[def.id] ?? 0;
      if (def.maxLevel !== undefined && level >= def.maxLevel) continue;
      const base = def.baseCost?.coins ?? 0;
      const cost = Math.round(base * Math.pow(def.costGrowth ?? 1, level));
      if (wallet.coins >= cost && cost < bestCost) {
        bestCost = cost;
        bestId = def.id;
      }
    } else {
      if (owned[def.id]) continue;
      // Follower gate
      if (def.requires?.followers && wallet.totalFollowers < def.requires.followers) continue;
      // Upgrade prerequisite
      if (def.requires?.upgrades?.some(r => !owned[r])) continue;
      const coinCost = def.cost?.coins ?? 0;
      const diamondCost = def.cost?.diamonds ?? 0;
      if (wallet.coins >= coinCost && wallet.diamonds >= diamondCost && coinCost < bestCost) {
        bestCost = coinCost;
        bestId = def.id;
      }
    }
  }

  // Also consider skills (cheapest affordable next level)
  for (const def of SKILL_CATALOG) {
    if (def.requires?.followers && wallet.totalFollowers < def.requires.followers) continue;
    const currentLevel = skills[def.id];
    if (currentLevel >= def.maxLevel) continue;
    const cost = Math.round(def.baseCost * Math.pow(def.costGrowth, currentLevel));
    if (wallet.coins >= cost && cost < bestCost) {
      bestCost = cost;
      bestId = `skill:${def.id}`;
    }
  }

  return bestId;
}

/** Buy an upgrade or skill level. Mutates wallet, owned, skills, levels. */
function buy(id: string, wallet: Wallet, owned: OwnedUpgrades, skills: Skills, levels: UpgradeLevels = {}): void {
  if (id.startsWith("skill:")) {
    const skillId = id.slice(6) as SkillId;
    const def = SKILL_CATALOG.find(d => d.id === skillId)!;
    const cost = Math.round(def.baseCost * Math.pow(def.costGrowth, skills[skillId]));
    wallet.coins -= cost;
    skills[skillId]++;
  } else {
    const def = UPGRADE_CATALOG.find(d => d.id === id)!;
    if (def.repeatable) {
      const level = levels[id] ?? 0;
      const base = def.baseCost?.coins ?? 0;
      const cost = Math.round(base * Math.pow(def.costGrowth ?? 1, level));
      wallet.coins -= cost;
      levels[id] = level + 1;
    } else {
      wallet.coins -= def.cost?.coins ?? 0;
      wallet.diamonds -= def.cost?.diamonds ?? 0;
      owned[id] = true;
    }
  }
}

// ─── gift quality shift (mirrors rollGiftTier in events.ts) ───────────────────

/** Expected coins per gift at a given giftQuality. */
function expectedCoinPerGift(giftQuality: number): number {
  const base = BALANCE.run.giftWeights;
  const tiers: GiftTier[] = ["rose", "heart", "galaxy", "lion"];
  const w: Record<GiftTier, number> = { ...base };
  for (let i = 0; i < tiers.length - 1; i++) {
    const shift = base[tiers[i]] * giftQuality;
    w[tiers[i]] -= shift;
    w[tiers[i + 1]] += shift;
  }
  const total = (Object.values(w) as number[]).reduce((s, v) => s + v, 0);
  return tiers.reduce((sum, t) => sum + (w[t] / total) * BALANCE.run.giftCoinValue[t], 0);
}

/** Expected diamonds per gift at a given giftQuality. */
function expectedDiamondPerGift(giftQuality: number): number {
  const base = BALANCE.run.giftWeights;
  const tiers: GiftTier[] = ["rose", "heart", "galaxy", "lion"];
  const w: Record<GiftTier, number> = { ...base };
  for (let i = 0; i < tiers.length - 1; i++) {
    const shift = base[tiers[i]] * giftQuality;
    w[tiers[i]] -= shift;
    w[tiers[i + 1]] += shift;
  }
  const total = (Object.values(w) as number[]).reduce((s, v) => s + v, 0);
  return tiers.reduce((sum, t) => sum + (w[t] / total) * BALANCE.run.giftDiamondValue[t], 0);
}

// ─── run analysis (analytical expected values, using real BALANCE/computeRunParams) ──

interface RunStats {
  startViewers: number;
  giftRate: number;
  expectedGifts: number;
  avgCoinPerGift: number;
  avgDiamondPerGift: number;
  giftCoins: number;
  giftDiamonds: number;
  peakViewersTypical: number;
  baseCoins: number;
  totalCoins: number;
  completionDiamonds: number;
  totalDiamonds: number;
  hypeDecayPerSec: number;
}

/** Analyzes expected run output for a given snapshot.
 *  Uses real computeRunParams; reward formula mirrors 04 §10 / runSlice.endRun.
 *  Assumes a "typical C–B grade run": hype averages ~55 (starting 50, modest reaction
 *  use), peakViewers ~1.25× start, finalHype ~60.  Good enough for balance checking. */
function analyzeRun(snap: Snapshot): RunStats {
  const stats = recomputeStats(snap.ownedUpgrades, snap.skillLevels, snap.upgradeLevels);
  const params = computeRunParams(
    {
      followers: snap.wallet.followers,
      followerConversion: stats.followerConversion,
      skillLevels: snap.skillLevels,
      ownedUpgrades: snap.ownedUpgrades,
    },
    "trending",
    0.5, // average trend heat
  );

  // ~C-grade assumptions: avg hype ≈ 55, finalHype ≈ 60, peakViewers ≈ 1.3× start
  const avgHype = 55;
  const finalHype = 60;
  const peakViewersTypical = params.startViewers * 1.3;

  const mon = snap.skillLevels.monetization;
  const valueBonus = 1 + BALANCE.run.monetizationGiftPerLevel * mon;
  const hypeBonus = 1 + avgHype / 100; // avg during run for gift collection

  const expectedGifts = params.giftRate * params.durationSec;
  const avgCoinPerGift = expectedCoinPerGift(params.giftQuality);
  const avgDiamondPerGift = expectedDiamondPerGift(params.giftQuality);

  const giftCoins = expectedGifts * avgCoinPerGift * valueBonus * hypeBonus;
  const giftDiamonds = expectedGifts * avgDiamondPerGift * valueBonus * hypeBonus;

  // § 10: coins = collected.coins + round(base × 0.5)
  const hypeBonus10 = 1 + finalHype * BALANCE.scoring.hypeBonusCoeff;
  const base = peakViewersTypical * hypeBonus10 * params.trendMultiplier;
  const baseCoins = Math.round(base * 0.5);

  const completionDiamonds = BALANCE.scoring.completionDiamondBase;
  const totalCoins = giftCoins + baseCoins;
  const totalDiamonds = giftDiamonds + completionDiamonds;

  return {
    startViewers: params.startViewers,
    giftRate: params.giftRate,
    expectedGifts,
    avgCoinPerGift,
    avgDiamondPerGift,
    giftCoins,
    giftDiamonds,
    peakViewersTypical,
    baseCoins,
    totalCoins,
    completionDiamonds,
    totalDiamonds,
    hypeDecayPerSec: params.hypeDecayPerSec,
  };
}

// ─── snapshots ────────────────────────────────────────────────────────────────

function makeSnapshot(
  label: string,
  followerCount: number,
  upgradeIds: string[],
  skillOverrides: Partial<Skills>,
): Snapshot {
  const ownedUpgrades = zeroUpgrades();
  for (const id of upgradeIds) ownedUpgrades[id] = true;
  const skillLevels = { ...zeroSkills(), ...skillOverrides };
  const wallet = { ...zeroWallet(), followers: followerCount, totalFollowers: followerCount };
  return { label, wallet, ownedUpgrades, upgradeLevels: zeroLevels(), skillLevels };
}

// Fresh: no upgrades, no skills.
const FRESH = makeSnapshot("Fresh (~0 followers)", 0, [], {});

// Mid: ~10k followers. Has ring_light→dslr gear chain, capcut+scheduler software,
// a few early skills. (Realistic state after several runs to 10k.)
const MID = makeSnapshot(
  "Mid (~10k followers)",
  10_000,
  ["ring_light", "usb_mic", "tripod", "phone_gimbal", "dslr", "capcut", "scheduler"],
  { charisma: 4, editing: 3, stagecraft: 2, monetization: 1, network: 0 },
);

// Late: ~1M followers. All gear through studio_lights, all software through algo_hacks,
// high skill levels. (creator_rig / viral_engine are diamond-gated, might not be owned yet.)
const LATE = makeSnapshot(
  "Late (~1M followers)",
  1_000_000,
  ["ring_light", "usb_mic", "tripod", "phone_gimbal", "dslr", "green_screen", "studio_lights",
   "capcut", "scheduler", "hashtag_tool", "analytics_pro", "trend_radar", "algo_hacks"],
  { charisma: 12, editing: 10, stagecraft: 8, monetization: 8, network: 3 },
);

const SNAPSHOTS: Snapshot[] = [FRESH, MID, LATE];

// ─── early-game simulation (for targets a, b, e) ──────────────────────────────

interface EarlySimResult {
  postsForFirstGear: number;          // posts until ring_light affordable
  postsForFirstRepeatable: number;    // posts until first repeatable upgrade affordable (target f)
  activeSecFor200Followers: number;   // active seconds until 200 followers reached
  maxDeadZoneSec: number;             // max active seconds with nothing affordable
  firstLiveFollowers: number;         // follower count when first run becomes viable
}

function simulateEarlyGame(maxActiveSec = 1200): EarlySimResult {
  const wallet = zeroWallet();
  const owned = zeroUpgrades();
  const levels = zeroLevels();
  const skills = zeroSkills();

  let activeSec = 0;
  let postsForFirstGear = -1;
  let postsForFirstRepeatable = -1;
  let activeSecFor200Followers = -1;
  let lastPurchaseSec = 0;
  let maxDeadZoneSec = 0;
  let firstLiveFollowers = -1;

  while (activeSec < maxActiveSec) {
    // One post per active second
    const gain = postGain(owned, skills, levels);
    wallet.coins += gain.coins;
    wallet.followers += gain.followers;
    wallet.totalFollowers += gain.followers;
    activeSec += 1;

    // Check dead-zone: is anything affordable this second?
    const nextBuy = nextAffordable(wallet, owned, skills, levels);
    if (nextBuy === null) {
      maxDeadZoneSec = Math.max(maxDeadZoneSec, activeSec - lastPurchaseSec);
    }

    // Greedy buy: buy cheapest affordable thing each second
    let bought = nextAffordable(wallet, owned, skills, levels);
    while (bought !== null) {
      buy(bought, wallet, owned, skills, levels);
      lastPurchaseSec = activeSec;

      const def = UPGRADE_CATALOG.find(d => d.id === bought);
      if (def?.repeatable && postsForFirstRepeatable === -1) {
        postsForFirstRepeatable = activeSec;
      }
      if (!bought.startsWith("skill:") && !def?.repeatable && postsForFirstGear === -1) {
        postsForFirstGear = activeSec; // first one-time gear purchase
      }

      bought = nextAffordable(wallet, owned, skills, levels);
    }

    // 200-follower milestone
    if (activeSecFor200Followers === -1 && wallet.followers >= 200) {
      activeSecFor200Followers = activeSec;
      firstLiveFollowers = Math.floor(wallet.followers);
    }

    // Stop once we have the key early data (but keep going for dead-zone check)
    if (activeSecFor200Followers !== -1 && activeSec > 600) break;
  }

  return {
    postsForFirstGear,
    postsForFirstRepeatable,
    activeSecFor200Followers,
    maxDeadZoneSec,
    firstLiveFollowers,
  };
}

// ─── formatting ───────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(n < 10 ? 1 : 0);
}

function pass(p: boolean) { return p ? "✅ PASS" : "❌ FAIL"; }

// ─── main ─────────────────────────────────────────────────────────────────────

console.log("═══════════════════════════════════════════════════════════════");
console.log("  ClickTok Balance Simulation  —  client/scripts/simBalance.ts");
console.log("═══════════════════════════════════════════════════════════════\n");

// Print current key balance values being tested
console.log("── Balance constants under test ──────────────────────────────");
console.log(`  postCoinConversion      : ${BALANCE.postCoinConversion}`);
console.log(`  giftCoinValue           : rose=${BALANCE.run.giftCoinValue.rose} heart=${BALANCE.run.giftCoinValue.heart} galaxy=${BALANCE.run.giftCoinValue.galaxy} lion=${BALANCE.run.giftCoinValue.lion}`);
console.log(`  giftDiamondValue        : rose=${BALANCE.run.giftDiamondValue.rose} heart=${BALANCE.run.giftDiamondValue.heart} galaxy=${BALANCE.run.giftDiamondValue.galaxy} lion=${BALANCE.run.giftDiamondValue.lion}`);
console.log(`  giftWeights             : rose=${BALANCE.run.giftWeights.rose} heart=${BALANCE.run.giftWeights.heart} galaxy=${BALANCE.run.giftWeights.galaxy} lion=${BALANCE.run.giftWeights.lion}`);
console.log(`  completionDiamondBase   : ${BALANCE.scoring.completionDiamondBase}`);
console.log(`  ring_light cost (coins) : ${UPGRADE_CATALOG.find(u => u.id === "ring_light")!.cost.coins}`);
console.log();

// ── Target (a): first gear affordable in 5–10 posts ──────────────────────────
console.log("── Target (a): first Gear affordable within 5–10 posts ───────");
const ringLightDef = UPGRADE_CATALOG.find(u => u.id === "ring_light")!;
const ringLightCost = ringLightDef.cost?.coins ?? 0;
const coinsPerPost = BALANCE.basePostPower * BALANCE.postCoinConversion;
const postsForRingLight = Math.ceil(ringLightCost / coinsPerPost);
const passA = postsForRingLight >= 5 && postsForRingLight <= 10;
console.log(`  ring_light costs ${ringLightCost} coins; fresh post earns ${coinsPerPost.toFixed(1)} coins`);
console.log(`  Posts to afford ring_light : ${postsForRingLight}`);
console.log(`  ${pass(passA)}  (target: 5–10 posts)\n`);

// ── Target (f): first repeatable affordable within 3 taps ────────────────────
console.log("── Target (f): first repeatable buy within 3 taps (cold start) ─");
const engBoostDef = UPGRADE_CATALOG.find(u => u.id === "engagement_boost")!;
const engBoostFirstCost = engBoostDef.baseCost?.coins ?? 0;
const tapsForFirstRepeatable = Math.ceil(engBoostFirstCost / (BALANCE.basePostPower * BALANCE.postCoinConversion));
const passF = tapsForFirstRepeatable <= 3;
console.log(`  engagement_boost L1 costs ${engBoostFirstCost} coins; fresh tap earns ${BALANCE.basePostPower * BALANCE.postCoinConversion} coins`);
console.log(`  Taps to afford first repeatable: ${tapsForFirstRepeatable}`);
console.log(`  ${pass(passF)}  (target: ≤ 3 taps)\n`);

// ── Early game simulation (targets b and e) ───────────────────────────────────
console.log("── Early game simulation (1 post/sec, greedy upgrades) ────────");
const early = simulateEarlyGame(1800);

// Target (b): first LIVE viable at ~200 followers within ~5 active minutes
const TARGET_B_SEC = 5 * 60; // 5 minutes
const passB = early.activeSecFor200Followers !== -1 && early.activeSecFor200Followers <= TARGET_B_SEC;
console.log(`  First repeatable purchase   : post ${early.postsForFirstRepeatable}`);
console.log(`  First gear purchase at post : ${early.postsForFirstGear}`);
console.log(`  Active time to 200 followers: ${early.activeSecFor200Followers}s (${(early.activeSecFor200Followers / 60).toFixed(1)} min)`);
console.log(`  Followers at that point     : ${early.firstLiveFollowers}`);
console.log();

console.log("── Target (b): first LIVE viable by ~200 followers in ≤5 min ──");
console.log(`  Active seconds to 200 followers: ${early.activeSecFor200Followers} (${(early.activeSecFor200Followers / 60).toFixed(1)} min)`);
console.log(`  ${pass(passB)}  (target: ≤ ${TARGET_B_SEC}s / 5 min)\n`);

// ── Per-snapshot analysis: targets (c) and (d) ───────────────────────────────
console.log("── Targets (c) and (d): per-snapshot run analysis ─────────────\n");

const TARGET_C_RATIO = 2; // run coins ≥ 2× idle coins over same duration
const TARGET_D_MIN = 2;
const TARGET_D_MAX = 10;

interface SnapshotResult {
  label: string;
  runCoins: number;
  idleCoins: number;
  runToIdleRatio: number;
  diamonds: number;
  passC: boolean;
  passD: boolean;
  startViewers: number;
  giftRate: number;
  passiveCoinsPerSec: number;
}

const snapshotResults: SnapshotResult[] = [];

for (const snap of SNAPSHOTS) {
  const run = analyzeRun(snap);
  const { passiveCoinsPerSec } = recomputeStats(snap.ownedUpgrades, snap.skillLevels, snap.upgradeLevels);
  const idleCoins = passiveCoinsPerSec * run.hypeDecayPerSec <= 0
    ? passiveCoinsPerSec * BALANCE.run.durationSec
    : passiveCoinsPerSec * BALANCE.run.durationSec;
  const idleCoinsVal = passiveCoinsPerSec * BALANCE.run.durationSec;
  const ratio = idleCoinsVal === 0 ? Infinity : run.totalCoins / idleCoinsVal;
  const passC = ratio >= TARGET_C_RATIO || idleCoinsVal === 0;
  const passD = run.totalDiamonds >= TARGET_D_MIN && run.totalDiamonds <= TARGET_D_MAX;

  snapshotResults.push({
    label: snap.label,
    runCoins: run.totalCoins,
    idleCoins: idleCoinsVal,
    runToIdleRatio: ratio,
    diamonds: run.totalDiamonds,
    passC,
    passD,
    startViewers: run.startViewers,
    giftRate: run.giftRate,
    passiveCoinsPerSec,
  });

  console.log(`  ${snap.label}`);
  console.log(`    startViewers     : ${fmt(run.startViewers)}`);
  console.log(`    giftRate         : ${run.giftRate.toFixed(3)}/s → ${fmt(run.expectedGifts)} gifts/run`);
  console.log(`    passiveCoins/sec : ${fmt(passiveCoinsPerSec)}`);
  console.log(`    Run coins (exp.) : ${fmt(run.totalCoins)}  (gifts ${fmt(run.giftCoins)} + base ${fmt(run.baseCoins)})`);
  console.log(`    Idle 180s        : ${fmt(idleCoinsVal)}`);
  console.log(`    Run:Idle ratio   : ${ratio === Infinity ? "∞" : ratio.toFixed(2)}×   ${pass(passC)}  (target ≥ ${TARGET_C_RATIO}×)`);
  console.log(`    Diamonds/run     : ${run.totalDiamonds.toFixed(1)}   ${pass(passD)}  (target ${TARGET_D_MIN}–${TARGET_D_MAX})`);
  console.log();
}

// ── Target (e): no dead zone > 10 active minutes ──────────────────────────────
const TARGET_E_MAX_SEC = 10 * 60; // 10 minutes
const passE = early.maxDeadZoneSec < TARGET_E_MAX_SEC;
console.log("── Target (e): no dead zone > 10 active minutes ───────────────");
console.log(`  Max gap between purchases: ${early.maxDeadZoneSec}s (${(early.maxDeadZoneSec / 60).toFixed(1)} min)`);
console.log(`  ${pass(passE)}  (target: < ${TARGET_E_MAX_SEC}s)\n`);

// ── Phase 17: shared rhythm-chart band and run-primary check ─────────────────
const beatSyncPerfectK = BALANCE.elements.beatSync.rings * 4
  + BALANCE.elements.beatSync.perfectWaveBonus;
const tebPerfectK = BALANCE.teb.rhythm.rhythmBasePayout
  * BALANCE.teb.chargeMultMax
  * BALANCE.teb.rhythm.performanceMultMax
  * (1 + BALANCE.teb.rhythm.rhythmComboCap * BALANCE.teb.rhythm.rhythmComboPerHit);
const typicalChargeQuality = 0.65;
const typicalPerformanceQuality = 0.7;
const typicalCompletion = 0.9;
const tebTypicalK = BALANCE.teb.rhythm.rhythmBasePayout
  * (BALANCE.teb.chargeMultMin + (BALANCE.teb.chargeMultMax - BALANCE.teb.chargeMultMin) * typicalChargeQuality)
  * (BALANCE.teb.rhythm.performanceMultMin + (BALANCE.teb.rhythm.performanceMultMax - BALANCE.teb.rhythm.performanceMultMin) * typicalPerformanceQuality)
  * typicalCompletion
  * (1 + 3 * BALANCE.teb.rhythm.rhythmComboPerHit);
const targetChargeSec = (BALANCE.teb.chargeStartScale - 1)
  / (BALANCE.teb.chargeStartScale - BALANCE.teb.chargeEndScale)
  * BALANCE.teb.chargeShrinkSec;
const typicalSequenceSec = (BALANCE.teb.parFastSec + BALANCE.teb.parSlowSec) / 2;
const typicalSessionsPerMin = 60
  / (targetChargeSec + typicalSequenceSec + BALANCE.teb.cooldownSec);

const tebRunChecks = SNAPSHOTS.map((snap) => {
  const stats = recomputeStats(snap.ownedUpgrades, snap.skillLevels, snap.upgradeLevels);
  const tebCoinsPerMin = stats.tapPower * BALANCE.postCoinConversion * stats.multiplier
    * tebTypicalK * typicalSessionsPerMin;
  const runCoinsPerMin = analyzeRun(snap).totalCoins / (BALANCE.run.durationSec / 60);
  return { label: snap.label, tebCoinsPerMin, runCoinsPerMin, pass: runCoinsPerMin > tebCoinsPerMin };
});
const passTebRunsPrimary = tebRunChecks.every(check => check.pass);

console.log("── Phase 17: rhythm chart reward-band verification ────────────");
console.log(`  Perfect TEB multiplier       : ${tebPerfectK.toFixed(1)}× gainPerPost`);
console.log(`  Perfect BEAT SYNC multiplier : ${beatSyncPerfectK.toFixed(1)}× gainPerPost`);
console.log(`  Ceiling ratio                : ${(tebPerfectK / beatSyncPerfectK).toFixed(2)}×`);
console.log(`  Typical TEB multiplier       : ${tebTypicalK.toFixed(3)}× gainPerPost`);
for (const check of tebRunChecks) {
  console.log(`  ${check.label}: TEB ${fmt(check.tebCoinsPerMin)}/min vs run ${fmt(check.runCoinsPerMin)}/min  ${pass(check.pass)}`);
}
console.log(`  ${pass(passTebRunsPrimary)}  runs remain primary at all snapshots\n`);

// ── Summary table ─────────────────────────────────────────────────────────────
console.log("═══════════════════════════════════════════════════════════════");
console.log("  PASS / FAIL SUMMARY");
console.log("═══════════════════════════════════════════════════════════════");
const allPassC = snapshotResults.every(r => r.passC);
const allPassD = snapshotResults.every(r => r.passD);
const failedC = snapshotResults.filter(r => !r.passC).map(r => r.label);
const failedD = snapshotResults.filter(r => !r.passD).map(r => r.label);

console.log(`  (a) first gear in 5–10 posts     : ${pass(passA)}`);
console.log(`  (b) first LIVE in ≤5 min         : ${pass(passB)}`);
console.log(`  (c) run ≥ 2× idle at all stages  : ${pass(allPassC)}${failedC.length ? "  → fails at: " + failedC.join(", ") : ""}`);
console.log(`  (d) diamonds 2–10 per run        : ${pass(allPassD)}${failedD.length ? "  → fails at: " + failedD.join(", ") : ""}`);
console.log(`  (e) no 10-min dead zone          : ${pass(passE)}`);
console.log(`  (f) first repeatable ≤ 3 taps    : ${pass(passF)}`);
console.log(`  (17) each chart < run / minute   : ${pass(passTebRunsPrimary)}`);
console.log();

const allPass = passA && passB && allPassC && allPassD && passE && passF && passTebRunsPrimary;
console.log(allPass ? "  ✅ ALL TARGETS PASS" : "  ❌ SOME TARGETS FAIL — tune balance.ts and re-run");
console.log("═══════════════════════════════════════════════════════════════\n");
