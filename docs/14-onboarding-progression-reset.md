# 14 — Staged Onboarding & Progression Reset (Phase 18)

> **Why this exists.** The live Phase 17 build exposes too many systems in the opening minutes.
> Repeated TEB taps cross several thresholds back-to-back, newly visible controls are not taught,
> and the player can no longer tell what changed or why. Phase 18 replaces that opening with a
> staged incremental-game journey: one goal, one reveal, and one newly useful decision at a time.

This document is the source of truth for Phase 18. It supersedes the Phase 9 metric ladder for the
opening journey and supersedes `13`'s full-screen rhythm takeover rule. Canonical state lives in
`03` §10, pacing/economy rules in `04` §17, UI rules in `06` §13, and implementation tasks in `05`
Phase 18.

## Locked goals

1. **The opening stays sparse.** A fresh player sees TEB, a Followers readout, and one current goal.
   No video, engagement rail, captions, navigation, Coins, Likes, Diamonds, or unavailable feature
   previews appear before they become useful.
2. **One major reveal at a time.** Unlocks are an ordered journey, not independent thresholds that
   can cascade during one tapping burst. A reveal must be acknowledged and its first-use teach must
   complete before the next major reveal can fire.
3. **Every reveal changes the next decision.** New UI is never decorative. Creator Studio arrives
   with one affordable upgrade; the engagement meter arrives with a launch verb; video FYP arrives
   with its social controls.
4. **There is always one legible objective.** The current goal remains visible without opening a
   menu. It names the action, progress, and reward. Completed goals advance automatically after
   their reveal/teach, so there is no quest-log housekeeping.
5. **TEB taps award Followers only in the opening.** Coins are awarded by authored Creator Goals
   until the first minigame supplies a repeatable Coin source. Likes and Diamonds remain hidden
   until their own systems make them meaningful.
6. **Later content is dormant, not deleted.** Existing feeds, upgrades, LIVE, social, and rhythm
   charts stay in the codebase. Fresh progression simply cannot reveal them until a later authored
   journey step. Do not perform a broad content rewrite inside Phase 18.
7. **Rhythm replaces TEB, not the application.** During a minigame, TEB disappears and rhythm
   targets use its central interaction field. Every already-unlocked FYP surface remains visible.
   Controls that could steal the gesture are temporarily inert, but they do not vanish or dim.

## §A — Opening journey

Phase 18 uses ordered `OnboardingStepId`s. Only one step is active and only that step may advance.
Follower requirements read monotonic `wallet.totalFollowers`, never the spendable balance.

| Order | Step | Player objective | Reward / reveal |
|---:|---|---|---|
| 1 | `meet_teb` | Tap TEB and watch Followers grow | Teach TEB; no new surface |
| 2 | `unlock_studio` | Reach the first tuned Follower goal | Reveal Creator Studio and Coins; grant exactly enough Coins for `audience_reach` Lv1 |
| 3 | `buy_audience_reach` | Open Studio and buy the only visible upgrade | Unlock `engagement_rate` Lv1 and `audience_reach` Lv2+ |
| 4 | `reach_700` | Use the stronger TEB to reach 700 Followers | Award Coins for another FYP upgrade |
| 5 | `own_three_fyp_levels` | Buy three total levels across the two FYP upgrades | Award Coins and reinforce upgrade comparison |
| 6 | `reach_1200` | Reach 1,200 Followers | Award the final pre-rhythm Coin bundle |
| 7 | `unlock_rhythm` | Reach 2,400 Followers after prior goals | Reveal engagement meter and hold/release teach; unlock only `tap_three` |
| 8 | `complete_first_rhythm` | Complete TAP THREE once | Pay guaranteed Coins; reveal accuracy bonus and replay loop |
| 9 | `unlock_video_fyp` | Reach 10,000 Followers using taps, upgrades, and rhythm income | Transition to the current video FYP layout and begin the next progression chapter |

`unlock_studio`, `unlock_rhythm`, and `unlock_video_fyp` are **major reveals**. They may not resolve
in the same interaction or while another reveal is queued. Minor goals may award Coins or unlock an
upgrade level without adding HUD.

### Pacing targets

Tune thresholds and costs from measured human tap rate, not arbitrary round-number ladders:

- Creator Studio reveal: **2–4 minutes** of ordinary first-time play.
- First Studio purchase: within **30–60 seconds** of opening Studio; its goal reward guarantees it.
- First rhythm reveal: **8–12 minutes total**, after at least two meaningful upgrade purchases.
- First video FYP reveal: **15–25 minutes total** on the median route, after several rhythm
  completions and purchases.
