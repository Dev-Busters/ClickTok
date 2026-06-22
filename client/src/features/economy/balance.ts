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
    luckyTapChance: 0.05,
    luckyTapMult: 6,
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

    // §13.7 the engagement rail (Phase 8.5–8.6)
    railReactionMult: { like: 2, comment: 3, share: 4, follow: 5 }, // × gainPerPost × comboMult,
                                   //   ONCE per video per session (keyed by videoId)
    railSweepBonus: 6,             // all 4 reactions on one card → +6 × gainPerPost × comboMult
    royaltyLikesPerReaction: 3,    // SERVER-relayed (8.6): poster gains likes per like/comment/share
    royaltyFollowersPerFollow: 1,  // SERVER-relayed (8.6): poster gains followers per follow
    npcSeedLikesMin: 100,          // NPC card seeded counters: likes log-uniform in
    npcSeedLikesMax: 100000,       //   [min, max]; comments/shares derived (§13.7)

    // 14.1 Momentum: ephemeral no-dead-zones beat (10 §A). Fills with TEB taps
    // + rail reactions, drains while idle; never persisted.
    momentumPerEngage: 1,          // meter += this per TEB tap / rail reaction
    momentumCap: 35,               // ~35 engagements to fill (≈30–45s of active play)
    momentumIdleDelaySec: 6,       // idle grace before drain starts (matches TapCore's IDLE_SEC)
    momentumIdleDecayPerSec: 8,    // drain rate once idle (wipes a full meter in ~4.4s)
    momentumBonusMult: 10,         // burst = this × the gain of the tap/reaction that filled it
  },

  // Phase 9 — repeatable upgrades (04 §14)
  upgrades: {
    engagementBoost: { baseCost: 10, costGrowth: 1.75, maxLevel: 25, postPowerAddPerLevel: 1 },
    loyalFollowers:  { baseCost: 40, costGrowth: 1.80, maxLevel: 15, followerConversionAddPerLevel: 0.2 },
    autoEngageBot:   { baseCost: 75, costGrowth: 1.90, maxLevel: 20, passiveCoinsAddPerLevel: 0.5 },
  },

  // Phase 15 — Video catalog (11 §A/C)
  catalog: {
    catalogYieldCoeff: 0.2,      // coinsPerSec per post = postPower × this (04 §3)
    catalogPeakAtSec: 120,       // yield peaks at this age (seconds), then decays
    // decay: factor = max(0.1, 1 - (age - peak) / (peak × 6)); floor reached at age = 6.4 × peak

    // 15.3 view-buff: temporary tap-coin boost the viewer gets when a card becomes active
    viewBuffMult: 1.15,          // +15% coins per tap while buff is active
    viewBuffDurationSec: 30,     // buff lasts 30s after card becomes active
  },

  // Phase 7.3 — the element framework (04 §13.2)
  elements: {
    waveIdleGapSec: 3,             // scheduler: breathing room between waves (one wave at a time)

    // BEAT SYNC (timing rings) — unlock: 50 coins, gated at viewer level (~25 followers)
    beatSync: {
      unlock: { coins: 50, followers: 25 },
      rings: 3,
      shrinkSec: 1.6,              // ring travels scale 2.2 → 1.0 in this time
      staggerSec: 0.45,            // spawn offset between rings — THE rhythm
      windowPerfect: 0.12,         // |ringScale − 1| ≤ → PERFECT  ×4 gainPerPost
      windowGood: 0.20,            //                  → GOOD     ×2
      windowOk: 0.40,              //                  → OK       ×1   (worse/expired = MISS ×0)
      perfectWaveBonus: 5,         // all-3-PERFECT: +5 × gainPerPost on top
    },

    // DUET LOOP (call-and-response) — unlock: 200 coins, gated at viewer level (~25 followers)
    duetLoop: {
      unlock: { coins: 200, followers: 25 },
      pods: 3,
      armTimeoutSec: 2.5,          // an armed pod fades back to dormant if not tapped
      podPayout: 3,                // each pod tap pays 3 × gainPerPost (core taps pay normal)
      flowSec: 4.0,                // full chain (core→pod ×3, 6 taps) inside this → FLOW
      flowBonus: 6,                // +6 × gainPerPost
    },

    // HOLD DROP (charge ring) — unlock: 300 coins, gated at viewer level (~25 followers)
    holdDrop: {
      unlock: { coins: 300, followers: 25 },
      chargeSec: 2.5,          // ring fills fully in this many seconds
      crestPeriodSec: 1.6,     // golden target oscillates on this cycle
      crestCenter: 0.48,       // oscillation center (48% of ring)
      crestAmplitude: 0.26,    // ±26% → crest travels 0.22–0.74 of ring
      crestHalfWidth: 0.11,    // ±11% around crest = PERFECT zone
      overchargeWarn: 0.86,    // ring pulses red at 86% — warn before WEAK at 100%
      perfectPayout: 10,       // dead-center perfect: 10 × gainPerPost
      perfectPayoutMin: 5,     // edge-of-window perfect: 5 × gainPerPost
      crestComboKick: 3,       // perfect drop adds 3 to combo (hype kick)
      weakPayout: 1.5,         // over/undercharge: 1.5 × gainPerPost
      expiryAfterSec: 5.0,     // wave auto-expires if never pressed
    },

    // SWIPE HITS (directional) — unlock: 450 coins, gated at viewer level (~25 followers)
    swipeHits: {
      unlock: { coins: 450, followers: 25 },
      traces: 2,           // traces per wave (11.4: anchored drag mechanic)
      staggerSec: 0.6,     // trace i activates at startedAt + i * staggerSec * 1000ms
      activeSec: 1.8,      // window each trace can be dragged (progress 0 → 1)
      hitRadiusPx: 48,     // release must land within this many px of the TO dot
      perfectPayout: 5,    // each on-target release: 5 × gainPerPost
      allPerfectBonus: 8,  // all traces hit → +8 × gainPerPost bonus on final trace
    },
  },

  // Phase 16 — TEB node-sequence framework (04 §15.4)
  teb: {
    holdLaunchThresholdMs: 220,   // press longer than this (cooldown elapsed) = launch; shorter = tap
    cooldownSec: 18,              // keeps repeat sessions below run income per minute

    // charge (hold_charge) — 15.1
    chargeStartScale: 2.4,        // ring starts at 2.4× TEB radius (clearly outside)
    chargeEndScale: 0.55,         // shrinks past TEB's size if held too long
    chargeShrinkSec: 1.8,         // start→end travel time
    chargeTolerance: 0.45,        // |scale-1| within this → quality > 0; brighten this band gold

    // sequence (tap_three) — 15.2
    nodeSizePx: 72,               // diameter of each numbered node
    parFastSec: 1.2,              // finish ≤ this → speedQuality 1
    parSlowSec: 4.0,              // finish ≥ this → speedQuality 0
    sequenceTimeoutSec: 8,        // auto-resolve if not completed (reward × completion fraction)
    resultGraceSec: 1.2,          // result banner lingers this long before auto-dismiss

    // reward — 15.3
    sessionBasePayout: 4,         // perfect ceiling = 16×, matching BEAT SYNC's 17× band
    chargeMultMin: 0.5, chargeMultMax: 2.0,
    speedMultMin: 0.5,  speedMultMax: 2.0,
    rhythm: {
      countInMs: 720,
      approachMs: 900,
      approachStartScale: 2.2,
      perfectWindowMs: 70,
      greatWindowMs: 150,
      goodWindowMs: 260,
      perfectQuality: 0.90,
      greatQuality: 0.65,
      targetDiameterPx: 72,
      hitRadiusPx: 46,
      holdRadiusPx: 52,
      holdBreakGraceMs: 100,
      swipeNodeRadiusPx: 46,
      swipeMaxLinkMs: 780,
      traceRadiusPx: 42,
      traceSampleCount: 48,
      maxPointerSamples: 96,
      trailPointCap: 10,
      trailFadeMs: 220,
      resultGraceMs: 1400,
      layoutAttempts: 40,
      rhythmBasePayout: 3,
      performanceMultMin: 0.5,
      performanceMultMax: 1.8,
      rhythmComboCap: 4,
      rhythmComboPerHit: 0.025,
    },
  },
  onboarding: {
    analyticsFollowers: 5,
    firstGoalFollowers: 10,
    studioFollowers: 25,
    minorFollowerGoal1: 700,
    minorFollowerGoal2: 1200,
    rhythmFollowers: 2400,
    videoFypFollowers: 10000,
    audienceReach: { baseCost: 5, costGrowth: 1.4, followerAmountAddPerLevel: 1 },
    engagementRate: { baseCost: 18, costGrowth: 1.9, fillAddPerLevel: 0.25 },
    engagement: { cap: 100, baseFillPerTap: 1 },
    goalCoins: { unlockStudio: 5, buyAudienceReach: 0, reach700: 25, ownThreeFypLevels: 35, reach1200: 40 },
    tapThreeCoins: { completionBase: 12, qualityBonusMax: 8 },
  },
} as const;
