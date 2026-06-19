# 12 — The TEB node-sequence framework (design LOCKED 2026-06-17)

> **Why this exists.** The FYP play area is small and the TEB (The Engagement Button) is large.
> The four auto-spawning element minigames (BEAT SYNC, DUET LOOP, HOLD DROP, SWIPE HITS) pop up in
> the cramped strip *beside* TEB — there is no room to add more mechanics that way. This spec
> replaces the "spawn a wave beside TEB" model with a **TEB-launched, full-area** model: you
> *manipulate* TEB to launch a minigame, **TEB disappears** so the minigame owns the entire play
> area, and when it resolves TEB **returns** and shows your reward.
>
> This doc sets up the **framework** + the **first move** (hold-to-charge) + the **first minigame**
> (a 3-node tap-in-order sequence). More moves, more node kinds, and re-homing the existing four
> mechanics as nodes come later (§F).

**Two decisions locked with the user 2026-06-17:**
1. **Pause the old auto-spawn elements now; re-home them later.** The scheduler stops popping waves
   beside TEB. The four element components/slices stay in the tree but **dormant** (no auto-spawn,
   no unlock CTAs). Their mechanics become node kinds in a later phase — not in this work. (§F)
2. **TEB tap always works; only the launch is gated.** A quick tap is normal engagement
   (combo / Momentum / VIRAL exactly as today). Press-and-**hold** past a threshold starts a
   charge — but only once the **launch cooldown** has elapsed. The clicker never goes dead.

**Read order for this doc:** §A the loop → §B the charge move → §C the node sequence → §D reward →
§E state/types/persistence → §F what's paused/deferred → §G acceptance & verification.
Numbers live in `04 §15`; canonical types in `03 §6.6`; tasks in `05` Phase 16.

---

## §A — The session loop (the new framework)

A **TEB session** is one launch→minigame→reward cycle. It has four phases; only one session exists
at a time (ephemeral state `session`, §E). The TEB itself is unchanged in the idle phase — you tap
it normally. Everything new hangs off **holding** it.

```
 idle/tap ──hold past threshold (cooldown elapsed)──▶ charging ──release──▶ sequence ──complete/timeout──▶ result ──auto-dismiss──▶ idle/tap
   │                                                     │                    │                              │
   └─ normal taps: combo, Momentum, VIRAL                │ shrinking ring     │ TEB hidden, full-area nodes  │ TEB back + reward banner;
      (cooldown counts down in the background)           │ around TEB         │                              │ launch cooldown starts
```

1. **idle / tap.** TEB present and fully interactive. Quick taps pay normal engagement. A launch
   is *eligible* when: the framework is unlocked (§F gate), no session is active, and
   `Date.now() >= tebReadyAt` (the cooldown clock). When eligible, a subtle "hold to charge" cue
   appears on/near TEB (only after the cooldown elapses, so it reads as "ready").
2. **charging.** Player holds TEB past `holdLaunchThresholdMs`. A large ring appears *outside* TEB
   and **shrinks inward** toward TEB's size (§B). Releasing sets a **chargeQuality ∈ [0,1]**.
3. **sequence.** On release **TEB hides** and the minigame takes the full play area (§C). The first
   minigame: three numbered circles, tap **1 → 2 → 3** as fast as possible. Completion (or timeout)
   sets a **speedQuality ∈ [0,1]** and a completion fraction.
4. **result.** TEB **returns**; a banner shows the charge grade, speed grade, and the combined
   reward (§D), which has already been paid. The **launch cooldown** (`cooldownSec`) starts. The
   banner auto-dismisses, the session clears, and we're back to idle/tap.

