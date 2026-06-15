# 08 — Onboarding & Progressive Unlocks (design spec)

Source: fourth playtest (operator, 2026-06-15), played from a **fresh save**. Three concrete
problems surfaced about the *opening minutes* of the game. This doc is the **design source of
truth** for fixing them; the atomic task list lives in `docs/05-roadmap.md` **PHASE 12**, which
references the sections here by letter.

Read order for an implementer: this doc's relevant section → the named source files → the canonical
types in `03` / numbers in `04` it points at. Do **not** re-derive design; do **not** invent balance
numbers (use the table here or `04`). Keep `03`/`04`/`06` in sync (see the checklist at the bottom).

> **Context.** Phase 11 (`docs/07-playtest-3-revamp.md`) is complete. This phase builds directly on
> the **metric-ladder unlock system** (`features/metrics/`) and the **feed-modifier system**
> (`features/feed/mods.ts`). Nothing here changes the run loop, the economy formulas, or the §11
> element redesigns — it changes the **first-run experience**: how the screen is introduced and
> paced.

---

## The three problems (operator, verbatim intent)

1. **The opening screen is dull and unguided.** First thing you see is the right idea — an empty
   screen with the button (TEB) in the center — but everything is "grey / dim / blends together /
   hard to see," and nothing tells you to tap. Fix: make the **TEB obviously the thing to press**
   (vivid resting color, not grey) and add a **very subtle** on-screen "tap to start" nudge.
2. **Everything appears at once.** After tapping a bunch, "ALL of the rest of the content appears at
   the same time." Fix: **decompose the unlock ladder** so features/HUD arrive **one at a time**,
   with **progressively higher requirements**, in a sensible order (main UI → studio → the rest).
3. **The "Duet Flow" display at the top is meaningless.** "I still don't know what it is, what it
   means, or how to interact with it." That display is the **feed-modifier banner** (`ModBanner`),
   which shows e.g. `🔁 DUET FLOW · Duet Loop: +2s flow window…` — *even when the player doesn't own
   Duet Loop.* Fix: only show modifiers the player can actually use, and reframe the banner as a
   passive video perk (with a one-time teach), not an interactive element.

---

## A — Make the TEB obviously tappable + a subtle "tap to start" nudge

**Where.** `client/src/screens/HomeFeed/TapCore.tsx`. The TEB is "The Engagement Button," the
central clicker.

**Problem (code).** At rest (combo 0) everything is grey:
- `TIER_COLORS[0]` is `var(--dim)` (`TapCore.tsx:14`) — drives the ring, button border, and glow.
- The center `♪` glyph at tier 0 is `rgba(255,255,255,0.4)` (`TapCore.tsx:598`).
- The resting box-shadow is a near-invisible `rgba(255,255,255,0.05)` (`TapCore.tsx:580`).
- The only "tap" guidance is a 9px `TAP` micro-label *inside* the button (`TapCore.tsx:606–625`)
  and a teach callout ("THE ENGAGEMENT BUTTON / TAP TO GROW YOUR CHANNEL") that only fires **after**
  the first tap (`TapCore.tsx:366–371`, rendered `:419–450`). Nothing guides you **to** the first tap.

**Design.**

A1. **Vivid resting TEB.** The button must read as "press me" at combo 0 against the dark backdrop.
   - Change the tier-0 color from grey to a brand color. Recommended ramp (heat: cool → hot as
     combo climbs):
     `TIER_COLORS = ["var(--cyan)", "var(--red)", "var(--gold)", "var(--gold)"]`
     (tier-0 cyan resting; warms to red, peaks gold — the four **skins**
     Glass/Neon/Plasma/Gold already give each tier a distinct *look*, so reusing gold for the
     top two color-steps is fine). Exact hues are tunable; the **hard requirement** is tier-0 is
     vivid, not `var(--dim)`.
   - Tier-0 glyph color (`:598`): use the resting ring color (cyan) at full opacity instead of
     `rgba(255,255,255,0.4)`, with a soft `text-shadow` glow.
   - Resting border + box-shadow (`:574–585`): give combo-0 a visible colored glow (e.g.
     `0 0 22px <restColor>55`) so the button glows before the first tap, not only after combo > 0.
   - Keep the existing idle "breathing" scale animation (`:566–570`) — it already draws the eye;
     pairing it with the vivid color is the point.

