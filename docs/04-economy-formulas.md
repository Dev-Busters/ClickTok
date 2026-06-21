# 04 — Economy & Formulas

> Every number lives here. **These are starting values for balance — tunable, not sacred.** Mirror
> them in code at `client/src/features/economy/balance.ts` (export a `BALANCE` object). When you
> tune, change both. Keep formulas as pure functions in `features/economy/` so they're testable and
> reusable server-side later. All `×` are multiplicative; clamp where noted.

## 0. Constants (`BALANCE`)

```ts
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
} as const;
```

## 1. Posting (active clicker)

> **Phase 18 opening override:** throughout the staged opening, use §17. Quick TEB taps grant
> Followers only; legacy multi-currency post rewards must not leak into the staged opening.

```
postPower        = (basePostPower + Σ gear.postPowerAdd + charismaPostBonus)
                     × Π gear.postPowerMult
multiplier       = Π (software.multiplierMult) × skillMultipliers × prestigeMult
gainPerPost.coins      = postPower × postCoinConversion     × multiplier
gainPerPost.followers  = postPower × postFollowerConversion × followerConversion × multiplier
gainPerPost.likes      = postPower × postLikeConversion     × multiplier
```
- `charismaPostBonus = charismaLevel × 1` (Charisma adds flat post power).
- `followerConversion = 1 + Σ software.followerConversionAdd + editingLevel × 0.05`.
- This is the evolution of the current `tap()`. Coins replace followers as shop currency.

## 2. Passive / idle income

```
passiveCoinsPerSec = Σ gear.passiveCoinsAdd × multiplier   (+ catalog yield if enabled)
```
Idle on return (`applyIdleIncome(now)`):
```
elapsedSec = min((now - lastSeenAt)/1000, idleCapSec)
coins      = passiveCoinsPerSec × elapsedSec
followers  = coins × 0.1          // idle yields some followers too
```
Show a "Welcome back — you earned X" summary if `elapsedSec > 60`.

## 3. Catalog (Phase 1.x, optional)

Each `VideoPost` yields a curve that ramps then decays (a video "trends" then fades):
```
age = nowSec - createdAt/1000
factor = age <= peakAtSec ? (age/peakAtSec)
                          : max(0.1, 1 - (age - peakAtSec)/(peakAtSec*6))
video.coinsPerSec_effective = video.coinsPerSec × factor
```
`catalogYieldPerSec()` sums effective yields. Created post → `coinsPerSec ≈ postPower × 0.2`,
`peakAtSec ≈ 120`. Cap catalog size (e.g., 50 newest) to bound the loop cost.

## 4. Upgrades (Gear & Software) — starting catalog

> IDs are stable; copy verbatim into `features/upgrades/catalog.ts`. Costs in coins unless noted.
> Effects map to `UpgradeEffect` (`03` §2). Tune freely.

### Gear
| id | name | cost | effect |
|---|---|---|---|
| `ring_light` | Ring Light | 50 | postPowerAdd +3 |
| `usb_mic` | USB Mic | 150 | postPowerAdd +6, runTrollResistAdd +0.1 |
| `tripod` | Tripod | 300 | passiveCoinsAdd +2 |
| `phone_gimbal` | Gimbal | 800 | postPowerAdd +15, runStartViewersAdd +10 |
| `dslr` | DSLR Camera | 2500 | runStartViewersMult ×1.25, postPowerAdd +30 |
| `green_screen` | Green Screen | 6000 | passiveCoinsAdd +25, unlocksReaction `pin_comment` |
| `studio_lights` | Studio Lights | 18000 | multiplierMult ×1.3, runGiftRateMult ×1.2 |
| `creator_rig` | Creator Rig | 60000 (+ 5💎) | postPowerAdd +120, runStartViewersMult ×1.5 |

### Software
| id | name | cost | effect |
|---|---|---|---|
| `capcut` | Editing App | 100 | followerConversionAdd +0.3, unlocksReaction `clapback` |
| `scheduler` | Post Scheduler | 400 | passiveCoinsAdd +6 |
| `hashtag_tool` | Hashtag Tool | 1200 | multiplierMult ×1.25 |
| `analytics_pro` | Analytics Pro | 4000 | followerConversionAdd +0.6, runGiftRateMult ×1.15 |
| `trend_radar` | Trend Radar | 10000 | unlocksReaction `shoutout`, runStartViewersAdd +40 |
| `algo_hacks` | Algorithm Hacks | 35000 | multiplierMult ×1.6 |
| `viral_engine` | Viral Engine | 120000 (+ 15💎) | multiplierMult ×2, unlocksReaction `go_off` |

`hype_dance` reaction is unlocked by default (everyone starts with it).

## 5. Creator Skills

```
costOfNextLevel(skill) = round(skill.baseCost × skillCostGrowth^currentLevel)   // growth 1.7
```
| id | name | baseCost | maxLevel | requires | per-level effects |
|---|---|---|---|---|---|
| `charisma` | Charisma | 80 | 20 | — | +1 postPower; +5% run start viewers; +viewer growth from hype |
| `editing` | Editing | 120 | 20 | — | +0.05 followerConversion; +run follower payout |
| `stagecraft` | Stagecraft | 150 | 15 | followers ≥ 1k | -3% hype decay (cap -70%); +20% hype-wave strength |
| `monetization` | Monetization | 200 | 15 | followers ≥ 5k | +4% gift rate & gift value |
| `network` | Network | 250 | 10 | followers ≥ 25k | better raid/collab events; (Phase 4) raid power |

## 6. Meta → Run bridge (THE core formula set)

Computed in `features/livestream/computeRunParams(meta, topic, trendHeat)`:

