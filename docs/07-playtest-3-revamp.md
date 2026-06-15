# 07 — Playtest-3 Revamp (design spec)

Source: third playtest (operator, 2026-06-15). Build felt "MUCH better," but six concrete
problems surfaced. This doc is the **design source of truth** for fixing them; the atomic task
list lives in `docs/05-roadmap.md` **PHASE 11**, which references the sections here by letter.

Read order for an implementer: this doc's relevant section → the canonical types in `03` /
numbers in `04` it points at → the named source files. Do not re-derive design; do not invent
balance numbers — they're all here or in `04`.

> ⚠ **One locked decision is being deliberately reversed.** `04 §`"Keep early game fast"
> (`docs/04-economy-formulas.md:245`: *"first Gear affordable in ~5–10 posts; first LIVE viable by
> ~200 followers"*) is **overridden** by §B below. The operator has decided the early game should
> be **much slower**. This is a sanctioned change (the operator asked for it); update `04` to match
> rather than treating the old line as binding.

---

## A — Show the player's resources on every purchase screen

**Problem.** The screens where you buy things show each item's cost but **never your current
balance**, so you can't tell what you can afford or what to save for.
- `CreatorStudio/index.tsx` header is just title + close — no wallet (`CreatorStudio/index.tsx:52`).
- `UpgradeShop.tsx` and `SkillsPanel.tsx` render item rows with per-item cost color-coded
  cyan/dim, but no balance anywhere (`UpgradeShop.tsx:24`, `SkillsPanel.tsx:127`).
- The **only** place totals appear during a purchase is `ElementUnlockSheet.tsx:77` (per-element,
  one element at a time).

**The four resources** (`features/economy/types.ts`, `Wallet`): `coins`, `diamonds`, `followers`
(current), `likes`. `totalFollowers` is lifetime. All read from `channelSlice` via selectors.

**Design.** Add a **persistent currency bar** to Creator Studio, sticky so it stays visible while
the upgrade list scrolls.
- New component `components/CurrencyBar.tsx` (or extract `ProfileHeader`'s `CurrencyPill`, which
  already renders coins/diamonds at 13px with icons — `ProfileHeader.tsx:75`). Reuse that visual
  language so the game stays consistent.
- Mount it in `CreatorStudio/index.tsx` as a **sticky sub-header** directly under the title bar
  (above the scroll container at line ~131), showing **coins 🪙, followers (current), diamonds 💎**.
  Likes are not spent on upgrades → omit from this bar (keep on Profile).
- Live-updates as purchases mutate the wallet (it's a store selector — automatic).

**Nice-to-have (include if cheap):** under each buy button, an "after: N left" hint
(`cost 500 · after 4,500`) so batch decisions need no mental math. Use `formatCount()`.

**Acceptance.** Open Creator Studio on any tab → coins/followers/diamonds are visible without
scrolling; buy an upgrade → the bar's numbers drop immediately; bar stays pinned while the list
scrolls. `pnpm typecheck` passes; verified in preview.

---

## B — Rebalance: slow progression WAY down

**Problem.** "Tap for a minute or two and buy a TON of upgrades." Confirmed root cause:

### B0. The keystone bug — coins pay out 6× the spec
`balance.ts:6` has `postCoinConversion: 6.0`, but the canonical spec
`docs/04-economy-formulas.md:16` says **`1.0`**. Every base tap pays **6× the designed coins**
(`gainPerPost.coins = postPower × postCoinConversion × multiplier`, `04 §`formula at line 62).
This single value is the dominant driver: it 6×'s coin income, which 6×'s upgrade purchases, which
over-scales `tapPower`, which then over-scales **followers** (followers aren't bugged — `0.6`
matches spec — but they ride on the inflated `tapPower`). **Fix first, measure, then tune.**

> Restoring `1.0` already multiplies the effective tap-time cost of every coin-priced thing
> (gear, skills, elements) by 6×. **Do not also blindly inflate those costs** — that double-counts.
> Re-measure after B0 before touching B2/B3.

### B1. Restore the spec value (do this, then playtest)
- `balance.ts:6` → `postCoinConversion: 1.0`. (`docs/04` already says 1.0 — code was the drift.)

### B2. Additional slowdown levers (apply to taste, after B1, to hit the target table)
The operator wants it slower than even the original spec intended, so layer these:

| Lever | File | Now | Proposed | Effect |
|---|---|---|---|---|
| Repeatable cost growth — Engagement Boost | `balance.ts:140` | `1.45` | `1.75` | levels get expensive faster |
| Repeatable cost growth — Loyal Followers | `balance.ts:141` | `1.50` | `1.80` | " |
| Repeatable cost growth — Auto-Engage Bot | `balance.ts:142` | `1.60` | `1.90` | " |
| Combo multiplier ceiling | `balance.ts:93–94` | `0.005`×100 = ×1.5 | leave | already modest |
| Lucky-tap | `balance.ts:106–107` | 8% ×10 | `5%` ×`6` | fewer jackpot spikes early |

Leave one-time **gear** costs (`upgrades/catalog.ts`: Ring Light 50 → … → Viral Engine 120,000)
**as-is initially** — B1 already makes them 6× more tap-time. Only raise a specific tier if a
playtest still shows it bought too early.

### B3. Stretch the milestone gates (realigns code with `04`'s own intent)
- **GO LIVE** follower threshold: `features/metrics/catalog.ts` `follower_100` (and `04 §14.3`
  line 621) → raise **100 → 200** (matches `04:245`'s "viable by ~200 followers").
- **Element unlocks** (`balance.ts:150–190`): keep elements reachable in the **early-mid** game —
  they are the *central* FYP interaction (§C), not endgame. After B1, the current
  `50 / 200 / 300 / 450` coins effectively cost ~6× more tap-time, which is about right. Bump only
  the follower gate from `10` → **`25`** so the first element isn't unlocked on tap ~15. Do **not**
  bury them at thousands of coins.

### Target table (the goal — tune B2/B3 to land here, verify in preview/PostHog)
| Milestone | Now | Target |
|---|---|---|
| First repeatable upgrade (Engagement Boost L1) | ~3 taps | ~30–60s of active tapping |
| First gear (Ring Light) | ~1–2 min | ~3–4 min |
| First element unlocked | <1 min | ~4–6 min |
| GO LIVE (follower gate) | ~5 min | ~15–20 min |
| All 4 elements owned | <5 min | ~30+ min |

**Keep `docs/04` in sync** (it's the source of truth): update line 16 (already 1.0 — match),
the `§14.1` repeatable cost-growth table, `§14.3` follower_100→200, and the `:245` "fast early
game" line. The mismatch is what caused this; don't recreate it.

**Acceptance.** From a **fresh save** (use the existing reset-progress action), the target table
holds within tolerance; `pnpm typecheck`; `04` updated; one note in the roadmap task on final
numbers chosen.

---

## C — Fix & redesign the FYP elements

All four element mini-games render inside `ElementStage` (`ElementStage.tsx:26`), a band at
`top:88, height:30%` over the video. They are **client-only** (`elements/types.ts:1`) — no PartyKit
sync. Shared problems: positions are **fixed/identical every time**, there are **no order cues**,
and **nothing teaches the player** what to do. Fix the swipe bug, redesign swipe, and make all four
instantly legible via **random placement + numbered order + clearer affordances**.

### C0. Cross-cutting: an element "play-field" + first-time teach
- Define a **play-field** rect inside the stage band (e.g. inset ~16px L/R, clear of the right
  engagement rail and the center TEB column) that all elements lay out within. Add a small helper
  in `features/elements/` that, at wave spawn, picks **N non-overlapping positions** within the
  play-field (seeded by `startedAt` so it's deterministic per wave but varies wave-to-wave).
- Positions live **in wave state** (`ElementWave` in `03 §6.5` / `elements/types.ts`), set in
  `elementsSlice.spawnWave`, so render and grading agree. **This is a `03` data-model change — mirror it there.**
- **Order numbers:** every multi-target element renders a bold `1 / 2 / 3` in each pod so sequence
  is obvious regardless of position.
- **One-time teach per element:** mirror the existing TEB teach pattern (`TapCore.tsx:395`,
  `channelSlice.tebTeachSeen`). On the first wave of each element ever, show a 1-line caption
  ("TAP when the ring closes" / "DRAG dot → dot" / etc.), auto-dismiss ~3s, persisted flag per
  element (extend the persisted teach-seen set; bump `SAVE_VERSION` + migration).

### C1. SWIPE HITS → "TRACE" (start-point → end-point drag) — *redesign, not a patch*

**Why redesigned, not fixed.** The operator: *"the swipe/arrows mechanic literally doesn't work
at all."* Confirmed bugs in `SwipeHitsWave.tsx`: `onPointerDown` early-returns
`if (resolved || !isActive) return;` **before** setting `startPosRef` (`:140`), so a press that
lands a hair before the arrow activates never records a start point → the release no-ops; and
up/down arrows fight the FYP's vertical feed-swipe. Direction-guessing from a free swipe is also
the wrong interaction here.

**New design (operator's idea).** Each hit is an explicit **traced drag** between two anchors:
- Spawn a **start dot** and an **end dot** at two random play-field positions (a visible dotted
  line / chevrons between them shows the path). The start dot pulses "FROM"; the end dot is the
  target "TO".
- Player **presses the start dot and drags to the end dot, releases**. Grade by: pressed within
  the active window **and** released within `hitRadius` of the end dot. Optional PERFECT vs OK by
  release distance / timing; off-target or expired = MISS.
- This removes direction ambiguity and the feed-scroll conflict (an anchored drag from a specific
  dot is unmistakably an element gesture; keep `e.stopPropagation()` + `setPointerCapture`).
- Multiple traces per wave use the **numbered order** (trace 1, then 2) so the path sequence reads.

**Data-model / state.** Replace the `swipe_hits` wave's `arrows:[{dir}]` with
`traces:[{ id, from:{x,y}, to:{x,y}, grade? }]` (update `elements/types.ts` + `03 §6.5`). Rework
`elements/swipeHits.ts` (`detectSwipeDir` → `isOnTarget(release, to, radius)`), `elementsSlice`
spawn/resolve, and rebuild `SwipeHitsWave.tsx` to render dots+path+drag. Keep the countdown ring
as the per-trace timer. New balance: `hitRadiusPx`, keep `staggerSec`/`activeSec`/payouts.

**Acceptance.** Unlock the element in preview → a trace wave spawns with two on-screen dots and a
visible path; pressing the start dot and dragging to the end dot grades a hit and pays the wallet;
releasing off-target grades MISS with a shake/flash; vertical drags no longer page the feed.

### C2. BEAT SYNC (timing / closing rings) — random placement + order numbers

This is the most intuitive element (rings visibly close in), so it's the **template** for the
others — just two changes:
- **Random, non-overlapping positions** per wave instead of the fixed centered flex row
  (`BeatSyncWave.tsx:35`). Use the C0 play-field + positions-in-state.
- **Order number in each ring** (`1/2/3`) so the player knows the tap order even when scattered.
- Keep the closing approach ring (`BeatSyncWave.tsx:90`) — it's the readable part. Consider
  relaxing `windowPerfect` `0.08 → ~0.12` (`balance.ts:155`) for touch latency (the ~0.11s window
  today is tight on mobile).

**Acceptance.** Successive beat waves appear in different spots; each ring shows its order number;
the approach ring still drives grade; tapping in order pays out.

### C3. DUET LOOP (alternating) — the confusing one: make the call-and-response legible

**Problem (operator):** *"I never would've figured out this one. We need to differentiate the
buttons from the previous element, the order, and that the player must tap TEB in between each."*
**TEB = "The Engagement Button"** — the central clicker (`01 §10.1`; `TapCore.tsx:416`). The duet
mechanic is **call-and-response**: tap TEB → a pod arms → tap that pod → tap TEB → next pod arms →
… (`feedSlice` arms the next pod on a core tap; chain of 6 taps in `flowSec` = FLOW). Today nothing
communicates the "return to TEB between pods" rule, and the pods look just like Beat Sync's.

**Design — four fixes:**
1. **Visually differentiate from Beat Sync.** Give duet pods a distinct shape/skin (e.g. squared/
   hex pods or a different accent — duet = magenta/`--red`↔cyan beam, beat = pure cyan rings) so
   the two never read the same. Differentiate via icon too (a "↔"/loop glyph vs beat's pulse).
2. **Order numbers + random placement** (C0), same as Beat Sync.
3. **Alternating "which is next" light** (operator's suggestion): the **next** pod and the **TEB**
   pulse **in alternation** — TEB lights → tap it → the armed pod lights → tap it → TEB lights …
   so the back-and-forth is shown, not assumed. The energy beam already links pod→core
   (`DuetLoopWave.tsx:93`); make it bidirectional and have TEB itself glow when it's TEB's turn.
4. **Explicit "TAP TEB" cue between pods.** When the chain expects a core tap (no pod armed yet),
   render a short caption/arrow pointing at the TEB ("↓ TAP TEB"). Today the first pod shows no
   label until after the first core tap (`DuetLoopWave.tsx:156`) — pre-arm, show the TEB cue
   instead of dead pods.

**State.** Needs TEB to be able to glow/pulse on the duet beat — surface "TEB's turn" from
`elementsSlice`/`feedSlice` (the armed/awaiting-core state already exists: `armedIndex === null &&
completed < pods`) and read it in `TapCore.tsx`. Positions/order numbers as C0.

**Acceptance.** A duet wave is visibly different from a beat wave; pods are numbered; on spawn the
TEB pulses with a "TAP TEB" cue; tapping TEB arms pod 1 (which now pulses); the TEB↔pod alternation
is visible through the whole chain; a first-time player can complete it without prior knowledge.

### C4. HOLD DROP — fix the input + a more interesting application

**Problem (operator):** *"doesn't seem to work either, and could use a more interesting
application."* Likely input issue: the hold button `setPointerCapture`/`pointerUpHold`
(`HoldDropWave.tsx:113`) can collide with the TEB's own press handling and the overcharge auto-WEAK
fires with no warning (`elementsSlice` grades WEAK at `progress>=1` silently). The mechanic is also
just "release in a static 35–65% band."

**Design.**
- **Fix input first:** confirm in preview that press→hold→release on the pod registers (grade
  paid). Ensure the hold pod sits above the pager and owns its pointer; verify capture/release
  pairing.
- **More interesting application — "HOLD TO HYPE, release on the peak":** the charge ring fills,
  but the **target window is a moving/narrowing sweet-spot** (or a 2-stage "charge through the
  zone, release at the crest"). Tie the payout to a **burst** that scales with closeness to the
  crest, and (thematically) give a small **hype/combo** kick on a perfect drop so it feels like
  "dropping the beat" for the stream. Add a **pre-overcharge warning** (ring pulses red as it
  approaches 100%) so WEAK never feels random.
- Keep it a single target (its simplicity is fine) but make the timing **expressive**, not static.
  New balance under `balance.ts:172` for the moving window if used (e.g. `windowDriftSec`,
  `crestBonus`).

**Acceptance.** Press-hold-release reliably grades and pays; an overcharge is visibly telegraphed
before WEAK; a perfect release triggers a burst (and the hype/combo kick) that reads as a payoff;
the window is no longer a fixed static band.

---

## D — Fill the blank background (videos + livestream)

**Problem (operator):** big empty background "both in videos and while live streaming"; the screen
feels empty. Cause: `VideoCanvas.tsx` is the only thing behind everything and it's sparse — **3
drifting blobs + 2 faint lines + one near-invisible topic word** (`opacity 0.05`), under a dark
scrim (FYP `0.48`, Live `0.55`). The center stage (≈40% tall × 70% wide on FYP; the whole
hype-meter→hotbar band on Live) is mostly that scrim. The element/HUD changes in §C will help fill
the FYP center, but the backdrop itself needs density.

**Design — layer ambient content behind the gameplay (transform/opacity only, no fps regression):**
1. **Densify `VideoCanvas`:** add a second procedural layer — a subtle CRT **scanline/grid overlay**
   (1px lines, opacity ~0.03, intensifies a touch during VIRAL/high hype) and **more, varied blobs
   or pulsing energy rings** that react to `combo`/`hype`. Bump the topic text opacity `0.05 →
   ~0.10` with a faint glow so `#topic` actually reads (`VideoCanvas.tsx:167`).
2. **Idle Element Stage = a beat visualizer.** When no wave is active, the top-30% band is empty
   (`ElementStage.tsx`). Render a gentle **equalizer/visualizer** (bars or rings that breathe with
   `combo`/idle) so the zone is never dead and hints "this is where the action happens."
3. **Live stage ambient (the bigger empty one):** the `LiveFeed` comment column hugs bottom-left
   only (`LiveFeed.tsx:252`), leaving center+right blank but for occasional `HeartRain`.
   - Add **drifting `+follower` / `+coin` motes** rising from the gift-collect zone, fading out —
     reinforces the economy loop and fills the void.
   - Add a thin **right-edge live-stats ticker** (recent follows/likes, viewer sparkles) to fill
     the open right gutter.
   - Optional faint **"stream window" frame** (2px inset border, low opacity) around the stage so
     it reads as a video player, plus a slim **STREAM TIME** progress bar under the hype meter
     (data already exists: `clockSec`/`durationSec`).

Keep the TEB and gameplay legible — ambient layers stay **low-opacity, behind** the scrim's
content, and use only `transform`/`opacity`/`box-shadow`.

**Acceptance.** Before/after preview of (a) a FYP video and (b) a livestream: the center no longer
reads as flat empty space; the topic word is legible; the idle element band shows motion; the live
stage shows ambient economy motes / right-edge ticker; no fps regression.

---

## E — Profile → dedicated Channel / Stats / Analytics page

**Problem (operator):** upgrades now live in Creator Studio (Phase 10.1), so the Profile should be
a **channel analytics** page, not a shop. Today `Profile/index.tsx` still renders `UpgradeShop` +
`SkillsPanel` (`Profile/index.tsx:88,90`), and the only analytics are the header's 3 stats +
a button that swaps the whole view for `CreatorInsights` (`:19`).

**Design.**
1. **Remove `UpgradeShop` + `SkillsPanel` from Profile** (they belong to Creator Studio). Keep the
   "🎬 CREATOR STUDIO ›" entry row as a link.
2. **Make Profile an analytics hub**, top → bottom:
   - **`ProfileHeader`** (avatar, @handle, bio) — keep, but expand the stat strip beyond the
     current 5. Stats that **already exist** in the store and should surface:
     `wallet.followers`, `wallet.totalFollowers` (lifetime), `wallet.likes`, `wallet.coins`,
     `wallet.diamonds`, `viewsTotal` (lifetime TEB taps), `coinsEarned` (lifetime), `streams`
     (runs completed), `passiveCoinsPerSec` / `passiveFollowersPerSec` (channelSlice). Arrange as a
     primary row (Following/Followers/Likes — TikTok-faithful) + a secondary "lifetime" row
     (Views / Total Followers / Streams) + a small "passive income" pill.
   - **Creator Insights inline** (the metric ladder) — fold `CreatorInsights` in as an in-place
     section/tab instead of a full-screen view swap, so the analytics story is one page.
   - **Creator Breakdown widget** — per-pillar status (VIEWER / POSTING / LIVE): unlocked badge +
     count of affordable upgrades (reuse the Phase 10.2 affordable-pillar selector) + skill-level
     summary.
   - **Element Portfolio widget** — which of the 4 elements are owned (`ownedElements`) with icons;
     reinforces what's available in the FYP.
   - Keep **`CloudAccountPanel`** at the bottom (account/sync, unchanged).

This is a `06-ui-screens.md §`Profile change — update that spec's Profile section too.

**Acceptance.** Profile shows **no** upgrade/skill buy UI; header shows the expanded stat set;
Creator Insights reads as part of the page; per-pillar breakdown + element portfolio render and
gate correctly; Creator Studio is reachable via its link; `pnpm typecheck`; preview verified.

---

## Cross-references / sync checklist (don't let docs drift again)
- `03-data-model.md §6.5` — element wave shapes change (swipe→trace; positions+order on
  beat/duet). Update verbatim alongside `elements/types.ts`.
- `04-economy-formulas.md` — §1 `postCoinConversion` (match 1.0), §14.1 repeatable cost-growth,
  §14.3 `follower_100→200`, line 245 "fast early game" line, element unlock gates.
- `06-ui-screens.md` — Creator Studio currency bar (§A) + Profile-as-analytics (§E).
- `SAVE_VERSION` (+ migration) — bump for new per-element teach flags (§C0) and any persisted
  metric-threshold change (§B3).
- Elements are client-only → **no** `client/src/party/types.ts` change needed.