A2. **Pre-tap "tap to start" nudge (very subtle).** Before the very first tap (`lastTapAt === 0`),
   show a small, low-opacity, *looping* cue near the TEB — a pulsing down-chevron + `TAP TO START`
   in `var(--font-mono)` (~9px, opacity ~0.55), breathing in place. Auto-hide the instant the
   player taps (it keys off `lastTapAt === 0`, which flips on first `engageTap`). Keep it understated
   per the operator ("very subtle tho"). Reuse the motion/feel of the existing `SwipeUpHint`
   (`HomeFeed/index.tsx:464`) or the TEB teach callout.
   - Keep the post-first-tap "THE ENGAGEMENT BUTTON" teach as the "what this is" reveal — the nudge
     gets you to tap; the teach explains it once you have.

**Acceptance.** From a fresh save (use the reset-progress action), the TEB is immediately
eye-catching (vivid color + glow + breathing) and a subtle pulsing "tap to start" cue is visible;
the cue disappears on the first tap; the color still ramps with combo. `pnpm typecheck`; preview
screenshot before/after.

---

## B — Progressive, one-at-a-time unlock ladder

**Problem.** The unlock catalog is too coarse, and one flag — `feed_pager` — bundles almost the
entire FYP and unlocks it all in a single step, so the screen goes from near-empty to fully
populated at once. Ordering is also wrong: the FYP like/comment rail (which the operator wants
**early**) is bundled into that late mega-unlock.

**How unlocks work today (read this first).**
- `features/metrics/catalog.ts` — `METRIC_CATALOG`: each entry is `{ id, stat, threshold, reward,
  unlocks? }`. `stat ∈ {views, followers, streams, coinsEarned, likes}` (`views` = lifetime TEB
  taps = `viewsTotal`; `followers` = `wallet.totalFollowers`).
- `store/slices/inboxSlice.ts:138 checkMetrics()` runs every tick: any metric whose stat ≥ threshold
  and not yet in `metricsReached` is "crossed" → grants its `reward`, pushes an Inbox notification,
  and (for pillar/element unlocks) fires a `pushCelebration` popup (`:173–188`).
- `features/metrics/unlocks.ts isFeatureUnlocked(featureId, metricsReached)` — components call this
  to gate rendering. It matches a metric with `unlocks === featureId`, with a `FEATURE_TO_PILLAR`
  cascade safety-net and `FEATURE_LABELS` for display.

**Current consumers (every render gate that must be updated):**
- `HomeFeed/index.tsx:69–74` — `feedPagerUnlocked` (gates: bg video pager `:191`, swipe hint `:228`,
  `ModBanner` `:215`, `ElementStage` `:296`, engagement rail `:305`, comment one-liner `:367`),
  `goLiveUnlocked` (GO LIVE pill `:395`), `diamondsUnlocked` (💎 pill `:260`), `viewerUnlocked`
  (Studio button `:264`).
- `navigation/BottomNav.tsx:12–14` — `postingUnlocked` (the `+` Create button `:43`),
  `inboxUnlocked` (Inbox tab `:60`), `discoverUnlocked` (Discover tab `:37`). Home/Profile always on.
- `app/Shell.tsx` — renders `<BottomNav />` **unconditionally**.

**Design — split `feed_pager` into granular flags and reorder.**

