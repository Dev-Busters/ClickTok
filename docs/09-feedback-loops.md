# 09 — Feedback Loops (design spec)

Source: the consolidated design-skill review (`docs/clicktok_incremental_design_skill.md`, Parts 2 &
4) cross-checked against the live code (operator, 2026-06-16). The skill doc's central thesis:
ClickTok's architecture is solid but its **moment-to-moment feedback is invisible** — players buy
upgrades and can't feel the change, go live without seeing what their meta progression bought them,
and finish a run without learning that their gear made it better. This doc fixes the three
highest-leverage feedback gaps. Tasks live in `docs/05-roadmap.md` **PHASE 13** (§A/B/C below).

Read order: this doc's section → the named source files → the data shapes it points at. Don't
re-derive design; don't invent balance numbers (these tasks add **no** new economy values).

> **Scope guardrails.**
> - **No new persisted state, no `SAVE_VERSION` bump.** Everything here is ephemeral UI or derived
>   from existing state — purchase deltas are computed before/after, the loadout is `computeRunParams`
>   output, the post-run breakdown is derived from current gear/skills + `lastResult`.
> - **No economy/formula changes.** These are *display* of values that already exist.
> - These compose with the in-flight **Phase 12** (onboarding/unlocks) — independent surfaces, no
>   conflicts. Do Phase 12 first if sequencing; not a hard dependency.
> - Each new surface is a natural PostHog event site (`upgrade_purchased`, `run_started`,
>   `run_ended` — skill doc Part 7). Client telemetry is a **separate** later item; if it's already
>   in when you build these, fire the events, otherwise leave a `// telemetry:` marker. Do not block
>   on it.

---

## A — Purchase "before → after" stat feedback

**Problem.** A purchase today shows only the *coin balance* afterward (`after 4,500` —
`UpgradeShop.tsx:307`, `SkillsPanel.tsx:150`), never the **power change**. Buying Engagement Boost
silently raises `postPower`; the next tap pays 1 coin more, which reads as noise. The player can't
feel "I'm stronger now" — the skill doc's #1 fix.

**The derived stats that change** (`channelSlice`, recomputed by `recomputeStats()` after every
`buyUpgrade`/`levelSkill`): `tapPower`, `multiplier`, `followerConversion`, `passiveCoinsPerSec`.
A purchase moves one or more of these.

**Design.**

A1. **Capture the delta at purchase.** `buyUpgrade` (`store/slices/upgradesSlice.ts:30`) and
   `levelSkill` (`store/slices/skillsSlice.ts:31`) already call `recomputeStats()`. In the
   purchase handler (component side is fine), snapshot the four derived stats **before** the call
   and read them **after**, and surface the ones that changed.

A2. **Non-blocking inline feedback for repeatable upgrades + skills (DO NOT use a modal here).**
   A blocking modal after every repeatable buy kills the rapid-buy rhythm of a clicker. Instead, on
   the purchased row, flash an animated delta on the affected stat — e.g. `coins/tap 7 → 10`
   with a green `+43% 🔥` that fades after ~1.5s — and give the TEB a brief pulse so the next tap
   visibly pays more. Use the existing `FloatingTextLayer`/`pushFloatText` vocabulary and
   `formatCount()`. Map effect → stat label:
   - `postPowerAdd` / Charisma → **coins per tap** (and **followers per tap**)
   - `followerConversionAdd` / Editing → **followers per tap**
   - `passiveCoinsAdd` → **coins per second**
   - `multiplier`-affecting → **overall multiplier**

A3. **A small celebratory card only for *milestone* one-time buys** (first gear, first element —
   not repeatables). Reuse `CelebrationLayer` (`components/fx/CelebrationLayer.tsx`) with the new
   stat line, e.g. `RING LIGHT EQUIPPED · +3 post power`. Elements already celebrate on unlock
   (`inboxSlice.ts:182`) — extend that copy to name the stat/effect, don't add a second popup.

