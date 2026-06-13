export const BALANCE = {
  // posting
  basePostPower: 1,
  postFollowerConversion: 0.6,   // followers per post = postPower * this
  postLikeConversion: 0.4,
  postCoinConversion: 6.0,       // coins per post = postPower * this

  // passive / idle
  idleCapSec: 8 * 3600,          // max 8h of offline income granted on return

  // skills
  skillCostGrowth: 1.7,          // next-level cost = baseCost * growth^level

  // run / livestream
  run: {
    durationSec: 180,
    baseStartViewers: 10,
    followerSqrtCoeff: 0.5,      // viewers contribution from followers
    charismaViewersPerLevel: 0.05,   // +5% start viewers per Charisma level
    baseGiftRate: 0.15,         // gifts/sec at 100 viewers, before mods
    giftRateViewerRef: 100,
    monetizationGiftPerLevel: 0.04, // +4% gift rate & value per Monetization level
    baseHypeDecay: 2.0,         // hype points lost/sec at hype skill 0
    stagecraftDecayReductionPerLevel: 0.03, // -3%/level (clamped to 0.7 max reduction)
    baseEventIntervalSec: 4.0,  // mean seconds between events (scaled down by viewers)
    flopFloorFrac: 0.25,        // flop floor = startViewers * this
    flopGraceSec: 6,            // seconds under floor before stream flops
    hypeWaveViewerBoost: 0.15,  // ride a wave → +15% viewers
    trollViewerDrainPerSec: 0.03, // -3% viewers/sec while a troll is active
    trollHypeDrainPerSec: 4,
    giftCoinValue: { rose: 7, heart: 28, galaxy: 160, lion: 1000 },
    giftDiamondValue: { rose: 0, heart: 0, galaxy: 0, lion: 0 },
    // base gift tier weights (shift upward by giftQuality)
    giftWeights: { rose: 60, heart: 28, galaxy: 10, lion: 2 },
  },

  // run scoring → rewards
  scoring: {
    followerYieldCoeff: 1.0,    // see § Run scoring
    completionDiamondBase: 5,
    hypeBonusCoeff: 0.01,       // +1% rewards per hype point at end
  },

  // Phase 4 — viewer economy & The Algorithm (04 §12)
  social: {
    realViewerWeight: 5,
    snapshotPerSec: 3,

    tapMaxPerSec: 4,
    tapBatchSec: 1,
    tapHypeAdd: 0.3,
    tapDecayReliefPerTap: 0.04,
    tapRewardBundle: 25,
    tapRewardCapPerStream: 200,

    quickChatCooldownSec: 3,
    giftHypeSpike: { rose: 3, heart: 6, galaxy: 15, lion: 35 },
    giftCloutbackBase: 0.5,
    giftCloutbackPerLevel: 0.1,
    earlyBackerWindowSec: 30,
    earlyBackerJackpotMult: 3,

    voteBoostMult: 1.25,
    voteWinCoinsPerLevel: 10,

    flopReliefPerRealViewer: 0.10,
    shoutoutFollowersPerLevel: 50,

    dropCoinsPerSecPerLevel: 0.15,
    dropGradeMult: { S: 3, A: 2, B: 1.25, C: 1, D: 0.75, FLOP: 0.5 },
    dropLikesPerSec: 0.5,
    dropFollowerPer30s: 1,
    dropFollowerCap: 20,
    dropDiamondMinSec: 90,

    algoFeedStreamStarted: 5,
    algoFeedPerWatchSec: 0.05,
    algoFeedPerGiftCoin: 1 / 25,
    algoHalfLifeHours: 1,
    algoFedThreshold: 100,         //  ≥100 → FED:     ×1.10 all income
    algoBlessedThreshold: 400,     //  ≥400 → BLESSED: ×1.25 + guaranteed 2nd run modifier
    algoFedMult: 1.10,
    algoBlessedMult: 1.25,

    // §12.8 Featured sim streams (task 6.1)
    featuredMinDirectory: 3,   // lobby pads the directory up to this many cards (real first)
    featuredDropMult: 0.5,     // watch-drop multiplier on featured streams (gradeMult fixed at 1)
  },

  // Phase 7 — The Feed (04 §13)
  feed: {
    // §13.1 combo
    comboPerTap: 0.005,            // comboMult = 1 + min(combo, comboCap) × this
    comboCap: 100,                 // → max ×1.5
    comboMilestones: [10, 25, 50, 100],
    comboDecayDelaySec: 2.5,       // idle grace before the combo starts draining
    comboDecayPerSec: 25,          // drain rate (full 100 combo gone in 4s of idling)

    // §13.2 boosts
    boostCoinSurge: 0.5,           // +50% coins per tap
    boostFanMagnet: 0.5,           // +50% followers per tap
    boostLikeStorm: 1.0,           // +100% (×2) likes per tap
    luckyTapChance: 0.08,
    luckyTapMult: 10,
    hypeSeedTapsPer: 50,
    hypeSeedHype: 5,
    hypeSeedCap: 25,

    // §13.3 publishing
    publishBurstTaps: 25,
    publishCooldownSec: 120,

    // §13.4 royalties
    royaltyLikesPerTap: 0.5,

    // §13.5 the pool (SERVER values mirrored in party/src/lobby.ts when wired)
    feedPoolCap: 50,
    feedMinDeck: 10,
    engageMaxTapsPerMsg: 120,
    serverPublishCooldownSec: 60,

    // §13.8 VIRAL overdrive (Phase 8.4)
    viralBurstMult: 25,            // ring hits comboCap → instant 25 × gainPerPost × comboMult
    viralSec: 8,                   // VIRAL duration: combo frozen at cap, decay paused
    viralGainMult: 2,              // ALL payouts ×2 while viral (core taps, elements, rail)
    viralExitCombo: 25,            // combo settles here when VIRAL ends (the climb restarts)
  },

  // Phase 7.3 — the element framework (04 §13.2)
  elements: {
    waveIdleGapSec: 6,             // scheduler: breathing room between waves (one wave at a time)

    // BEAT SYNC (timing rings) — unlock: 2,500 coins, gated at 1,000 followers
    beatSync: {
      unlock: { coins: 2500, followers: 1000 },
      rings: 3,
      shrinkSec: 1.6,              // ring travels scale 2.2 → 1.0 in this time
      staggerSec: 0.45,            // spawn offset between rings — THE rhythm
      windowPerfect: 0.08,         // |ringScale − 1| ≤ → PERFECT  ×4 gainPerPost
      windowGood: 0.20,            //                  → GOOD     ×2
      windowOk: 0.40,              //                  → OK       ×1   (worse/expired = MISS ×0)
      perfectWaveBonus: 5,         // all-3-PERFECT: +5 × gainPerPost on top
    },

    // DUET LOOP (call-and-response) — unlock: 10,000 coins, gated at 5,000 followers
    duetLoop: {
      unlock: { coins: 10000, followers: 5000 },
      pods: 3,
      armTimeoutSec: 2.5,          // an armed pod fades back to dormant if not tapped
      podPayout: 3,                // each pod tap pays 3 × gainPerPost (core taps pay normal)
      flowSec: 4.0,                // full chain (core→pod ×3, 6 taps) inside this → FLOW
      flowBonus: 6,                // +6 × gainPerPost
    },
  },
} as const;