New feature flags (replace the single `feed_pager`):
| flag | gates | render site |
|---|---|---|
| `fyp_video` | one real FYP video fills the backdrop behind the TEB (`VideoCanvas` seeded by `activeCard` + `VideoInfoOverlay` + relevant `ModBanner`), **no scrolling yet** — replaces the anonymous static canvas branch | `HomeFeed:220` (the `else` branch becomes the single-card view) |
| `engagement_rail` | the right-side FOLLOW / LIKE / COMMENT / SHARE rail + the canned comment one-liner | `HomeFeed:305`, `:367` |
| `feed_scroll` | drag-to-page (swipe up/down between videos) + the swipe-up hint | `HomeFeed:191` pager wrapper + `:228` hint |
| `element_stage` | the top mini-game band `<ElementStage />` + idle visualizer; **also** unlocks the Elements section in Creator Studio (don't let a player buy an element before the stage exists) | `HomeFeed:296` + `CreatorStudio` Elements section |
| `studio` (rename of `viewer`) | the 🎬 Creator Studio button | `HomeFeed:264` |
| `diamonds` | the 💎 currency pill | `HomeFeed:260` |
| `bottom_nav` | **NEW** — render `<BottomNav />` at all (so the very first screen is *just* the TEB; the nav fades in) | `Shell.tsx` wraps `<BottomNav />` |
| `posting` | the `+` Create button in the nav | `BottomNav:43` |
| `discover` | the Discover tab | `BottomNav:37` |
| `live` | the GO LIVE pill | `HomeFeed:395` |
| `inbox` | the Inbox tab | `BottomNav:60` |

**Recommended ladder (ordered, escalating).** Early gates use **`views` (raw taps)** for
predictable, economy-independent pacing; mid gates keep the **`follower`** thresholds the §11 balance
pass already tuned; late are streams/milestones. Tune exact numbers with the existing sim harness
(`client/scripts/simBalance.ts`) + a preview playthrough — but preserve the **order**.

| # | metric id | stat | threshold | `unlocks` | the player sees |
|---|---|---|---|---|---|
| 1 | `views_10`   | views     | 10  | `fyp_video`       | the blank backdrop becomes a real FYP video (gives the TEB context) |
| 2 | `views_25`   | views     | 25  | `engagement_rail` | LIKE / COMMENT / SHARE / FOLLOW appear on the right |
| 3 | `views_45`   | views     | 45  | `bottom_nav`      | the bottom navigation row fades in (Home + Profile lit) |
| 4 | `views_80`   | views     | 80  | `studio`          | the 🎬 Creator Studio button appears (buy upgrades & skills) |
| 5 | `views_140`  | views     | 140 | `feed_scroll`     | you can now swipe up/down between videos |
| 6 | `follower_50`  | followers | 50  | `diamonds`      | the 💎 diamond pill appears |
| 7 | `follower_90`  | followers | 90  | `posting`       | the `+` Create button appears in the nav (POST action) |
| 8 | `follower_120` | followers | 120 | `element_stage` | the FYP "challenge" band appears + Elements unlock in Studio |
| 9 | `follower_160` | followers | 160 | `discover`      | the Discover tab lights up (browse trends / leaderboard) |
| 10 | `follower_200` | followers | 200 | `live`         | the GO LIVE pill appears **+** GO LIVE is enabled inside Create |
| 11 | `streams_1`    | streams   | 1   | `inbox`        | the Inbox tab lights up (after the first stream) |
| 12 | `follower_1000` | followers | 1000 | *(reward only)* | +💎 milestone |
| 13 | `follower_5000` | followers | 5000 | *(reward only)* | +💎 milestone |

> **Why this order.** The operator wants the **main UI** first (video + like/comment + nav row),
> **then** the studio button, **then** the rest — exactly steps 1–4. The opening reveals come
> quickly (steps 1–4 ≈ first ~40s of tapping) then widen out, so it always feels like "one new
> thing appeared," never a dump. The creator path is then **staggered** (operator decision
> 2026-06-15) — `posting` (make a post) → `discover` (browse) → `live` (GO LIVE) arrive as three
> separate steps rather than one bundle, so each is its own "new thing." `live` keeps §11's
> follower-200 GO LIVE gate; `posting`/`discover` are their own (cheaper) direct unlocks **below**
> it — they are no longer cascaded from `live`.

> **Create sheet caveat (because `posting` now precedes `live`).** The `+` button opens
> `CreateSheet`, which contains both a POST action and a GO LIVE action. Since `posting` unlocks the
> `+` button **before** `live`, the **GO LIVE action inside the sheet must be gated by `live`**
> (locked/greyed until follower-200), so the staggering reads correctly: you can open Create and
> post first, and GO LIVE lights up there (and as the Home pill) only at step 10.