- Major reveals: never closer than **three active minutes** apart in the target first session.

These are experience budgets, not AFK timers. Faster tapping and sensible purchases should matter,
but no realistic burst should skip a teach or reveal two systems at once.

## §B — Creator Goal chain

The old global metric list remains available for later achievements, but it no longer drives the
fresh opening. `ONBOARDING_GOALS` is an ordered authored catalog. Each goal has:

- one requirement (`tap_count`, `total_followers`, `upgrade_level`, `rhythm_completions`, or
  `acknowledge_reveal`);
- optional Coin reward;
- optional feature reveal;
- one short action label and one benefit statement;
- an optional first-use teach identifier.

Completion flow:

```text
progress fills → goal complete → reward lands → reveal ceremony (if any)
→ SHOW ME focus → first-use teach → next goal becomes active
```

- While a reveal is active, further progress may accumulate but no later goal resolves.
- `SHOW ME` moves focus to the exact new control. It never merely closes a generic modal.
- If the player dismisses a reveal, the new control pulses gently and the goal chip becomes
  `TRY <FEATURE>` until the first use.
- First-use teaches are one or two actions long and never cover the control being taught.
- Reloading resumes the active goal/reveal/teach exactly; it does not replay completed ceremony.

## §C — Opening economy contract

### Followers

- Quick TEB taps grant Followers and increment lifetime taps.
- Followers are the headline growth number and unlock gate. They are not spent in Phase 18.
- `audience_reach` increases the exact displayed `Followers / tap` value.

### Coins

- Hidden before Creator Studio unlocks.
- Early one-time source: deterministic Creator Goal rewards.
- First repeatable source: completing TAP THREE; completion always pays the base reward and timing
  quality adds a bonus. MISS-heavy completion can be inefficient, never zero.
- Goal rewards are budgeted so the player can buy Lv1 `audience_reach`, then make at least two
  upgrade choices before the rhythm reveal.
- Random opportunity/drop events may later add bonus Coins, but may never be required to afford a
  progression-critical purchase.

### Likes and Diamonds

- Neither is visible, earned, or referenced in opening copy.
- Likes may enter with video performance; Diamonds enter with mastery/LIVE. Their later reveal is
  outside Phase 18.

## §D — FYP upgrade disclosure

Creator Studio first opens in a special onboarding mode:

- Header + back control, one tab named **FYP**, Coin balance, and the upgrade list.
- No VIEWER/POSTING/LIVE tabs, gear, software, skills, locked cards, silhouettes, or `???` rows.
- Exactly one card is initially rendered: `audience_reach`.
- Buying `audience_reach` Lv1 reveals `engagement_rate` Lv1 and Lv2 of `audience_reach` in one
  coordinated transition. Later levels reveal through explicit requirements, not all at once.

Canonical opening upgrades:

| id | Display name | Effect | First reveal |
|---|---|---|---|
| `audience_reach` | Audience Reach | Adds Followers per quick TEB tap | Studio opens |
| `engagement_rate` | Engagement Rate | Adds engagement-meter fill per quick TEB tap | Buy Audience Reach Lv1 |

Every upgrade card must show:

- current level and next cost;
- a plain-language sentence describing the behavior it changes;
- an exact current → next value (`1.0 → 1.3 Followers / tap`, for example);
- the affected on-screen control highlighted in the purchase result;
- a locked reason only after the card has been introduced.

Do not use the current generic `postPower` copy in opening UI: it bundles unrelated outputs and
does not tell a new player what will change.

## §E — Engagement meter and first rhythm loop

The engagement meter is hidden until `unlock_rhythm`. Once revealed:

1. Quick TEB taps pay Followers and add engagement fill.
2. At full charge, TEB enters a clear `READY — HOLD` state.
3. Holding TEB starts the existing shrinking match ring; releasing launches `tap_three`.
4. Launch consumes the full meter. The meter replaces the arbitrary time-only launch cooldown.
5. Completing the chart pays Coins, TEB returns, and tapping can refill the meter immediately.

Only `tap_three` is eligible in this chapter. `hold_pulse`, `swipe_chain`, and `trace_arc` remain
dormant until later journey steps explicitly introduce and teach them. The Phase 17 shuffle bag
must therefore accept a progression-provided set of eligible charts.

## §F — Rhythm interaction-field contract

Phase 18 replaces `13` Locked Decision 2.

### What disappears

- TEB and its idle labels;
- the engagement meter only if it occupies the target field (it may collapse to a tiny edge pip);
- transient TEB float text that would obscure targets.