A4. **Compute "% stronger" honestly.** Percent = `(after − before) / before` on the headline stat
   for that purchase (coins/tap for power buys). If a stat didn't change, don't show it (no
   `followers/tap 5 → 5` noise — the skill doc's own mock makes that mistake).

**Acceptance.** Buying a repeatable upgrade or leveling a skill flashes a readable stat delta on
that row (`7 → 10  +43%`) and pulses the TEB; the next tap visibly pays more; a no-op stat is never
shown; first gear/first element show a one-line stat in the celebration. No modal interrupts rapid
repeatable buying. `pnpm typecheck`; preview verified.

---

## B — Pre-run loadout screen (the meta → run bridge, made visible)

**Problem.** The Create sheet's GO LIVE block shows only `~N viewers`
(`screens/Create/index.tsx`). The player never sees that their followers, Charisma, gear, and the
trend are *why* they're starting with N — so the incentive to buy gear "to make runs better" is
invisible. (Skill doc Part 4, Solution 1.)

**The data already exists.** `computeRunParams(meta, topic, trendHeat)`
(`features/livestream/computeRunParams.ts`) returns everything to show — and its body already
separates the contributions, so the breakdown is a matter of surfacing the same sub-terms:
- `startViewers` ← `baseStartViewers` + `followerSqrtCoeff·√followers` + gear adds, × `(1 +
  charismaViewersPerLevel·cha)` × gear mults × `topicMatch` (trend).
- `giftRate`, `hypeDecayPerSec` (Stagecraft reduces it), `flopFloor`, `reactions[]` (the unlocked
  reaction hotbar), `durationSec`.

**Design.**

B1. **Replace the one-line GO LIVE summary with a compact loadout panel** in the Create sheet
   (shown only when `liveUnlocked`). Sections, each with its source attributed:
   - **STARTING VIEWERS: N** — base / `+from followers` / `+from Charisma Lx` / `×trend #topic`.
   - **GIFT RATE** and **HYPE DECAY** — with the Monetization / Stagecraft contributions named.
   - **REACTIONS READY** — list `params.reactions` with their names (and, if cheap, show one
     greyed locked reaction with the gear that unlocks it, à la the skill doc mock — optional).
   - Keep it scannable (this is a bottom sheet, not a full screen); icons + short labels, not the
     verbose ASCII mock.

B2. **Refactor, don't duplicate the math.** Have `computeRunParams` (or a thin sibling
   `computeRunParamsBreakdown`) also return the **named sub-terms** it already computes internally,
   so the panel and the actual run can't drift. Keep `computeRunParams` pure (the Home/Create live
   previews call it every render — see the Phase-3.1/2.7 notes).

B3. **Modifiers are NOT shown here.** They're rolled in `startRun` (task 2.7), not in
   `computeRunParams` (which returns `modifiers: []`). Keep them a run-start reveal — they already
   render as chips on the Live screen. Do **not** move the roll earlier just for the loadout.

**Acceptance.** Opening Create (with GO LIVE unlocked) shows a loadout panel whose numbers match the
actual run start, with each number attributed to its source (followers / skill / gear / trend);
buying gear or leveling a skill changes the panel live; `computeRunParams` stays pure and the panel
can't drift from the run. `pnpm typecheck`; preview verified.

---

## C — Post-run "your channel made this better" breakdown

**Problem.** The results overlay (`screens/Live/StreamerLive.tsx:295–356`) shows grade, peak
viewers, gifts collected, and the reward breakdown — but never ties the run back to the player's
**investments**, so a good run doesn't reinforce "upgrading paid off." (Skill doc Part 4,
Solution 2.)

**Design.**

C1. **Add a "WHAT YOU BROUGHT" section** to the results overlay, below the rewards. List the gear
   and skills that were **active** this run with their headline effect (reuse the §B effect labels /
   `UPGRADE_CATALOG` + `SKILL_CATALOG` descriptions), e.g. `Charisma L1 → +7 starting viewers`,
   `Studio Lights → +X% gift rate`. Pull from current `ownedUpgrades` + `skillLevels`.

C2. **One honest headline number, not fake per-coin attribution.** Exact "this gear earned you 67
   coins" is mathematically fuzzy and can mislead. Instead compute a clean, true comparison: run
   `computeRunParams` once with the **real** meta and once with a **bare** meta (no gear, no skills,
   same followers/topic), and show the gap — e.g. `You started with 47 viewers — your gear & skills
   added +30 over a bare channel.` That's defensible and still lands the "my investments mattered"
   beat.

C3. **Motivational CTA.** End with a short line + action ("Invest in gear to earn more next time →"
   that opens Creator Studio). Keep tone consistent with the existing results copy.

C4. **Flop runs.** On a FLOP grade, soften the framing (no "you crushed it"); still show what was
   active, but lead with a forward hint ("more gear → higher starting viewers next time").

**Acceptance.** Finishing a run shows the active gear/skills with their effects + one honest
"+N viewers from your channel vs. a bare account" line + a CTA into Creator Studio; numbers are
derived (no invented attribution); flop runs read encouragingly, not punishingly. `pnpm typecheck`;
preview verified end-to-end (go live → finish → breakdown).

---

## Cross-references / sync checklist
- Source of these requirements: `docs/clicktok_incremental_design_skill.md` Parts 2 & 4 (kept as the
  research reference; this doc is the actionable spec).
- `06-ui-screens.md` — add the loadout panel (§B) to the Create section and the post-run breakdown
  (§C) to the Live/results section.
- **No** `03`/`04` change (no new types, no new numbers); **no** `SAVE_VERSION` bump (no persisted
  state); **no** `client/src/party/types.ts` change.
- The two design decisions that gate the *other* skill-doc items (NOT these three) were **resolved
  2026-06-16** and feed **Phase 14**: (1) **early pacing** — keep `07 §B`'s slow meta unlocks (GO
  LIVE stays ~15–20 min), but add a "no dead zones" layer guaranteeing a small reward beat every
  ~30–45s; (2) **video catalog** — **reopen `05` task 1.5 in full** (My Videos + passive income +
  view-buffs + multiplayer view-loop).
</content>