```
F   = wallet.followers
cha = skillLevels.charisma
mon = skillLevels.monetization
stg = skillLevels.stagecraft
edt = skillLevels.editing

topicMatch     = 1 + (trendHeat ?? 0) * 0.5            // hotter trend → more viewers
gearViewersAdd = Σ gear.runStartViewersAdd
gearViewersMul = Π gear.runStartViewersMult

startViewers = round(
  (baseStartViewers + followerSqrtCoeff * sqrt(F) + gearViewersAdd)
  × (1 + charismaViewersPerLevel * cha)
  × gearViewersMul
  × topicMatch
)

giftRate     = baseGiftRate × (startViewers / giftRateViewerRef)
                 × (1 + monetizationGiftPerLevel * mon)
                 × Π gear.runGiftRateMult
giftQuality  = monetizationGiftPerLevel * mon        // shifts giftWeights upward

hypeDecayPerSec = baseHypeDecay × (1 - min(0.7, stagecraftDecayReductionPerLevel * stg))

eventIntervalSec = max(1.2, baseEventIntervalSec × (giftRateViewerRef / max(startViewers,50))^0.25)
                   // bigger audience → events come faster

flopFloor    = max(3, round(startViewers × flopFloorFrac))
followerConversion = channel.followerConversion       // reused from meta
trendMultiplier    = topicMatch
reactions    = [hype_dance, ...unlocked from owned gear/software]
modifiers    = rollModifiers(rng, 1..2)               // see §8
durationSec  = run.durationSec
```

Worked example: F=10,000, cha=5, mon=3, stg=4, one DSLR (+25% viewers), trend heat 0.4.
`sqrt(10000)=100`; viewers ≈ (10 + 0.5·100 + 0)·(1+0.25)·1.25·1.2 ≈ 60·1.25·1.25·1.2 ≈ **112**.
giftRate ≈ 0.15·(112/100)·(1+0.12) ≈ **0.19/s**. Decay ≈ 2·(1−0.12)=**1.76/s**.

## 7. Run loop dynamics (per `runTick(dt)`)

```
clockSec += dt
hype = clamp(hype - hypeDecayPerSec*dt + reactionHypeGains, 0, 100)
// viewers drift toward an equilibrium driven by hype:
targetViewers = startViewers × (0.6 + 0.8*(hype/100))     // hype 0→0.6×, hype 100→1.4×
viewers += (targetViewers - viewers) × 0.5 * dt           // ease toward target
viewers -= activeTrolls * trollViewerDrainPerSec * viewers * dt
viewers = max(0, viewers); peakViewers = max(peakViewers, viewers)
// spawn events on a Poisson-ish schedule with mean eventIntervalSec (modifiers adjust)
// expire un-collected gifts / unresolved waves at their expiresAt
// tick cooldowns down by dt
// flop check:
if viewers < flopFloor: flopTimer += dt else flopTimer = 0
if flopTimer >= flopGraceSec: endRun("flop")
if clockSec >= durationSec: endRun("timer")
```

Gift tier roll: weighted pick from `giftWeights`, with weights shifted toward higher tiers by
`giftQuality` (e.g., move `giftQuality` fraction of mass up one tier). Collected gift adds
`giftCoinValue[tier]` coins and `giftDiamondValue[tier]` diamonds, ×(1 + monetization value bonus)
×(1 + hype/100).

## 8. Run modifiers (`rollModifiers`)

| id | effect |
|---|---|
| `algorithm_boost` | startViewers ×1.4, hypeDecay ×1.3 |
| `tough_crowd` | troll frequency ×1.5, gift values ×1.4 |
| `trending_sound` | hype-wave frequency ×2, wave strength ×1.2 |
| `shadowban_risk` | 15% chance/run of a mid-stream viewer crash event |
| `viral_moment` | one guaranteed huge hype wave at a random time |

Roll 1 modifier always; 2nd with 40% chance. Don't roll directly conflicting pairs.

## 9. Reactions (effects)

| id | cooldown | effect |
|---|---|---|
| `hype_dance` | 6s | +18 hype |
| `clapback` | 8s | remove the most recent active troll; +5 hype |
| `pin_comment` | 12s | convert a random active comment → followers (= viewers × 0.5) |
| `shoutout` | 20s | ×2 gift rate for 8s |
| `go_off` | 45s | ×3 all gains + +30 hype for 6s (ultimate) |

## 10. Run scoring → rewards (`scoreRun`)

```
hypeBonus   = 1 + finalHype × hypeBonusCoeff            // 0.01/point → up to ×2 at 100
base        = peakViewers × hypeBonus × trendMultiplier
followers   = round(base × followerConversion × followerYieldCoeff)
coins       = collected.coins + round(base × 0.5)
diamonds    = collected.diamonds + (reason !== "flop" ? completionDiamondBase : 0)
likes       = collected.likes + round(peakViewers × 2)
grade: by (peakViewers / startViewers) & finalHype →
        flop → "FLOP"; ratio≥3 & hype≥80 → "S"; ≥2 → "A"; ≥1.3 → "B"; ≥0.9 → "C"; else "D"
```
Flop payout: still grant collected gifts + 30% of computed followers (so a flop isn't zero, just
bad). All meta progress (gear/skills) is untouched by a flop.

## 11. Tuning guidance for whoever balances later

- **11.2 revision — slower early game (deliberate reversal of the old "keep it fast" rule, see
  `07 §B`):** first repeatable upgrade (Engagement Boost L1) lands after ~5 taps; first Gear
  (Ring Light) after ~28 taps; first element (Beat Sync) after ~37 taps; GO LIVE (the "posting"
  pillar) now gates at 200 followers (~71 taps from a fresh save). Tune future levers toward `07
  §B`'s target table (~30–60s / ~3–4min / ~4–6min / ~15–20min respectively at a real tapping
  pace) — the GO LIVE and all-elements milestones still land roughly 2× faster than that target
  and may need a further pass (e.g. `postFollowerConversion` or late-gear costs, not touched by
  11.2).
- Runs should out-earn ~5 min of idle by a healthy margin (runs are primary income).
- Diamonds stay scarce — they gate the few elite upgrades; ~2–10 per good run.
- If runs feel too swingy, lower `followerSqrtCoeff` variance sources and raise `flopGraceSec`.

## 12. Phase 4 — viewer economy & The Algorithm (`01` §7, types in `03` §6)

