# 13 — TEB Rhythm Canvas (Phase 17)

> **Why this exists.** Phase 16 proved the new loop: manipulate TEB, TEB clears the stage, play a
> full-area sequence, then return to the channel. Phase 17 turns that proof into a small, extensible
> rhythm-game runtime. The target feeling is the immediacy and visual readability of an osu!-style
> hit field translated into ClickTok's tapper economy and visual identity — not a copy of osu!
> assets, audio, charts, branding, or layout.

This document is the source of truth for Phase 17. Canonical types live in `03` §6.6, numbers in
`04` §16, UI rules in `06` §12, and implementation tasks in `05` Phase 17.

## Locked decisions

1. **Keep the Phase 16 launch.** Quick TEB taps always pay normal engagement. Holding after the
   cooldown starts the shrinking charge ring; releasing launches a rhythm chart. Do not add a
   radial mode picker or make ordinary tapping ambiguous in this phase.
2. **The rhythm state owns the playfield.** From count-in through result, feed paging, engagement
   rail, captions, tracker chips, top stats, and bottom navigation are hidden and non-interactive.
   The active video remains as a dim, moving backdrop so the game still feels like ClickTok.
3. **One input system, several chart kinds.** Tap, hold, swipe-chain, and trace interactions all
   flow through one Pointer Events router with pointer capture. Components render state; pure
   helpers judge it. No chart owns global listeners or mutates the wallet directly.
4. **DOM first.** React + DOM + Framer Motion remain the implementation path. Moving geometry uses
   transforms and opacity. Escalate only the trail/particle layer to Pixi after profiling shows the
   DOM misses the frame budget on target phones.
5. **Fair, readable, forgiving.** Targets never spawn under persistent safe areas, paths never
   cross the forbidden HUD zones, wrong gestures do not steal the pointer from the active target,
   and a miss continues the chart. Failure reduces quality; it does not abruptly end the session.
6. **Runs remain the primary economy.** All chart kinds share one reward band and must remain below
   LIVE income per active minute (`04` §11). Mechanical variety is not an excuse to add inflation.
7. **Original visual identity.** Borrow rhythm-game principles — approach rings, hit windows,
   slider follow, combo, judgement bursts — while using ClickTok's cyan/red chromatic split, gold
   mastery state, CRT accents, typography, and video-feed backdrop.

## §A — Session flow and chart selection

The Phase 17 session has five phases:

```text
idle/tap → charging → count_in → playing → result → idle/tap
```

- **charging:** unchanged Phase 16 TEB ring match. A quick tap still pays before the hold threshold.
- **count_in:** TEB disappears immediately on release. Feed chrome fades out over 140 ms. The chart
  title and one gesture pictogram appear for `countInMs`; three restrained pulse ticks establish
  cadence. The chart cannot receive input yet.
- **playing:** the chart owns the full phone playfield. A compact combo/quality HUD uses the top safe
  edge; everything else is targets, path, backdrop, and transient feedback.
- **result:** input locks, the final judgement blooms at center, TEB reforms from the last target,
  and the existing reward breakdown appears briefly. Feed chrome returns only after result grace.

### Selection

`pickSequence()` uses an ephemeral shuffle bag over unlocked `SequenceId`s:

- no immediate repeat when at least two charts are unlocked;
- `tap_three` is always available as the readable baseline;
- first encounter with a new chart forces that chart's short teach overlay;
- no user-facing mode picker in Phase 17 — launch should remain one fluid gesture.

All Phase 17 charts reuse the existing `element_stage` / `follower_120` framework gate. Chart
variety arrives through first-play sequencing, not another currency or Studio shop.

## §B — Input grammar

All coordinates are normalized against the **measured** rhythm playfield rectangle, not fixed
reference dimensions. The router converts pointer coordinates once and emits semantic actions.

### Pointer contract

- one active primary pointer per session; additional pointers are ignored;
- `pointerdown` on an active target calls `setPointerCapture(pointerId)`;
- `pointermove`, `pointerup`, `pointercancel`, and lost capture all route through the same reducer;
- cancellation safely records the current node as missed and releases capture;
- feed swiping and browser text selection are disabled only while `phase === "playing"`;
- use `touch-action: none` on the rhythm layer, never on the whole application;
- retain at most `maxPointerSamples` evenly thinned samples for diagnostics/trail rendering.

### Interaction kinds

#### Tap

Press the active target once. Timing is judged against `hitAt`; distance must be inside
`hitRadiusPx`. The target resolves on pointerdown for minimum latency.

#### Hold

Press inside the target near `hitAt`, remain inside `holdRadiusPx`, then release near `releaseAt`.
The visual target has three simultaneous signals: approach ring, radial hold fill, and an end-cap
ring that converges at release time. Brief excursions use `holdBreakGraceMs`; longer breaks stop
integrity accrual but do not cancel the chart.

#### Swipe chain

