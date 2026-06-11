export const BALANCE = {
  // posting
  basePostPower: 1,
  postFollowerConversion: 0.6,   // followers per post = postPower * this
  postLikeConversion: 0.4,
  postCoinConversion: 1.0,       // coins per post = postPower * this

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
    giftCoinValue: { rose: 5, heart: 20, galaxy: 120, lion: 800 },
    giftDiamondValue: { rose: 0, heart: 0, galaxy: 1, lion: 8 },
    // base gift tier weights (shift upward by giftQuality)
    giftWeights: { rose: 60, heart: 28, galaxy: 10, lion: 2 },
  },

  // run scoring → rewards
  scoring: {
    followerYieldCoeff: 1.0,    // see § Run scoring
    completionDiamondBase: 2,
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
  },
} as const;