> Add to `BALANCE` (and `balance.ts`) as `BALANCE.social` when Phase 4 starts. **Guardrail
> (locked):** viewing earns coins/likes (rare diamonds); followers stay streamer-primary — viewer
> follower income is token-capped. Watching makes you richer; streaming makes you bigger. All
> rewards are client-granted (trusted) until 4.5 adds server-side validation.

```ts
// merge into BALANCE (§0 / balance.ts):
social: {
  realViewerWeight: 5,            // each real viewer counts as 5 in the display/scored total
  snapshotPerSec: 3,              // streamer publishes RunSnapshot 3×/sec

  // §12.1 hype taps
  tapMaxPerSec: 4,                // client rate limit; server drops excess
  tapBatchSec: 1,                 // taps batched into ≤1 hypeTap message/sec
  tapHypeAdd: 0.3,                // streamer: +hype per real tap
  tapDecayReliefPerTap: 0.04,     // see §12.3
  tapRewardBundle: 25,            // viewer: every 25 taps → coins = 1 × creatorLevel
  tapRewardCapPerStream: 200,     // taps that count toward rewards per stream

  // §12.2 quick-chat & gifts
  quickChatCooldownSec: 3,        // no currency reward — it's expression, not income
  giftHypeSpike: { rose: 3, heart: 6, galaxy: 15, lion: 35 },
  giftCloutbackBase: 0.5,         // viewer likes-back = cost × (base + perLevel × creatorLevel)
  giftCloutbackPerLevel: 0.1,
  earlyBackerWindowSec: 30,
  earlyBackerJackpotMult: 3,      // jackpot coins = early gift cost × 3, iff grade ≥ A

  // §12.2 votes
  voteBoostMult: 1.25,            // majority choice's effect magnitudes ×1.25
  voteWinCoinsPerLevel: 10,       // winning voters: coins = 10 × creatorLevel

  // §12.3 streamer-side real-crowd effects
  flopReliefPerRealViewer: 0.10,  // see §12.3 (cap 0.5)
  shoutoutFollowersPerLevel: 50,  // top gifter gains 50 × streamer creatorLevel followers

  // §12.4 watch-drops
  dropCoinsPerSecPerLevel: 0.15,
  dropGradeMult: { S: 3, A: 2, B: 1.25, C: 1, D: 0.75, FLOP: 0.5 },
  dropLikesPerSec: 0.5,
  dropFollowerPer30s: 1,          // token; hard-capped
  dropFollowerCap: 20,
  dropDiamondMinSec: 90,          // +1 diamond iff grade ≥ A and watched ≥ 90s

  // §12.5 The Algorithm
  algoFeedStreamStarted: 5,
  algoFeedPerWatchSec: 0.05,
  algoFeedPerGiftCoin: 1 / 25,    // +1 meter per 25 coins of gift value
  algoHalfLifeHours: 1,           // meter ×0.5 per hour
  algoFedThreshold: 100,          //  ≥100 → FED:     ×1.10 all income
  algoBlessedThreshold: 400,      //  ≥400 → BLESSED: ×1.25 + guaranteed 2nd run modifier
},
```

### 12.0 Creator level (the viewer-economy scaler)

```
creatorLevel = 1 + floor(log10(max(1, wallet.totalFollowers)))
// 0–9 → 1 · 10+ → 2 · 100+ → 3 · 1k+ → 4 · 10k+ → 5 · 100k+ → 6 · 1M+ → 7 …
```
Every viewer-side payout scales with the **streamer's** creator level — progressed players are
better loot zones, which is the whole point (`01` §7.1).

### 12.1 Hype taps (free interaction)

Viewer taps are client-rate-limited to `tapMaxPerSec` and batched into one `hypeTap` message per
`tapBatchSec`. Streamer applies `+tapHypeAdd` hype per tap (clamped 0–100 as usual). Viewer earns
`coins = creatorLevel` per `tapRewardBundle` taps, up to `tapRewardCapPerStream` taps counted.

### 12.2 Gifts & votes (paid / decisive interaction)