Press the numbered start node, keep the pointer down, and cross each following node in order.
Completed links illuminate behind the pointer. Releasing early records remaining links as misses;
crossing a future node out of order is ignored. This is the direct "swipe between nodes" verb.

#### Trace

Press the start circle and follow a curved rail while a guide bead travels along it. Progress is
continuous, not checkpoint-only: the pointer must remain within `traceRadiusPx` of the sampled path.
Coverage and timing both contribute to quality. This captures the satisfying slider-follow feeling
without reproducing osu! chart assets.

## §C — Chart catalog

Phase 17 ships four charts. Each lasts roughly 1.5–4 seconds so it punctuates the feed instead of
becoming a second LIVE mode.

| id | display | interaction | authored shape |
|---|---|---|---|
| `tap_three` | TAP THREE | tap | Existing 1→2→3, now time-authored with approach rings and judgements |
| `hold_pulse` | HOLD THE BEAT | hold | Two holds: short then long, placed far enough apart for thumb travel |
| `swipe_chain` | CONNECT | swipe | Four nodes connected by three readable, non-crossing links |
| `trace_arc` | RIDE THE LINE | trace | One S-curve or broad arc with start/end caps and a moving guide bead |

Charts are deterministic from `seed`. `buildChart(sequence, seed, rect)` returns runtime geometry
that has already passed safe-area, overlap, minimum-distance, and path-crossing validation. If a
random layout fails after `layoutAttempts`, use a known-good authored fallback layout; never render
a compromised chart.

### Deferred

- mixed charts that combine tap + hold + swipe in one session;
- difficulty tiers, user-selected charts, ranked scores, leaderboards, beatmap import;
- multi-touch chords and simultaneous targets;
- server-authored or user-authored charts;
- Pixi/WebGL rendering before a measured DOM performance failure.

## §D — Timing, judgement, combo, and result

Every resolved interaction emits a `RhythmJudgement` with a normalized `quality` in `[0,1]`.

| label | quality | visual |
|---|---:|---|
| PERFECT | `>= perfectQuality` | gold core flash, crisp ring, strongest haptic/audio |
| GREAT | `>= greatQuality` | cyan flash with restrained red chromatic echo |
| GOOD | `> 0` | white/cyan tick, no screen-scale burst |
| MISS | `0` | target collapses inward; no red full-screen punishment |

Per-kind quality:

```text
tapQuality   = timingQuality(pointerDownAt - hitAt)

holdQuality  = 0.30*startTiming
             + 0.45*holdIntegrity
             + 0.25*releaseTiming

swipeQuality = 0.25*startTiming
             + 0.45*linksCompletedFraction
             + 0.30*gestureControl

traceQuality = 0.20*startTiming
             + 0.55*pathCoverage
             + 0.25*endTiming

performanceQuality = weightedMean(all resolved interaction quality)
completion         = resolvedRequiredUnits / totalRequiredUnits
```

`gestureControl` rewards crossing links without excessive backtracking; it must not reward raw
pointer sampling rate. `pathCoverage` is distance-weighted along the rail, not frame-count-weighted.

The in-chart combo is ephemeral and separate from the feed's economy combo:

- PERFECT/GREAT increments rhythm combo;
- GOOD preserves it;
- MISS resets it;
- it affects only feedback and the small `rhythmComboMult` ceiling in `04` §16, never feed combo;
- the feed combo is read once at resolve exactly as Phase 16 does and is never reset by a chart.

## §E — Visual system

### Composition

- Keep the active video moving beneath a `rhythmBackdropOpacity` black scrim plus a subtle vignette.
- Hide all feed chrome during count-in/playing/result. Respect top/bottom safe-area insets, but use
  the width and height previously occupied by the rail and navigation.
- Persistent HUD budget: combo/quality in the top 44 px only. No boxed panels over the playfield.
- Count-in and teach copy are transient, centered, and gone before targets become active.

### Target anatomy

- **Inactive/upcoming:** dark glass disc, 1 px white edge, cyan ghost offset `(-2,0)`, red ghost
  offset `(2,0)`, low bloom.
- **Current target:** white core edge plus gold approach ring; number/glyph is code-native text or
  SVG, never baked into an image.
- **Approach ring:** begins at `approachStartScale`, contracts to target scale at `hitAt`, then
  disappears immediately. Transform/opacity only.
- **Resolved:** 90–160 ms compression, judgement word, radial sparks, and a fading after-image.
- **Missed:** quiet inward collapse and thin broken ring; avoid punitive screen shake.

### Paths and trails

- Base path: translucent near-black rail with a thin white center and separated cyan/red edge ghosts.
- Completed path: cyan-white light that fills behind the pointer; PERFECT completion ends gold.
- Pointer trail: 6–10 tapered samples with a 220 ms fade; cap DOM trail nodes at `trailPointCap`.
- The moving guide bead is bright enough to read over any video topic and has a solid dark keyline.

### Motion hierarchy