**Implementation notes.**
- `catalog.ts`: replace `METRIC_CATALOG` with the table above (keep `reward` values reasonable —
  small coins early, a few diamonds at follower milestones; mirror the existing magnitudes).
- `unlocks.ts`: add the new flags to `FEATURE_LABELS`. Every flag now has its **own** direct
  `unlocks` metric (including `posting`, `discover`, `live` — they are staggered, not cascaded), so
  the `FEATURE_TO_PILLAR` cascade is effectively unneeded — keep only `go_live → live` as an alias
  if any code still reads `"go_live"`. Remove dead `feed_pager`/`viewer` mappings (or alias
  `viewer → studio` for one version for safety).
- `HomeFeed/index.tsx`: read the granular flags; split the one `feedPagerUnlocked` block into the
  per-flag blocks per the table. The non-`feed_scroll` path must still render **one** card
  (`activeCard`) statically once `fyp_video` is up — i.e. the current `else` branch (`:220`) becomes
  the single-card view (canvas + scrim + `VideoInfoOverlay` + `ModBanner`), and `feed_scroll` adds
  the `drag`/`AnimatePresence` pager around it.
- `Shell.tsx`: gate `<BottomNav />` behind `isFeatureUnlocked("bottom_nav", metricsReached)`.
- `BottomNav.tsx`: keep Home + Profile always; gate Discover/`+`/Inbox per the table.
- **Reveal feel.** Each newly-unlocked HUD element should **animate in** (fade/scale/slide), not pop.
  Extend `checkMetrics` (`inboxSlice.ts:173`) so **every** feature unlock (not just pillars/elements)
  fires a `pushCelebration` with a fitting label (reuse `featureLabel`). The existing
  `NextMetricChip` (`HomeFeed:533`) already shows "what's next" — verify it advances correctly
  through the new ladder.
- **Gate element purchase.** In Creator Studio, hide/lock the Elements section until
  `element_stage` is unlocked, so a player can't own an element with no stage to play it on.

**Save migration (required).** `SAVE_VERSION` is currently **9** → bump to **10** in
`store/slices/meta.ts` (`PersistedV10 = Omit<PersistedV9,"version"> & { version: 10 }`; update
`PersistedState`). The metric ids change, so existing saves must not (a) lose unlocks or (b) get a
reward dump. In the v9→v10 migrate step: **re-derive `metricsReached`** by seeding it with every
*new-catalog* metric id whose threshold is already met by the persisted stats (`viewsTotal`,
`wallet.totalFollowers`, `streams`, `coinsEarned`) — **without** granting rewards (just set the
array). New crossings after load then grant normally via `checkMetrics`. Brand-new players start at
v10 with `metricsReached: []`.

**Acceptance.** From a fresh save: the screen starts as just the TEB (+ §A nudge); tapping reveals
**one** feature at a time in the order above, each with a reveal animation + celebration; the
bottom nav itself fades in (not present at t=0); no single step dumps the whole HUD; an **existing**
save loads with all previously-earned features intact and **no** reward dump. `pnpm typecheck`;
preview verified across the first several unlocks.

---

## C — Make the top "DUET FLOW" banner (feed modifiers) legible

**What it actually is.** The "Duet Flow" display the operator can't parse is the **`ModBanner`**
(`HomeFeed/index.tsx:433`, rendered at `top:56` under the stat strip). It shows the active NPC
video card's **feed modifier** from `features/feed/mods.ts` — e.g. `duet_flow`:
`🔁 DUET FLOW · "Duet Loop: +2s flow window, +1s arm timeout"` (`mods.ts:35`). A modifier is a
**passive buff** attached to whatever video is currently on screen; it boosts a specific mechanic
(a Beat Sync / Duet Loop element, TAP CORE, or the wave scheduler) while that card is up. There is
nothing to "interact with."

**Why it's confusing.**
1. **It shows buffs the player can't use.** `mods.ts:62` notes that *effects* for an unowned element
   are correctly ignored — but the **banner still renders them**. So you see "DUET FLOW · Duet Loop:
   +2s flow window…" long before Duet Loop is owned or understood. Pure noise.