**Gifts** — viewer spends `giftCoinValue[tier]` (§0 table; insufficient coins = can't send):
```
streamer: +giftCoinValue[tier] coins, +giftDiamondValue[tier] diamonds, +giftHypeSpike[tier] hype
viewer:   likes-back = cost × (giftCloutbackBase + giftCloutbackPerLevel × creatorLevel)
jackpot:  if sent at runClock ≤ earlyBackerWindowSec AND final grade ≥ A
          → viewer also gets coins = cost × earlyBackerJackpotMult (paid via WatchDrop)
```
Real gifts are **bonus** on top of the sim gift schedule — the sim is unchanged by them.

**Votes** — choice events (`RunEvent.choices`) are mirrored to the room as a `StreamPoll`. While
real votes exist when the streamer resolves: the majority option's numeric effects are
×`voteBoostMult`, and majority voters each earn `coins = voteWinCoinsPerLevel × creatorLevel`.
The streamer still picks; the crowd weights and gets paid — ties / no votes = no boost.

### 12.3 Streamer-side real-crowd effects

```
displayViewers   = simViewers + realViewerWeight × realViewers
                   // used for the on-screen count, RunSnapshot, AND peakViewers/scoring (§10)
hypeDecay_eff    = hypeDecayPerSec × (1 − min(0.5, tapDecayReliefPerTap × realTapsLast5s))
flopFloor_eff    = flopFloor × (1 − min(0.5, flopReliefPerRealViewer × realViewers))
```
Real gifts/taps inject `real: true` RunEvents into the feed (glow render, `03` §5). Post-run, the
results sheet offers **one** shoutout of the top real gifter (most gift coins): that viewer gains
`shoutoutFollowersPerLevel × streamerCreatorLevel` followers.

### 12.4 Watch-drops (the viewer's payout, on leave or stream end)

```
gradeMult = dropGradeMult[grade]        // leaving before the end: gradeMult = 1, no diamond
coins     = round(watchSec × dropCoinsPerSecPerLevel × creatorLevel × gradeMult) + jackpotCoins
likes     = round(watchSec × dropLikesPerSec)
followers = min(dropFollowerCap, floor(watchSec / 30) × dropFollowerPer30s)   // token (guardrail)
diamonds  = (grade ≥ A && watchSec ≥ dropDiamondMinSec) ? 1 : 0
```
Worked example: watching a level-5 streamer's full 180s A-grade run →
`round(180 × 0.15 × 5 × 2)` = **270 coins**, 90 likes, 6 followers, 1 diamond.

### 12.5 The Algorithm (global meter)

Lobby server aggregates `feedAlgorithm` messages: `+algoFeedStreamStarted` per stream started,
`+algoFeedPerWatchSec` per real watch-second, `+giftCoins × algoFeedPerGiftCoin` per real gift.
Meter halves every `algoHalfLifeHours` hours. Tier (broadcast to all clients):
```
meter < 100  → STARVED  ×1.00
meter ≥ 100  → FED      ×1.10 all income (posts, passive, run rewards)
meter ≥ 400  → BLESSED  ×1.25 all income + every run rolls a guaranteed 2nd modifier
               drawn from { algorithm_boost, trending_sound, viral_moment }
```
Client folds the tier multiplier into `multiplier` via `recomputeStats()` (like `boonMultiplier`).

### 12.6 Tuning guidance (viewer economy)

- Watching should pay roughly **half** of what streaming the same minutes would — rich enough to
  be real gameplay, never optimal over going live yourself (followers enforce the rest).
- Jackpots are the dopamine spike: rare (needs early gift + ≥A run) but 3× is felt. Tune frequency
  before size.
- Keep `realViewerWeight` high enough that ONE real viewer is felt by the streamer (~+5 viewers is
  a visible bump early game, noise late game — revisit as population grows).

### 12.7 Server hardening clamps (task 4.5c-1)

Per-message/per-connection limits the party servers enforce; anything over the clamp is capped,
anything under the interval is dropped. These live **server-side only** — mirror them as a small
const block in `party/src/stream.ts` / `party/src/lobby.ts` (comment-linked to this section), not
in the client `BALANCE`.

```ts
const HARDEN = {
  maxTapsPerMsg: 8,               // tapMaxPerSec × tapBatchSec, ×2 slack for timer jitter
  minQuickChatIntervalMs: 2000,   // client cooldown is 3s; server allows slack
  maxFeedWatchSec: 60,            // max watchSec per feedAlgorithm message
  maxFeedGiftCoins: 800,          // = lion, the largest single gift
  minFeedIntervalMs: 1000,        // per-connection feedAlgorithm rate limit
};
```

Shoutout values are **recomputed server-side**: `shoutoutFollowersPerLevel × creatorLevel` from
the streamer's pinned `open` summary — the client-sent `followers` number is ignored.

### 12.8 Featured sim streams (task 6.1 — cold-start filler, `01` §7.4)

```ts
// add to BALANCE.social:
featuredMinDirectory: 3,   // lobby pads the directory up to this many cards (real first)
featuredDropMult: 0.5,     // watch-drop multiplier on featured streams (gradeMult fixed at 1)
```

Featured streams are lobby-generated cards (`featured: true`, creatorLevel rolled 2–4) played
back by a **client-local simulator** — no network, no other players. Economy on a featured
stream: hype taps pay the normal §12.1 micro-reward; gifts spend coins and pay the §12.2
clout-back but there is **no early-backer jackpot and no shoutout** (no real streamer to back);
the watch-drop is `×featuredDropMult` with `gradeMult = 1`. Net effect: featured streams are
worth watching when nobody's live, strictly worse than any real stream — filler never outcompetes
people.

## 13. Phase 7 — The Feed & the Element system (`01` §8, types in `03` §6.5)

> REVISED 2026-06-12 (elements-first redesign). The engage tap reuses §1's `gainPerPost`
> **unchanged** — combo, elements, and (later) video mods multiply it. Constants live in
> `BALANCE.feed` / `BALANCE.elements`; SERVER-marked values mirror into `party/src/lobby.ts`
> alongside `HARDEN` (§12.7). ⚠ The 7.1-era `BALANCE.feed` boost constants
> (`boostCoinSurge`/`luckyTap*`/`hypeSeed*`) and `features/feed/boosts.ts` are **retired** —
> reworked into the §13.5 video mods at task 7.5.

```ts
// merge into BALANCE (§0 / balance.ts):
feed: {
  // §13.1 combo (base button)
  comboPerTap: 0.005,            // comboMult = 1 + min(combo, comboCap) × this
  comboCap: 100,                 // → max ×1.5
  comboMilestones: [10, 25, 50, 100], // TAP CORE visual evolution stages
  comboDecayDelaySec: 2.5,       // idle grace before the combo starts draining
  comboDecayPerSec: 25,          // drain rate (full 100 combo gone in 4s of idling)

  // §13.3 publishing (task 7.5)
  publishBurstTaps: 25,          // POST grants 25 × gainPerPost instantly (no combo/mod mult)
  publishCooldownSec: 120,       // client-side gate (POST button shows countdown)

  // §13.4 royalties (task 7.6)
  royaltyLikesPerTap: 0.5,       // poster earns likes = taps × this (live-only v1; NPC: none)

  // §13.5 the pool (tasks 7.5–7.6)
  feedPoolCap: 50,               // SERVER: newest N cards kept
  feedMinDeck: 10,               // pad with NPC cards up to this (server; client offline too)
  engageMaxTapsPerMsg: 120,      // SERVER clamp (≈ tapMaxPerSec × a 15–30s stay, with slack)
  serverPublishCooldownSec: 60,  // SERVER per-connection postVideo rate limit (client gate is 120)

  // §13.7 the engagement rail (Phase 8.5–8.6)
  railReactionMult: { like: 2, comment: 3, share: 4, follow: 5 }, // × gainPerPost × comboMult,
                                 //   ONCE per video per session (keyed by videoId)
  railSweepBonus: 6,             // all 4 reactions on one card → +6 × gainPerPost × comboMult
  royaltyLikesPerReaction: 3,    // SERVER-relayed: poster gains likes per like/comment/share
  royaltyFollowersPerFollow: 1,  // SERVER-relayed: poster gains followers per follow
  npcSeedLikesMin: 100,          // NPC card seeded counters: likes log-uniform in
  npcSeedLikesMax: 100000,       //   [min, max]; comments/shares derived (§13.7)

  // §13.8 VIRAL overdrive (Phase 8.4)
  viralBurstMult: 25,            // ring hits comboCap → instant 25 × gainPerPost × comboMult
  viralSec: 8,                   // VIRAL duration: combo frozen at cap, decay paused
  viralGainMult: 2,              // ALL payouts ×2 while viral (core taps, elements, rail)
  viralExitCombo: 25,            // combo settles here when VIRAL ends (the climb restarts)
},

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
```

### 13.1 The engage tap + combo (THE clicker formula)

```
comboMult = 1 + min(combo, comboCap) × comboPerTap          // ×1.5 max
gain(currency) = gainPerPost(currency) × comboMult           // × video modMult after 7.5
combo += 1 per TAP CORE tap; after comboDecayDelaySec idle, combo -= comboDecayPerSec × dt
(once the 7.5 pager exists, swiping also resets combo to 0)
```
Worked example: `gainPerPost.coins = 10` → combo 0: `10`/tap; combo 100: `15`/tap.

### 13.2 Element waves (grading + payouts)

Every element payout is `× gainPerPost × comboMult at resolution time` — elements reward you for
keeping the combo warm, and Duet Loop's required core taps literally build it.

**BEAT SYNC** — ring `i` spawns at `startedAt + i × staggerSec`, its scale at time `t` is
`2.2 − 1.2 × (t − spawn)/shrinkSec` (clamped); grade by `|scale − 1|` at tap time against the
windows above. Per-ring payout = `gradeMult (4/2/1/0) × gainPerPost × comboMult`; an
all-PERFECT wave adds `perfectWaveBonus × gainPerPost × comboMult`. Ring expires unt apped past
`windowOk` ⇒ MISS. **The same clock drives the visual and the grade** — what you see IS the math.

**DUET LOOP** — wave spawns with all pods dormant; a TAP CORE tap arms the next pod (beam fires);
tapping the armed pod pays `podPayout × gainPerPost × comboMult` and returns control to the core.
Armed pod untapped for `armTimeoutSec` ⇒ it goes dormant again (no penalty, chain stalls).
Completing all pods within `flowSec` of the wave's first core tap ⇒ `flowBonus × gainPerPost ×
comboMult` and the FLOW flourish.

**Scheduler:** at most one active wave; on resolve/expiry wait `waveIdleGapSec`, then spawn the
next unlocked element round-robin. Waves pause while a sheet is open or a run/spectate is active.

### 13.3–13.4 publishing & royalties (unchanged from the original §13 — land at 7.5/7.6)
Publish burst = `publishBurstTaps × gainPerPost`, no multipliers, client cooldown
`publishCooldownSec`. Royalties = `taps × royaltyLikesPerTap` likes, live-only, NPC cards never
pay. Caption templates whitelisted server-side (quick-chat pattern, §12.7).

### 13.5 Video mods (task 7.5 — videos modify the MECHANICS, `01` §8.3)

Rolled uniformly at publish (poster can't pick). Active while that video is on screen:

| id | applies to | effect |
|---|---|---|
| `ring_slow` | beat_sync | ring `shrinkSec` ×1.25 (easier timing) |
| `extra_ring` | beat_sync | +1 ring per wave (more payout, denser rhythm) |
| `wide_window` | beat_sync | grading windows ×1.5 |
| `duet_flow` | duet_loop | `flowSec` +2s and `armTimeoutSec` +1s |
| `core_surge` | TAP CORE | core taps pay coins ×1.5 |
| `wave_rush` | scheduler | `waveIdleGapSec` ×0.5 (waves twice as often) |

Locked elements ignore their mods (a `ring_slow` card does nothing for a player without
Beat Sync — visible on the card, which doubles as an advertisement for the unlock).

### 13.7 The engagement rail (Phase 8.5–8.6 — the rail finally does something, `01` §8.6)

Rail counters display the WATCHED card's engagement totals (`card.reactions`), never the
player's wallet. Each rail action pays once per video per session:

```
railGain(kind) = railReactionMult[kind] × gainPerPost × comboMult × viralMult
sweep (all 4 on one card) = railSweepBonus × gainPerPost × comboMult × viralMult, on the 4th
```
Rail presses do NOT build combo (same ruling as element taps — only TAP CORE builds it) and
video mods do NOT apply to rail payouts (`core_surge` is core-tap coins only). The once-per-video
gate is keyed by `videoId` in `feedSlice.reactedByVideo` (session-ephemeral) — swiping back and
forth re-shows a card with its rail already spent, so the rail can't be scroll-farmed. A spent
button gives a small shake and pays nothing.

Worked example (`gainPerPost.coins = 10`, combo 50 ⇒ ×1.25): like 25c, comment 37.5c, share 50c,
follow 62.5c, sweep +75c ⇒ a full sweep ≈ 250c per fresh card — about one all-PERFECT Beat Sync
wave, by design.

**Royalties (8.6, extends the 7.6 pipe):** the current card's `reactedByVideo` entry flushes
with the `engage` batch. Server: clamp each reaction to boolean, dedupe per connection per
`videoId` (in-memory FIFO set, cap ~200 ids per connection), bump the card's
`reactions.likes/comments/shares` (follow has no card counter), relay in the `royalty` message.
Poster client grants `royaltyLikesPerReaction` likes per like/comment/share and
`royaltyFollowersPerFollow` followers per follow. NPC cards: counters bump, royalties never.

**NPC seeding (8.5):** from the card's existing PRNG —
`likes = round(10^(2 + r₁ × 3))` (log-uniform 100…100k, the `npcSeedLikes*` bounds),
`comments = round(likes × (0.02 + r₂ × 0.06))`, `shares = round(likes × (0.01 + r₃ × 0.02))`.
Player cards start at zeros and accrue real reactions.

### 13.8 VIRAL overdrive (Phase 8.4 — the combo-cap payoff, `01` §8.6)

```
trigger: combo reaches comboCap while not viral (engageTap)
burst   = viralBurstMult × gainPerPost × comboMult(cap)     // instant, e.g. 25 × 10 × 1.5 = 375c
state   : viralUntil = now + viralSec × 1000
          while viral: ALL payouts × viralGainMult (core taps, element waves, rail, sweep);
          combo FROZEN at comboCap (no decay, taps don't overfill)
exit    : combo = viralExitCombo (ring drains smoothly to the floor); decay resumes
```
Multiplier stacking is multiplicative and order-free:
`payout = base × gainPerPost × comboMult × modMult × viralMult`. A full cycle is ≈75 core taps
(climb 25→100) → burst + 8s of doubled payouts — pump-and-pop beats quiet saturation.

## 14. Repeatable upgrades & the metric ladder (Phase 9; `01` §10.4, §10.2)

### 14.1 Repeatable upgrade cost curve

```
cost(L) = round(baseCost × costGrowth^L)     // L = current level BEFORE the purchase
```

The per-level effect is defined in the `UpgradeDef.effect` field and applied ×level in
`recomputeStats()`. `multiplierMult` compounds: `multiplierMult^level` (not additive).

### 14.2 Early repeatable catalog

| id | name | category | baseCost | costGrowth | maxLevel | per-level effect |
|---|---|---|---|---|---|---|
| `engagement_boost` | Engagement Boost | repeatable | 10 🪙 | ×1.75 | 25 | postPowerAdd +1 |
| `loyal_followers`  | Loyal Followers  | repeatable | 40 🪙 | ×1.80 | 15 | followerConversionAdd +0.2 |
| `auto_engage_bot`  | Auto-Engage Bot  | repeatable | 75 🪙 | ×1.90 | 20 | passiveCoinsAdd +0.5/sec |

Early-curve checkpoints (11.2, `postCoinConversion: 1.0` → ~1 🪙/tap cold):
- `engagement_boost` L1: 10 🪙 → ~5 taps cold — teaches the loop immediately.
- first Gear (`ring_light`, 50 🪙): ~28 taps cumulative, after buying EB L1.
- `loyal_followers` / `auto_engage_bot` L1 costs (40 🪙 / 75 🪙) land within the same early
  window once EB L1's +1 postPower raises the per-tap rate above 1 🪙.

### 14.3 Metric ladder — thresholds, rewards, unlocks (08 §B, SAVE_VERSION 10)

> **Phase 18 opening override:** this ladder remains historical achievement data but does not grant
> rewards or reveal fresh-opening features. The ordered §17.3 Creator Goals are authoritative until
> `video_fyp` completes.

| id | stat | threshold | reward | unlocks (feature flag) |
|---|---|---|---|---|
| `views_10`      | Views (taps) | 10  | +15 🪙  | `fyp_video` — active card fills backdrop |
| `views_25`      | Views        | 25  | +25 🪙  | `engagement_rail` — LIKE / COMMENT / SHARE / FOLLOW rail |
| `views_45`      | Views        | 45  | +35 🪙  | `bottom_nav` — bottom nav row fades in |
| `views_80`      | Views        | 80  | +50 🪙  | `studio` — 🎬 Creator Studio button |
| `views_140`     | Views        | 140 | +70 🪙  | `feed_scroll` — swipe up/down between videos |
| `follower_50`   | Followers    | 50  | +5 💎   | `diamonds` — 💎 currency pill |
| `follower_90`   | Followers    | 90  | +80 🪙  | `posting` — `+` Create button in nav |
| `follower_120`  | Followers    | 120 | +100 🪙 | `element_stage` — FYP challenge band + Elements in Studio |
| `follower_160`  | Followers    | 160 | +5 💎   | `discover` — Discover tab |
| `follower_200`  | Followers    | 200 | +120 🪙 | `live` — GO LIVE pill + Create/Live action |
| `streams_1`     | Streams      | 1   | +5 💎   | `inbox` — Inbox tab + daily reward |
| `follower_1000` | Followers    | 1,000 | +15 💎 | *(reward only)* |
| `follower_5000` | Followers    | 5,000 | +25 💎 | *(reward only)* |

Reward is granted once, atomically, in `checkMetrics()` (Phase 9.2). See §11 for tuning
guidance — repeatable upgrades should make first metric crossings land within a few minutes
of active play. The Create sheet's GO LIVE action is gated by `live` even after `posting`
unlocks the `+` button (08 §B — staggered creator path).

### 13.9 Tuning guidance (was 13.6 — renumbered when §13.7–13.8 landed)
- Elements should make active feed time worth ~1.5–2× bare tapping, and runs must STILL dominate
  per-minute income (§11 rules everything).
- The unlock prices are the first real coin sinks outside gear — if players hit 1k followers with
  nowhere near 2.5k coins (or vice versa), retune toward "unlock lands within one session of
  hitting the follower gate."
- PERFECT should be hittable by a focused human ~half the time at base speed; tune `windowPerfect`
  (not payouts) first if PostHog shows all-MISS waves.
- Watch all-PERFECT rate + FLOW rate in PostHog — those are the dopamine spikes; instrument both.
- (§13.7) A full rail sweep should pay ≈ one all-PERFECT Beat Sync wave per FRESH card. If
  PostHog shows players scroll-sweeping without tapping (sweeps high, taps/card low), lower
  `railReactionMult` first, never the sweep flourish. Combo resets on swipe — the rail payouts
  are deliberately what makes swiping worth that loss.
- (§13.8) VIRAL is the session heartbeat: target 1–3 triggers per active minute mid-game. If it's
  rarer, raise `viralExitCombo` (shorter climb); if it's constant, lower it. Instrument viral
  triggers/session and sweep rate alongside the §13.2 spikes.

## 15. TEB sessions — the node-sequence framework (Phase 16; design in `12`, types in `03` §6.6)

The TEB-launched, full-area minigame loop. **Supersedes** the auto-spawn element waves (§13.2),
which are paused. A session = hold-to-charge → node sequence → reward, then a launch cooldown.
Reward is paid in the same currency family as elements (coins/followers/likes via the
`post*Conversion` constants), so it folds into per-minute income — and **runs must still dominate**
(§11). All constants below are **starting placeholders to sim-tune**, not final balance.

### 15.1 The charge (move `hold_charge`)
```
elapsed       = (now - pressedAt) / 1000
ringScale     = chargeStartScale + (chargeEndScale - chargeStartScale) * clamp01(elapsed / chargeShrinkSec)
chargeQuality = clamp01(1 - |ringScale - 1| / chargeTolerance)   // 1.0 = ring matches TEB exactly
```
- Scale `1.0` = TEB's size = the target. Releasing dead-on → `chargeQuality = 1`; outside
  `chargeTolerance` → `0`. A zero charge still launches the sequence (charge is a multiplier, never
  a gate). No release by `elapsed >= chargeShrinkSec` → auto-release at `chargeQuality = 0`.

### 15.2 The sequence (`tap_three`) speed
```
elapsedSec   = (completedAt - startedAt) / 1000        // startedAt = nodes appeared
speedQuality = clamp01((parSlowSec - elapsedSec) / (parSlowSec - parFastSec))
completion   = nodesDone / totalNodes                  // 1.0 on full clear; <1 on timeout
```

### 15.3 The combined payout
```
chargeMult = chargeMultMin + (chargeMultMax - chargeMultMin) * chargeQuality
speedMult  = speedMultMin  + (speedMultMax  - speedMultMin)  * speedQuality
comboMult  = 1 + min(combo, comboCap) * comboPerTap     // same combo formula as elements (§13.1)
k          = sessionBasePayout * chargeMult * speedMult * completion * comboMult * viralMult(viralUntil)

coins      = tapPower * postCoinConversion     * multiplier * k
followers  = tapPower * postFollowerConversion * followerConversion * multiplier * k
likes      = tapPower * postLikeConversion     * multiplier * k
```
Session does NOT reset combo; it reads the current combo/VIRAL. The ceiling (perfect charge +
lightning speed + full clear) should land in the band of a great BEAT SYNC all-PERFECT wave.

### 15.4 Starting constants (`BALANCE.teb` — sim-tune)
```ts
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
}
```

### 15.5 Tuning guidance
- A focused human should clear `tap_three` near `parFastSec` maybe a third of the time; tune
  `parFastSec`/`parSlowSec` (not payouts) first if PostHog shows all-slow finishes.
- A dead-on charge should be hittable ~half the time; tune `chargeTolerance` first if PostHog shows
  mostly zero-charge launches.
- Watch sessions/active-minute and median (chargeQuality, speedQuality) in PostHog. If sessions
  out-earn an equivalent minute of runs, cut `sessionBasePayout` first — §11 rules everything.
- `cooldownSec` paces the loop: too short and it crowds out runs; too long and the FYP feels dead
  between sessions (tapping still fills the gap, but the launch is the dopamine beat).

## 16. TEB Rhythm Canvas (Phase 17; design in `13`, types in `03` §6.6)

Phase 17 keeps the Phase 16 charge multiplier but replaces a sequence-wide speed grade with
per-interaction rhythm judgements. All chart kinds share one payout formula and one ceiling.

### 16.1 Timing quality

```text
absErrorMs = abs(actualAt - targetAt)

timingQuality(error) =
  1                                               when error <= perfectWindowMs
  lerp(1, greatQuality, inverseLerp(perfectWindowMs, greatWindowMs, error))
  lerp(greatQuality, 0, inverseLerp(greatWindowMs, goodWindowMs, error))
  0                                               when error > goodWindowMs
```

Judgement labels are derived from final interaction quality, not raw timing alone:

```text
PERFECT quality >= perfectQuality
GREAT   quality >= greatQuality
GOOD    quality > 0
MISS    quality = 0
```

### 16.2 Per-kind quality

```text
tapQuality = timingQuality(pointerDownAt - hitAt)

holdIntegrity = heldInsideTargetMs / holdDurationMs
holdQuality   = 0.30*timingQuality(pointerDownAt - hitAt)
              + 0.45*holdIntegrity
              + 0.25*timingQuality(pointerUpAt - releaseAt)

linksFraction = linksCompleted / totalLinks
gestureControl = clamp01(1 - backtrackDistance / max(idealPathDistance, 1))
swipeQuality   = 0.25*timingQuality(pointerDownAt - hitAt)
               + 0.45*linksFraction
               + 0.30*gestureControl

traceQuality = 0.20*timingQuality(pointerDownAt - hitAt)
             + 0.55*distanceWeightedPathCoverage
             + 0.25*timingQuality(pointerUpAt - releaseAt)
```

Pointer sampling frequency must not change a score. Hold integrity is integrated over elapsed
time, swipe control uses geometric distance, and trace coverage uses fixed path-distance buckets.

### 16.3 Session quality and reward

```text
performanceQuality = weightedMean(interactionQuality, interactionWeight)
completion         = resolvedRequiredUnits / totalRequiredUnits
rhythmComboMult    = 1 + min(maxRhythmCombo, rhythmComboCap) * rhythmComboPerHit

chargeMult      = chargeMultMin + (chargeMultMax - chargeMultMin) * chargeQuality
performanceMult = performanceMultMin
                + (performanceMultMax - performanceMultMin) * performanceQuality
feedComboMult    = 1 + min(feedCombo, comboCap) * comboPerTap

k = rhythmBasePayout
  * chargeMult
  * performanceMult
  * completion
  * rhythmComboMult
  * feedComboMult
  * viralMult(viralUntil)

coins     = tapPower * postCoinConversion * multiplier * k
followers = tapPower * postFollowerConversion * followerConversion * multiplier * k
likes     = tapPower * postLikeConversion * multiplier * k
```

Interaction weights are `tap=1`, `hold=1.5`, `swipe link=0.75`, `trace=2`. These normalize chart
complexity; they do not multiply payout directly. A chart with more DOM objects must not pay more
merely because it contains more objects.

### 16.4 Starting constants (`BALANCE.teb.rhythm` — sim/playtest tune)

```ts
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
  hitRadiusPx: 46,          // forgiving invisible radius around the 72px disc
  holdRadiusPx: 52,
  holdBreakGraceMs: 100,
  swipeNodeRadiusPx: 46,
  swipeMaxLinkMs: 780,
  traceRadiusPx: 42,
  traceSampleCount: 48,     // fixed-distance samples, not pointer-event samples
  maxPointerSamples: 96,    // telemetry/debug cap; raw samples never leave client

  trailPointCap: 10,
  trailFadeMs: 220,
  resultGraceMs: 1400,
  layoutAttempts: 40,

  rhythmBasePayout: 3,
  performanceMultMin: 0.5,
  performanceMultMax: 1.8,
  rhythmComboCap: 4,
  rhythmComboPerHit: 0.025, // max ×1.10; feedback matters more than payout
}
```

`perfect charge × perfect performance × max rhythm combo = 11.88 × gainPerPost` before the
existing feed-combo/VIRAL multipliers. This stays below Phase 16's 16× ceiling and the dormant
BEAT SYNC 17× reference band while preserving LIVE as the primary active-income loop.

### 16.5 Tuning rules

- Tune interaction windows/radii from human MISS rates before touching payout.
- Target first-encounter completion: `tap_three >= 85%`, `hold_pulse >= 75%`,
  `swipe_chain >= 70%`, `trace_arc >= 65%`.
- Target focused-player PERFECT/GREAT share after five attempts: 45–70%; all-PERFECT should be a
  celebration, not the median outcome.
- Compare each chart independently against bare tapping, dormant elements, and LIVE income per
  minute. If a chart exceeds LIVE, lower `rhythmBasePayout`; do not make controls less responsive.
- Chart duration plus the existing 18s launch cooldown controls frequency. Do not add per-chart
  cooldowns or unequal reward multipliers in Phase 17.

## 17. Phase 18 opening economy and pacing (`14` §A–E)

Phase 18 overrides §1 for the fresh opening: quick TEB taps grant Followers only. Coins and Likes
do not ride along with the tap. After `video_fyp`, later chapters may introduce additional payout
sources explicitly; they must never appear merely because legacy §1 code still runs.

### 17.1 Starting constants (`BALANCE.onboarding`)

```ts
onboarding: {
  studioFollowers: 20,
  minorFollowerGoal1: 700,
  minorFollowerGoal2: 1200,
  rhythmFollowers: 2400,
  videoFypFollowers: 10000,

  baseFollowerChance: 0.25,
  audienceReach: {
    baseCost: 10,
    costGrowth: 1.8,
    followerChanceAddPerLevel: 0.20,
  },
  engagementRate: {
    baseCost: 18,
    costGrowth: 1.9,
    fillAddPerLevel: 0.25,
  },
  engagement: {
    cap: 100,
    baseFillPerTap: 1,
  },

  goalCoins: {
    unlockStudio: 10,          // exactly Audience Reach Lv1
    buyAudienceReach: 18,      // exactly Engagement Rate Lv1
    reach700: 20,
    ownThreeFypLevels: 35,
    reach1200: 40,
  },
  tapThreeCoins: {
    completionBase: 12,
    qualityBonusMax: 8,
  },
}
```

These are Phase 18's first playable calibration, not sacred final values. Change them only as one
coherent table in docs/code/simulation; do not lower thresholds piecemeal to make a reveal fire.

### 17.2 TEB and upgrade formulas

```text
followerChance = min(1,
                 baseFollowerChance
                 + audienceReachLevel × audienceReach.followerChanceAddPerLevel)