Strong motion is reserved for launch, PERFECT, chart completion, and TEB return. Upcoming targets
may breathe by at most 3% scale. Avoid perpetual rotation, floating cards, or multiple competing
glows. Honor `prefers-reduced-motion`: replace target travel/bursts with opacity and edge changes,
but preserve timing rings because they communicate gameplay.

### Audio and haptics

Phase 17 may add tiny synthesized Web Audio cues; it does **not** add real songs or copyrighted
rhythm assets. AudioContext starts only from a user gesture and must fail silently. Provide a mute
toggle in settings when audio lands. Use `navigator.vibrate` only when available and only for
PERFECT/chart-complete pulses; reduced motion does not imply muted audio, but a separate
`reducedFeedback` option disables haptics and screen flash.

## §F — State, modules, and persistence

Target module boundaries:

```text
features/teb/
  types.ts                 canonical mirrors from 03 §6.6
  charge.ts                Phase 16 launch grading
  chartCatalog.ts          chart definitions and shuffle-bag selection
  chartBuilder.ts          seeded geometry + safe-layout validation
  judgement.ts             pure timing/hold/swipe/trace quality helpers
  pointerReducer.ts        pure semantic pointer-state transitions
  reward.ts                pure Phase 17 combined payout

screens/HomeFeed/rhythm/
  RhythmPlayfield.tsx      measured full-area layer + phase composition
  RhythmHud.tsx            combo/quality only
  ApproachTarget.tsx       shared target anatomy
  HoldTarget.tsx
  SwipeChain.tsx
  TracePath.tsx
  JudgementBurst.tsx
```

Zustand owns serializable gameplay state: session phase, chart, runtime targets, judgements,
pointer summary, and result. React owns purely visual animation state. Never store DOM nodes,
PointerEvents, SVG path instances, timers, or Framer controls in Zustand.

`session`, shuffle bag, live pointer state, chart geometry, and judgements remain ephemeral.
Persist only `tebSequenceTeachSeen: Partial<Record<SequenceId, boolean>>`; bump save version 13→14
and migrate existing saves to `{ tap_three: true }` when `tebChargeTeachSeen` was already true,
otherwise `{}`. Keep `tebChargeTeachSeen` for launch teaching compatibility.

## §G — Accessibility and input resilience

- Minimum target diameter is 64 px; the active hit radius may be larger than the visible disc.
- Never encode target order or judgement by color alone: use number/glyph, line progress, and text.
- Landscape is supported but not optimized: recompute geometry from the measured rectangle.
- Keyboard fallback for development/accessibility: Space/Enter activates tap or current hold;
  arrow keys advance swipe-chain targets; trace may use a simplified checkpoint fallback. Keyboard
  scores are valid locally but tagged `inputKind: "keyboard"` in telemetry.
- `pointercancel`, tab hiding, route changes, and sheet opens resolve safely without stuck capture.
- The chart pauses when `document.visibilityState !== "visible"`; on return, show a short resume
  count-in rather than judging elapsed hidden time.
- Teach overlays demonstrate one action, accept dismissal, and never block the first playable node.

## §H — Performance, telemetry, and acceptance

### Frame budget

- target: 60 fps on a midrange mobile viewport;
- at most 12 live target/path DOM nodes plus `trailPointCap` trail nodes;
- no layout reads during pointermove after the playfield rect is captured;
- pointermove work is O(1) or O(path sample count capped by `traceSampleCount`);
- telemetry is buffered until chart resolution, never emitted per pointer sample;
- profile before introducing Pixi. The migration trigger is repeated p95 frame time >20 ms during
  `trace_arc` on the target device, not visual ambition alone.

### Telemetry

- `teb_chart_started`: sequence, inputKind, chargeQuality, viewport bucket;
- `teb_interaction_judged`: aggregate counts only at resolve (perfect/great/good/miss by kind);
- `teb_chart_resolved`: sequence, performanceQuality, completion, maxRhythmCombo, duration,
  cancelled, rewardCoins;
- no pointer coordinates or raw trails leave the client.

### Phase exit criteria

1. Quick TEB tapping remains unchanged; hold-launch still grades charge and respects cooldown.
2. Count-in cleanly hides all feed chrome, locks feed paging, and gives the chart the full safe area.
3. All four charts are playable by touch/mouse; wrong gestures and cancellation never strand state.
4. Approach rings, paths, target hierarchy, judgements, trail, and TEB return read clearly over every
   generated video palette at 390×844 and a narrow 320 px viewport.
5. Every chart resolves into the same reward band; sim proves runs remain primary per active minute.
6. Reduced-motion, muted audio, keyboard fallback, tab-hide/resume, and pointercancel are verified.
7. Typecheck, unit tests for pure judgement/layout/reward helpers, production build, and browser
   playtests pass with no relevant console warnings.
8. A five-run human playtest can identify each verb without explanation after its one-time teach;
   median MISS rate is useful for tuning but no chart is soft-lockable.