### What stays visible

- active video/backdrop;
- top stats and any unlocked Studio control;
- creator avatar/handle and video description;
- LIKE, COMMENT, SHARE, and FOLLOW rail;
- bottom navigation and all other already-unlocked FYP chrome.

The surrounding screen receives **no global black scrim, blur, opacity reduction, or blackout**.
A restrained local vignette/glow behind an individual target is allowed, with no full-screen layer.

### Input and geometry

- Mount rhythm inside a measured `RhythmInteractionField`, not `inset: 0` over the application.
- The field is the central free area formerly occupied by TEB. Safe areas are derived from the
  actual bounding rectangles of visible top stats, right rail, caption block, and bottom nav.
- Targets and paths may animate near chrome but may not overlap interactive hit rectangles.
- Feed paging, rail actions, navigation, and Studio opening are temporarily pointer-inert from
  count-in through result so an intended rhythm gesture cannot trigger navigation.
- Chrome remains at normal visual opacity. `aria-disabled`/input gating communicates temporary
  inactivity without visually pretending the feature disappeared.
- Result feedback anchors where TEB reforms; no generic full-screen result modal.

In the sparse pre-video layout, the same field naturally has more room. Once video FYP unlocks, the
field contracts around the TikTok chrome without changing chart rules or normalized scoring.

## §G — Special pre-video layout and FYP transition

### Pre-video Home

- Ambient background with restrained motion; no fake creator/video content.
- Followers at the top; Coins appear beside them only after Studio unlocks.
- One compact current-goal chip near an edge, never over TEB.
- TEB is the sole central interaction.
- Studio appears as a focused edge control only after its reveal.
- No bottom nav until a journey step explicitly needs navigation.

### Video FYP reveal

The transition is a chapter change, not several controls popping independently:

1. Goal completes and tapping pauses for the reveal beat.
2. The ambient background resolves into the first video card.
3. Creator identity/description and social rail enter as one taught cluster.
4. TEB remains in its established location and behavior.
5. The player performs one highlighted FYP action before normal paging/navigation unlocks.

Afterward, Home uses the existing FYP composition. Future features still follow the same ordered
goal/reveal/first-use pattern.

## §H — Persistence, reset policy, and telemetry

Persist:

- `onboardingRevision`;
- `onboardingStep`;
- completed goal IDs;
- active/dismissed reveal and completed teach IDs;
- opening upgrade levels and normal wallet totals.
- engagement-meter fill and TAP THREE completion count.

Do not infer the active opening step solely from wallet totals: that recreates cascading unlocks.

Phase 18 requires a save-version migration, but **implementation must not silently wipe live player
progress without an explicit release decision**. Build both paths:

1. a development `RESET ONBOARDING` action that preserves handle/settings and starts revision 1;
2. a migration path that preserves an existing save and marks the new opening complete.

Before release, choose either the preservation path or a one-time progression reset. Existing
gameplay code remains dormant in both cases.

Aggregate telemetry (no raw pointer paths): goal start/complete duration, reveal shown/acknowledged,
first feature use, upgrade purchase/level, engagement fills, rhythm launches/completions, and time
to video FYP. Primary pacing alarms:

- two major reveals within three active minutes;
- reveal acknowledged but feature unused for two minutes;
- player cannot afford the required first Studio purchase;
- rhythm unlocked without two prior upgrade purchases;
- more than 30 minutes active without video FYP, or less than 10 minutes to video FYP; use the full
  tap-rate simulation before changing thresholds.

## §I — Acceptance criteria

- A fresh save can tap for five minutes without any unqueued legacy metric unlock appearing.
- Only Followers are visible at start; only TEB, Followers, and the current goal are interactive.
- Studio arrives alone, points directly to its control, and contains one affordable upgrade.
- Buying the first upgrade visibly changes Followers/tap and reveals exactly the second upgrade plus
  the next level of the first.
- The rhythm unlock cannot occur before the required prior goal and upgrade progression.
- TAP THREE is the only opening chart and is the first repeatable Coin source.
- During TAP THREE, TEB disappears but every unlocked non-TEB FYP visual remains visible at normal
  brightness; chrome cannot steal rhythm input.
- The video FYP appears as one taught chapter transition, not a burst of independent metric flags.
- Reload during any goal, reveal, teach, Studio purchase, meter fill, or rhythm result resumes safely.
- Typecheck, pure progression tests, economy simulation, 320×640 and 390×844 browser QA, reduced
  motion, keyboard fallback, and console-error checks pass.