followerGain = random() < followerChance ? 1 : 0

engagementPerTap = engagement mechanic unlocked
                  ? engagement.baseFillPerTap
                    + engagementRateLevel × engagementRate.fillAddPerLevel
                  : 0

engagementFill' = min(engagement.cap, engagementFill + engagementPerTap)

openingUpgradeCost(baseCost, growth, currentLevel)
  = round(baseCost × growth^currentLevel)
```

Opening taps do not apply `postCoinConversion`, `postLikeConversion`, feed combo, VIRAL, catalog,
or passive-income modifiers. `audience_reach` must change Follower chance only;
`engagement_rate` must change engagement fill/tap only. This separation is what makes each purchase
legible.

### 17.3 Ordered Creator Goals

| Goal | Requirement | Coins | Reveal |
|---|---:|---:|---|
| `meet_teb` | 10 taps | 0 | — |
| `unlock_studio` | 20 total Followers | 10 | Creator Studio + Coins |
| `buy_audience_reach` | Audience Reach Lv1 | 18 | Engagement Rate + Audience Reach Lv2+ |
| `reach_700` | 700 total Followers | 20 | — |
| `own_three_fyp_levels` | 3 total opening-upgrade levels | 35 | — |
| `reach_1200` | 1,200 total Followers | 40 | — |
| `unlock_rhythm` | 2,400 total Followers and prior goals complete | 0 | engagement meter + TAP THREE |
| `complete_first_rhythm` | 1 TAP THREE completion | chart payout | repeatable Coin loop |

The ordered requirement is mandatory: a player above 10,000 Followers cannot resolve every row in
one check. Resolve one goal, complete any reveal/teach, then activate the next.

### 17.4 First rhythm reward

```text
tapThreeCoins = completionBase + round(qualityBonusMax × performanceQuality)
```

`performanceQuality` is the existing clamped Phase 17 value. A completed chart therefore pays
12–20 Coins. It pays no opening Followers or Likes; those rewards would obscure the new Coin-source
lesson. Launch consumes a full engagement meter, so remove the old 18-second-only cooldown from the
opening loop. A result/animation lock may still prevent double launch.

### 17.5 Pacing simulation acceptance

Simulate at 2.0, 3.0, and 5.0 deliberate taps/second with plausible purchase choices and human
rhythm quality. The median 3 taps/second route must land inside `14` §A's time bands. No route may:

- unlock Studio without being able to buy Audience Reach Lv1;
- reach rhythm before buying at least three total FYP-upgrade levels;
- depend on random drops, idle income, legacy milestone rewards, or LIVE;
- fail to reach and complete the first TAP THREE loop after the authored upgrade path.
