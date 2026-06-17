# 11 — Video Catalog (design spec)

Source: the design-skill review (`docs/clicktok_incremental_design_skill.md`, Part 5) + operator
decision **2026-06-16 to reopen the deferred task 1.5 in full.** This is the **"14B" work** — make
the FYP feel like *your growing channel*: posting a video creates a persistent asset that earns
passive income, fades over time (it "trends" then de-ranks), and carries a **buff** other players
get for viewing it (tying the single-player catalog into the existing multiplayer feed). Tasks live
in `docs/05-roadmap.md` **PHASE 15** (§A–C below).

> **Why its own doc/phase.** Unlike Phases 13/14, this introduces **new persisted state**
> (`catalogSlice.videos`), needs a **`SAVE_VERSION` bump + migration**, adds **new economy numbers**
> (passive yield curve + buff magnitudes — must go through `04` and the sim harness), and touches
> **multiplayer** (the lobby feed pool + the view-buff loop). Per the Phase 7 token-discipline rule
> ("size tasks ≤ a 6.x task; split anything bigger"), it is split into three sequential tasks.

> **Much of the groundwork already exists** — read before building:
> - `catalogSlice.ts` is a **working stub** (`videos: VideoPost[]`, `addVideo`,
>   `catalogYieldPerSec()` returns 0) kept for `FullState` shape since task 0.3.
> - `VideoPost` type is specced in `03 §4`; the yield curve in `04 §3` (`coinsPerSec ≈ postPower ×
>   0.2`, `peakAtSec ≈ 120`, ramp-then-decay, cap 50 newest).
> - `publishVideo` (`feedSlice.ts:187`) already mints a `VideoCard`, grants a publish burst, sets a
>   120s cooldown, and **broadcasts `postVideo` to the lobby** — which pools it (`party/src/lobby.ts`
>   `feedPool`, cap 50) and serves it into other players' decks. So the multiplayer *distribution*
>   exists; what's missing is **persistence, passive yield, the My-Videos UI, and the view-buff.**
> - Engagement royalties already pay the poster when others react (Phase 8.6 / `royaltyToast`).

---

## A — Catalog core: persistent posts + passive yield (`03 §4`, `04 §3`)

**Design.**
- On `publishVideo`, **also** create and store a `VideoPost` in `catalogSlice.videos` (per `03 §4`:
  `id`, `coinsPerSec`, `peakAtSec`, `postedAt`, plus topic/captionId for display). Set
  `coinsPerSec ≈ postPower × catalogYieldCoeff` and `peakAtSec ≈ 120` from new `BALANCE.catalog`
  knobs (don't hardcode).
- Implement `catalogYieldPerSec()` for real (`04 §3`): each post's effective yield **ramps to its
  peak then decays** as it "de-ranks"; sum across posts; **cap at the 50 newest** to bound loop
  cost. Fold the sum into `passiveCoinsPerSec` (`04 §2`: `passiveCoinsPerSec = Σ gear.passiveCoinsAdd
  × multiplier + catalog yield`) so it flows through idle income + the meta tick already running.
- **Persist `videos`** — add to `partialize` (`store/index.ts` / `meta.ts toPersistedState`), bump
  `SAVE_VERSION` (to whatever is current after Phase 12's 9→10 → **11**), `PersistedV11`, and a
  migrate step defaulting `videos: []` for old saves.
- **Balance via the sim harness:** the catalog is *passive* income — it must stay secondary to runs
  (`04 §11`: a run's rewards ≥ ~2× the same time idle). Tune `catalogYieldCoeff`/decay so a wall of
  posts can't out-earn active play. Record before→after in the task note.

**Acceptance.** Posting creates a persistent `VideoPost`; `catalogYieldPerSec()` ramps-then-decays
per post and feeds idle/passive income; the 50-newest cap holds; an old save migrates with
`videos: []`; sim harness still passes `04 §11`; `pnpm typecheck`; preview (post → watch passive
coins tick → reload → catalog survives).

---

## B — "My Videos" on Profile

**Design.** Add a **My Videos** section to the Profile analytics page (Phase 11 §E made Profile the
analytics hub). A grid/list of the player's posts (newest first) showing per video: topic + caption,
age, current `coinsPerSec` (with a "trending ↑ / fading ↓" indicator from the yield curve), and
lifetime earned. Include a channel-total passive line. Reuse `formatCount`, the `ProfileHeader`
visual language, and the existing avatar/topic styling. Display-only (no actions needed in this
task).

**Acceptance.** Profile shows a My Videos section listing posts with live per-video passive yield +
trending/fading state + a channel passive total; empty state reads cleanly before the first post;
`pnpm typecheck`; preview.

---

## C — View-buffs + the multiplayer view-loop

**Design (skill doc Part 5's payoff).**
- **Attach a buff to each posted video** — a short, temporary boost the *viewer* gets while/after
  watching it (e.g. `+X% coins per tap for Ns`). Define buff types + magnitudes in new
  `BALANCE.catalog` knobs (small, sim-checked). Store the buff descriptor on the `VideoCard`/
  `VideoPost` (and mirror the field in `client/src/party/types.ts` **and** `party/src/lobby.ts` —
  edit both, per CLAUDE.md).
- **Apply the buff when a card becomes the active FYP video** (the player "views" it) — a temporary
  ephemeral multiplier on tap gains, surfaced with a clear buff pill + countdown (reuse the
  VIRAL/`viralUntil` timer pattern in `feedSlice`). One active view-buff at a time; refreshing on a
  new view is fine.
- **Close the multiplayer loop:** posted videos already flow to the lobby `feedPool` and into other
  players' decks; when another player views *your* video and engages, the existing royalty path
  (Phase 8.6) pays you — extend the surfacing so the poster sees "your video got viewed/buffed N
  people" (reuse `royaltyToast`). Keep it fully functional **solo** (you get buffs from NPC/your own
  pooled videos when the socket is down — mirror the §4.4 offline-fallback ethos).
- **Telemetry:** if Phase 14 §E telemetry is in, fire `video_posted` / `video_viewed` /
  `video_buff_applied` (skill doc Part 5/7).

**Acceptance.** Each posted video carries a buff; viewing a video grants the viewer a temporary,
clearly-surfaced boost with a countdown; in two windows, B viewing A's pooled video gets the buff
and A sees the engagement/royalty; solo play still grants buffs from pooled/NPC videos with the
socket down; types mirrored in both party files; `pnpm typecheck`; two-window + solo preview.

---

## Cross-references / sync checklist
- Research source: `docs/clicktok_incremental_design_skill.md` Part 5.
- `03-data-model.md §4` — finalize `VideoPost` (+ buff descriptor); `catalogSlice` is now real, not a
  stub.
- `04-economy-formulas.md §2/§3` — catalog yield curve + cap + the new `BALANCE.catalog` knobs
  (yield coeff, peak, decay, buff magnitudes); fold into `passiveCoinsPerSec`. Sim-verify `§11`.
- `06-ui-screens.md` — Profile "My Videos" section; the active view-buff pill on the FYP.
- `SAVE_VERSION` — bump (post-Phase-12 → 11) with a `videos: []` migration (§A).
- `client/src/party/types.ts` **and** `party/src/lobby.ts` — mirror the buff field on the video card
  (§C) by hand, edited together.
- Keep it secondary to runs (`04 §11`) and fully playable solo at every step.
</content>