### The cooldown (replaces the old `nextWaveAt` idle gap)
- One ephemeral clock: `tebReadyAt` (ms epoch). Set to `Date.now() + cooldownSec*1000` when a
  session resolves (and once on framework unlock so the first launch isn't instant).
- During cooldown, **tapping is unaffected** — only hold-launch is suppressed. No dimming, no lockout.
- The "hold to charge" affordance only shows when `Date.now() >= tebReadyAt && !session`.

### Tap vs. hold disambiguation (TEB input)
Keep tapping crisp — do **not** wait to decide whether a press is a tap. On `pointerDown`, fire the
normal engagement tap immediately (as today) **and** record `pressStart`. Then:
- If the pointer lifts before `holdLaunchThresholdMs` → it was just a tap. Nothing else happens.
- If the pointer is *still down* at `holdLaunchThresholdMs` **and** a launch is eligible → call
  `beginCharge()`; the shrinking ring appears and the press is now "charging."
- Releasing while charging calls `releaseCharge()`.

So a launch press also pays its one engagement tap — intended, and it keeps tap latency at zero.
If a launch is *not* eligible (cooldown active or framework locked), holding does nothing special;
it's just a held tap.

---

## §B — The first move: HOLD-TO-CHARGE (`hold_charge`)

> **The fiction:** you "wind up" your engagement before unleashing it.

A **move** is *how* you manipulate TEB to launch. The first (and for now only) move is
`hold_charge`. Future moves (double-tap, spin, swipe-off) are deferred (§F) but the type allows them.

### Visual & timing
- On `beginCharge()`, a ring is drawn **concentric with TEB** at scale `chargeStartScale` (≈ 2.4× the
  TEB radius — clearly *outside* TEB).
- Over `chargeShrinkSec` it shrinks linearly from `chargeStartScale` → `chargeEndScale`
  (≈ 0.55× — i.e. it passes *through* TEB's size and keeps going smaller if you wait too long).
- **Scale 1.0 = exactly TEB's size.** That is the target. The goal is to release the instant the
  ring matches TEB.
- This is the same family as the dormant HOLD DROP charge ring — reuse its look/feel (rotated SVG
  ring, gold "match" glow) so it reads as familiar, but the mechanic is "match the size," not
  "hit the moving crest."

### Grading (pure fn, `features/teb/charge.ts`)
```
ringScale(pressedAt)   = chargeStartScale + (chargeEndScale - chargeStartScale) * clamp01(elapsed / chargeShrinkSec)
chargeQuality(scale)   = clamp01(1 - |scale - 1| / chargeTolerance)   // 1 = dead-on match, 0 = outside tolerance
```
- Release **near 1.0** → high `chargeQuality`. Release early (ring still big) or late (ring already
  small) → lower quality. Outside `chargeTolerance` → quality `0`.
- The ring crosses scale 1.0 at a known time; brighten it (gold) within the tolerance band so the
  player can *see* the match window, mirroring HOLD DROP's crest glow.
- **A weak/zero charge still launches the sequence** — charge is a *reward multiplier*, never a gate
  (§D). If the player never releases, `tickTebSession()` auto-releases at `chargeQuality = 0` once
  `elapsed >= chargeShrinkSec` (the ring "collapses") and launches the sequence anyway.

> **Design note — "chances of higher returns."** The user described charge as raising the *chance*
> of higher returns from the minigame. We implement this as a **deterministic** reward multiplier
> (`chargeMult`, §D) for readability and predictability — a clean dead-on charge visibly pays more.
> If literal RNG is wanted later (charge sets the *probability* of a reward tier), it's a one-line
> swap in the resolve step; flagged for the user to revisit, not assumed.

### One-time teach
First time the player enters `charging`, show a one-shot caption (reuse `TeachCaption` styling):
**"HOLD — release when the ring matches the button."** Persist a `tebChargeTeachSeen` flag so it
shows once ever (§E persistence; SAVE_VERSION bump).

---

## §C — The first minigame: NODE SEQUENCE (`tap_three`)

> **The fiction:** TEB clears the stage and your engagement "scatters" into targets you chase.

### The node system (general)
The minigame layer is a **graph of nodes**. Each node has a **kind** that defines its interaction:
- `tap` — press once. *(Built now.)*
- `hold` — press and hold (a per-node charge). *(Type reserved; deferred — will re-home HOLD DROP.)*
- `drag` — drag from this node to a target node, lock-screen style. *(Type reserved; deferred —
  will re-home SWIPE HITS; needs an edge `to` target.)*

A **sequence** (`SequenceDef`) is a named template: an ordered list of nodes. Positions are assigned
at spawn time (seeded, non-overlapping). The first sequence, **`tap_three`**, is three `tap` nodes.

### `tap_three` rules
1. On charge release, **TEB hides** and three circular buttons appear at **random, non-overlapping**
   positions across the **full play area**, labeled **1 / 2 / 3**.
2. Objective: tap them **in order 1 → 2 → 3, as fast as possible.**
3. The required node is highlighted; tapping the **wrong** node is **ignored** (no penalty, no
   advance) — forgiving, skill is in speed not precision of order.
4. A timer runs from `startedAt` (the moment the nodes appear). `speedQuality` is derived from total
   elapsed at completion vs. par times (§D).
5. **Timeout:** if not completed within `sequenceTimeoutSec`, the sequence resolves with whatever is
   done — reward scales by completion fraction (`nodesDone / total`) and `speedQuality` near 0.

### Placement (`features/teb/sequence.ts`)
- Add a **full-area** position picker (do **not** reuse the elements' strip-scoped `pickPositions`,
  which is sized to the 30%-height stage). New helper `pickNodePositions(n, nodeSize, seed)`:
  fractional `[0,1]` positions over the play-area container that holds `<TapCore/>`
  (`screens/HomeFeed/index.tsx`), with **top/bottom safe insets** so nodes never land under the top
  status row (~88px) or the bottom nav. Seeded (Mulberry32, same pattern as `playField.ts`) so the
  render is stable for the session's life.
- Render the nodes in a new `NodeSequenceLayer` (`position: absolute; inset: 0`) over the play area,
  **above** the video canvas, **below** the bottom nav, with `pointerEvents: 'auto'`.

---

## §D — The reward (charge × speed)

Both inputs factor into one payout, shown when TEB returns. Reward is paid in the **same currency
family** as the dormant elements (coins / followers / likes via the `post*Conversion` constants), so
it folds straight into the economy and the sim harness. Full numbers in `04 §15`.

```
chargeMult = lerp(chargeMultMin, chargeMultMax, chargeQuality)   // e.g. 0.5 → 2.0
speedMult  = lerp(speedMultMin,  speedMultMax,  speedQuality)     // e.g. 0.5 → 2.0
completion = nodesDone / totalNodes                              // 1.0 on full clear
comboMult  = 1 + min(combo, comboCap) * comboPerTap              // same combo formula as elements
k = sessionBasePayout * chargeMult * speedMult * completion * comboMult * viralMult(viralUntil)

coins      = tapPower * postCoinConversion     * multiplier * k
followers  = tapPower * postFollowerConversion * followerConversion * multiplier * k
likes      = tapPower * postLikeConversion     * multiplier * k
```

- `speedQuality = clamp01((parSlowSec - elapsedSec) / (parSlowSec - parFastSec))` — finish ≤
  `parFastSec` → 1; ≥ `parSlowSec` → 0 (`features/teb/sequence.ts`).
- The session reads the **current** combo/VIRAL (it does not reset combo). A perfect-charge +
  perfect-speed full clear is the session's ceiling; tune `sessionBasePayout` and the mult ranges so
  that ceiling sits in the band of a great BEAT SYNC all-PERFECT wave — and **runs still dominate
  per-minute income** (`04 §11` rules everything). Sim-verify.

### Result banner
When `phase === 'result'`, TEB is back; show a `SessionResultBanner` near TEB with:
- charge grade (e.g. `PERFECT WIND-UP` / `OK` / `EARLY`/`LATE` from `chargeQuality` bands),
- speed grade (e.g. `LIGHTNING` / `FAST` / `SLOW` from `speedQuality`),
- the total reward (`+{formatCount(coins)}` etc., reuse `pushFloatText` for the coin pop).

Auto-dismiss after a short grace (≈ 1.2s) → `dismissResult()` clears the session and starts/continues
the cooldown. Player can keep tapping TEB normally the whole time.

---

## §E — State, types & persistence

Canonical types go in `03 §6.6` (mirror verbatim). New code lives under `features/teb/` and a new
`store/slices/tebSlice.ts`. **The existing `elementsSlice` is left untouched** (dormant, §F).

### Ephemeral state (`tebSlice`, NOT persisted)
```ts
session:    TebSession | null   // the in-flight session (discriminated by phase)
tebReadyAt: number              // launch cooldown clock (ms epoch); 0 = ready
```

### `TebSession` (discriminated by phase — see `03 §6.6` for the full union)
- `{ phase: 'charging'; move: 'hold_charge'; pressedAt }`
- `{ phase: 'sequence'; sequence; chargeQuality; startedAt; nodes[]; nextIndex }`
- `{ phase: 'result'; sequence; chargeQuality; speedQuality; reward; resolvedAt }`

### Actions (`tebSlice`)
- `beginCharge()` — guard: framework unlocked, no session, cooldown elapsed → set `charging`.
- `releaseCharge()` — compute `chargeQuality` from `ringScale`, spawn nodes, set `sequence`.
- `tapNode(id)` — if `id === current target`, mark done; advance `nextIndex`; on last node, resolve.
- `tickTebSession()` — called from `channelSlice.tick(dt)` alongside `expireOrResolveWave()`:
  auto-release a dangling charge (`elapsed >= chargeShrinkSec`), auto-resolve a timed-out sequence,
  and auto-dismiss a `result` after its grace. (Mirrors how `expireOrResolveWave` self-advances.)
- `dismissResult()` — clear `session`, leave `tebReadyAt` running.
- Resolve helper pays the wallet per §D and sets `phase: 'result'` + `tebReadyAt`.

### Pure helpers
- `features/teb/charge.ts` — `ringScale(pressedAt)`, `chargeQuality(scale)`.
- `features/teb/sequence.ts` — `speedQuality(startedAt, completedAt)`, `pickNodePositions(...)`,
  the `SEQUENCE_CATALOG` (`tap_three`).
- `features/teb/types.ts` — `NodeKind`, `NodeDef`, `SequenceId`, `SequenceDef`, `TebMoveId`,
  `TebSession` (re-exported from `03 §6.6`).

### Persistence
- `session` and `tebReadyAt` are **ephemeral** — excluded from `partialize` (like `activeWave` /
  `nextWaveAt`). No save change for those.
- **One new persisted flag:** `tebChargeTeachSeen: boolean` (the §B one-time teach). Add it to the
  persisted shape, **bump `SAVE_VERSION` 12 → 13**, add a `PersistedV13` type and a migration that
  defaults it to `false` (mirror the `tebTeachSeen` / `modTeachSeen` precedent in
  `store/slices/meta.ts`). Add it to `toPersistedState`.
- **Unlock gate:** reuse the existing `element_stage` metric flag (`follower_120`) — when that flips,
  the framework is live. **No new unlock metric, no new persisted unlock field.** (The framework
  simply *replaces* what `element_stage` used to enable.)

---

## §F — What's paused now, what's deferred

### Paused this phase (kept dormant, not deleted)
- **Auto-spawn scheduler.** In `elementsSlice.expireOrResolveWave()`, the final `if (!activeWave)`
  branch that round-robin-spawns owned elements **stops spawning** (gate it off). `activeWave` stays
  `null`, so the rest of `expireOrResolveWave` is a cheap no-op. No element ever pops beside TEB.
- **Per-element unlock UI.** The element-unlock section / `ElementUnlockSheet` in
  `screens/CreatorStudio/index.tsx` is **hidden**, and the element "TRY NOW" path (14.3) is
  suppressed — players are not sold mechanics that no longer fire. The element components
  (`BeatSyncWave`, `DuetLoopWave`, `HoldDropWave`, `SwipeHitsWave`), `elementsSlice`, catalog, and
  `ELEMENT_HOWTO` all remain in the tree, untouched, for re-homing.
- `<ElementStage/>` may stay mounted for its ambient idle equalizer (harmless — it just never shows
  a wave), or be swapped for the framework's layers; implementer's call, note whichever in the
  roadmap.

### Deferred to later phases (the framework is built to accept these)
- **More moves** (`TebMoveId`): double-tap, spin, swipe-off — alternate launch gestures.
- **More node kinds:** `hold` (re-home HOLD DROP) and `drag` (re-home SWIPE HITS — needs a `to` edge
  target). The `NodeKind` union already lists them.
- **More sequences** (`SequenceId`): mixed-kind graphs, longer chains, branching, purchasable via the
  existing element-unlock economy (the `requires` pattern can be reused).
- **Re-homing the four existing mechanics** as node kinds inside sequences (then the dormant element
  code is finally retired).

---

## §G — Acceptance & verification

A session is correct when, with `element_stage` unlocked:
1. **No old waves.** Nothing auto-spawns beside TEB; no element-unlock CTAs surface. (16.1)
2. **Tap unchanged.** Quick taps pay normal engagement; combo / Momentum / VIRAL behave as before.
3. **Launch on hold.** Holding TEB past the threshold (cooldown elapsed) shows a ring that shrinks
   from large toward TEB's size; releasing near the match reads as a high charge, early/late as low.
4. **Full-area takeover.** On release, **TEB disappears** and three numbered nodes fill the whole
   play area (clear of the top row and bottom nav).
5. **Order + speed.** Tapping 1→2→3 completes; wrong-order taps are ignored; finishing faster yields
   a visibly higher speed grade.
6. **Reward = charge × speed.** On completion, TEB **returns**, the banner shows both grades and the
   paid reward; a great charge **and** fast taps pays the most.
7. **Cooldown.** After resolving, a launch can't fire again until `cooldownSec` elapses; tapping
   still works throughout.
8. **Economy.** Sim harness (`client/scripts/simBalance.ts`) confirms sessions sit in the elements'
   value band and **runs still dominate** per-minute income (`04 §11`). Old saves migrate (v12→v13);
   teach shows once.

Each Phase 16 task carries its own DoD (`05` Phase 16). Verify visible behavior in the browser
preview (`preview_*`) per the standard workflow; `pnpm typecheck` must pass.
