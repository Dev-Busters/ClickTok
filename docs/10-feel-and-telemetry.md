# 10 — Feel & Telemetry (design spec)

Source: the consolidated design-skill review (`docs/clicktok_incremental_design_skill.md`) +
operator decisions 2026-06-16. This is the **"14A" cluster** — five low-risk, mostly-independent
improvements that make the moment-to-moment game feel alive and let us *measure* it. Tasks live in
`docs/05-roadmap.md` **PHASE 14** (§A–E below). The bigger video-catalog work is its own spec
(`docs/11-video-catalog.md`, Phase 15).

Read order per task: this doc's section → the named source files → the data shapes. Don't re-derive
design; balance numbers go through the sim harness (`client/scripts/simBalance.ts`), not guesswork.

> **Scope.** §B/§C/§D/§E add **no** persisted state and **no** `SAVE_VERSION` bump. §A adds an
> *ephemeral* meter (no persistence). None change the economy formulas (§A adds one tunable bonus,
> routed through `BALANCE` + the sim harness). Composes with Phases 12/13 — independent surfaces.

---

## A — No dead zones: the Momentum beat (LOCKED decision 2026-06-16)

**Decision context.** The operator keeps `07 §B`'s deliberately **slow** meta pacing (GO LIVE stays
~15–20 min) — we are **not** speeding that up. But the skill doc's real insight stands: a player must
get a *small* rewarding beat every ~30–45s or the grind feels dead. Today the only frequent beats
are combo tier-ups and (once owned) element waves; between unlocks and while saving for an expensive
item, there are dead stretches.

**Design — a "Momentum" meter that guarantees a periodic micro-reward.**
- A slim meter (near the TEB / combo readout) **fills with active engagement** (each TEB tap + rail
  reaction adds to it) and **bleeds down while idle** (reuse the `IDLE_SEC` idle detection in
  `TapCore.tsx`). It is **ephemeral** — resets on reload, never persisted.
- When it fills, fire a **MOMENTUM bonus**: a coin burst (a multiple of the current per-tap gain),
  a bold `pushFloatText` callout, and a brief TEB flourish — then the meter resets and refills. Tune
  the fill rate so an actively-tapping player triggers it roughly **every 30–45s**; an idle player
  never does (no AFK abuse).
- Keep it cohesive with the existing combo/VIRAL language (don't introduce a competing color
  system). It should read as "my engagement is building to something," reinforcing active play.
- **Balance:** add the knobs under `BALANCE.feed` (e.g. `momentumPerTap`, `momentumCap`,
  `momentumIdleDecayPerSec`, `momentumBonusMult`); verify the ~30–45s cadence + that the bonus is a
  *spice*, not a new dominant income source, via the sim harness (it must not break the `04 §11`
  run-dominates-income target).

**Acceptance.** Actively tapping fills a visible meter that pays a clear bonus roughly every 30–45s
with a satisfying pop; idling drains it and pays nothing; the bonus doesn't overtake runs as primary
income (sim harness still passes `04 §11`); no persisted state. `pnpm typecheck`; preview.

---

## B — Modifier strategy hints

**Problem.** Modifiers state *what* they do but not *how to play them*, so a random "+X%" never
becomes a decision (skill doc Part 5).
- Run modifiers: `MODIFIER_CATALOG` (`features/livestream/modifiers.ts`) — `name` + `description`.
- Feed modifiers: `MOD_CATALOG` (`features/feed/mods.ts`) — `icon`/`name`/`effectLine`/`appliesTo`.

