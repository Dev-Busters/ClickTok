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

- Keep early game fast: first Gear affordable in ~5–10 posts; first LIVE viable by ~200 followers.
- Runs should out-earn ~5 min of idle by a healthy margin (runs are primary income).
- Diamonds stay scarce — they gate the few elite upgrades; ~2–10 per good run.
- If runs feel too swingy, lower `followerSqrtCoeff` variance sources and raise `flopGraceSec`.