2. **The label reads like an action.** A bold name + a stats string (`+2s flow window, +1s arm
   timeout`) looks like a thing to tap, not a passive perk.
3. **Name collision.** The element is **DUET LOOP**; the modifier is **DUET FLOW**; a Duet success is
   **FLOW**. Three near-identical names — the operator literally merged them. (`mods.ts:38`,
   `elements/catalog.ts:15`.)

**Design.**

C1. **Only show a modifier the player can actually use.** Gate `ModBanner` by relevance to the
   modifier's `appliesTo` (`mods.ts:10`):
   - `appliesTo: "beat_sync" | "duet_loop"` → render only if that element is in `ownedElements`.
   - `appliesTo: "core"` (`core_surge`) → always relevant (TAP CORE always exists) → show once
     `fyp_video`/`engagement_rail` is up.
   - `appliesTo: "scheduler"` (`wave_rush`) → relevant only once ≥1 element is owned (waves only
     spawn then).
   - If the current card's modifier isn't relevant, render **no banner**. (`duet_flow` then never
     appears until Duet Loop is owned — the exact fix for the operator's complaint.)

C2. **Reframe the banner as a passive "video perk."** Add a small fixed prefix tag so the role is
   unmistakable — e.g. a `THIS VIDEO` / `PERK` chip before the icon — and phrase the effect in plain
   language (the current `effectLine` is fine once it only appears for an element you own). Keep it
   visually non-interactive (it already is `pointerEvents: none`); no button affordance.

C3. **One-time "what's a perk" teach.** The first time a *relevant* modifier banner appears, show a
   one-time caption (reuse `components/TeachCaption.tsx` + a new persisted `modTeachSeen` flag,
   bumped with the §B `SAVE_VERSION`): *"Each video carries a perk that boosts your taps &
   mini-games while it's on screen."* Auto-dismiss ~3s.

C4. **Kill the name collision.** Rename the modifier's display so it doesn't echo the element. Keep
   the internal id `duet_flow`, change `name` (`mods.ts:38`) from `"DUET FLOW"` → e.g. `"LOOP BOOST"`
   (element stays **DUET LOOP**, success stays **FLOW**). Pick a non-colliding name for any other
   modifier that reads as an element name.

C5. *(Related — the element stage itself.)* The §11 work added one-time teach captions, order
   numbers, and a "TAP TEB ↓" cue to the elements. To further answer "I don't know what it is,"
   add a **persistent identity chip** at the top of `ElementStage` while a wave is active: the
   element's name + a 3–4 word how-to (e.g. `↔ DUET LOOP — core, then pod`). Small, low-opacity,
   non-interactive; it stays up for the whole wave (unlike the 3s teach). Pull the name from
   `ELEMENT_CATALOG` (`elements/catalog.ts`).

**Acceptance.** With Duet Loop **not** owned, no "Duet Flow"/loop-boost banner ever appears; with an
element owned, its modifier banner reads clearly as a passive video perk (with a one-time teach the
first time); the modifier name no longer collides with the element name; while a wave is active the
stage shows a persistent name + how-to chip. `pnpm typecheck`; preview verified (before/after of the
top-of-screen area with and without the relevant element owned).

---

## Cross-references / sync checklist (don't let docs drift)
- `04-economy-formulas.md §14.3` — the metric ladder: replace with the §B table (ids, thresholds,
  rewards, unlocks). Keep follower-50 / follower-200 / streams-1 aligned with the §11 balance pass.
- `06-ui-screens.md` — Home/FYP section: describe the progressive reveal order (§B) and the
  reframed video-perk banner (§C); note the TEB resting-color/onboarding nudge (§A).
- `03-data-model.md` — if you add `modTeachSeen` (and any persisted unlock change), reflect it in the
  persisted-state shape next to `elementsTeachSeen`.
- `SAVE_VERSION` — bump 9 → 10 with the §B migration (re-derive `metricsReached`, no reward dump) and
  the §C `modTeachSeen` flag.
- Elements/feed modifiers are client-only → **no** `client/src/party/types.ts` change needed
  (`FeedModId` already lives there; only the `name` string changes, in `mods.ts`).
</content>
</invoke>