**Design.**
- Add a `strategy: string` field to both `RunModifier` (`features/livestream/types.ts`) and `ModDef`
  (`mods.ts`), and author a one-line playstyle hint for each (e.g. Trending Sound → *"Waves spawn
  fast — lean on Hype Dance, ignore trolls."*; Tough Crowd → *"Toxic but lucrative — Clapback hard;
  Charisma helps."*).
- **Display:** run-modifier chips on the Live screen (`StreamerLive.tsx`) reveal the hint (tap-to-
  expand or a small secondary line); the feed-mod banner shows it inline. **Fold the feed-mod hint
  into Phase 12 §C** (that task already reframes the banner as a "video perk" — add the strategy line
  there rather than touching the banner twice).

**Acceptance.** Every run modifier and feed modifier has a strategy hint visible where it's shown;
feed-mod hint lands inside the Phase 12 §C banner rework; `pnpm typecheck`; preview.

---

## C — Element "TRY NOW"

**Problem.** After unlocking an element it just enters the round-robin spawn queue — the player
waits ~`waveIdleGapSec` with nothing to do, breaking the "I bought it, let me try it" loop (skill
doc Part 2).

**Design.** In `ElementUnlockSheet.tsx` `handleUnlock`, on a successful `unlockElement`, offer a
**TRY NOW** path: close the sheet, ensure the Home tab, and **immediately `spawnWave(def.id)`** so a
wave of the just-bought element appears at once. (The scheduler pauses while a sheet is open —
`elementsSlice.expireOrResolveWave` early-returns on `openSheet !== null` — so close first, then
spawn.) Keep a plain "CLOSE" as the alternative.

**Acceptance.** Unlocking an element with TRY NOW closes the sheet, lands on Home, and spawns that
element's wave within ~1s (no waiting for the round-robin); the wave grades/pays normally;
`pnpm typecheck`; preview.

---

## D — Gear visuals on the TEB

**Problem.** One-time gear purchases change stats but the TEB looks identical — buying gear doesn't
"look cooler" (skill doc Part 5 checklist). TEB skins today are driven by **combo tier**, not owned
gear (`TapCore.tsx`).

**Design.** Add a **persistent owned-gear indicator** to the TEB that's independent of the combo
tier skins: read `ownedUpgrades`, filter `UPGRADE_CATALOG` to `category: "gear"`, and render a small
cosmetic cue — e.g. a tight cluster of tiny gear glyphs orbiting the button, or a faint tint/glow
whose intensity scales with gear count. **Transform/opacity/box-shadow only** (06 §3 perf rule); it
must not fight the §12 §A vivid resting color or the combo skins. Cosmetic only — no stat effect.

**Acceptance.** Owning gear visibly changes the TEB (and adding more gear adds to the cue);
no clash with the resting color / tier skins; no fps regression; `pnpm typecheck`; before/after
screenshot.

---

## E — Client-side telemetry (the measurement backbone)

**Problem.** PostHog is initialized (`main.tsx`, optional `VITE_POSTHOG_KEY`) and the **party
server** captures events (`party/src/lobby.ts`, `stream.ts`), but the **client logs zero gameplay
events** — so none of the pacing/feedback work in Phases 12–14 can be measured. Skill doc Part 7 is
the whole "iterate from data" loop.

**Design.**
- Add `client/src/lib/telemetry.ts` — a thin wrapper over `posthog-js` that **no-ops when PostHog
  isn't initialized** (mirror the existing optional-key pattern; guard so `capture` before `init`
  never warns). Single `track(event, props)` export.
- Instrument the key events from skill doc Part 7 at their natural sites:
  - `session_start` / `session_end` — App mount / `visibilitychange`+unload (reuse the cloud-sync
    visibility hook if handy).
  - `milestone_reached` — in `inboxSlice.checkMetrics` (per crossed metric; include time-since-
    session-start + wallet snapshot).
  - `upgrade_purchased` — in `upgradesSlice.buyUpgrade` / `skillsSlice.levelSkill` (id, cost, new
    stat impact — reuse the §13 §A delta).
  - `element_unlocked` (in `unlockElement`, with whether TRY NOW was used) / `element_used`
    (per wave grade in the element tap handlers).
  - `run_started` / `run_ended` — in `runSlice.startRun` / `endRun` (meta snapshot, modifiers,
    starting viewers / grade, payout).
- Keep payloads small and PII-free (handle only; no emails).

**Acceptance.** With a PostHog key set, a fresh-save playthrough emits `session_start`,
`milestone_reached` (per unlock), `upgrade_purchased`, `element_unlocked`/`element_used`,
`run_started`/`run_ended`; with no key, the wrapper is a silent no-op and the game is unaffected;
`pnpm typecheck`; verified by watching events in the PostHog live view (or a logged stub).

---

## Cross-references / sync checklist
- Research source: `docs/clicktok_incremental_design_skill.md` (Parts 2, 5, 7).
- `04-economy-formulas.md` — add the §A Momentum knobs under the feed section; note they're
  sim-verified against `§11`.
- `06-ui-screens.md` — Momentum meter (Home), gear cue on the TEB, modifier strategy hints.
- `03` types — `strategy` on `RunModifier`/`ModDef` (no persisted-state change).
- **No** `SAVE_VERSION` bump (§A meter is ephemeral; nothing else persists).
</content>
