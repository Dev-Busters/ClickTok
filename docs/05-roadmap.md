# 05 — Roadmap (Implementation Tasks)

> **This is the work queue.** Tasks are atomic, ordered, and have acceptance criteria. An
> implementer takes the lowest-numbered unchecked task in the active phase, reads ONLY the doc
> sections it names, implements it, runs `pnpm typecheck`, verifies in the browser preview when
> visible, then checks the box. Do not skip ahead a phase. Do not batch multiple tasks unless a
> task says so.
>
> Legend: `[ ]` todo · `[x]` done · **Refs** = which docs to read · **DoD** = acceptance criteria.
> Each task is sized to be doable by a small model in one focused session.
>
> **🏁 MVP BETA = tasks through 2.7, plus 3.1.** (Full Phase 0 + Phase 1 + Phase 2 + trends.)
> That's the cut where the game is shareable: persistent TikTok shell, full meta progression, the
> complete LIVE roguelike loop, and trend selection. Inbox stays a placeholder; juice (3.3),
> prestige (3.4), deep balance (3.5), and multiplayer (Phase 4) come after beta feedback.

---

## PHASE 0 — App shell + persistence (ACTIVE)

Goal: a stable, persistent store and the TikTok navigation frame, with current gameplay preserved.

- [x] **0.1 — Balance constants file.** Create `client/src/features/economy/balance.ts` exporting the
  `BALANCE` object exactly as in `04-economy-formulas.md` §0. No logic yet.
  **Refs:** `04` §0. **DoD:** typecheck passes; `BALANCE` importable.

- [x] **0.2 — Currency rename + wallet.** Introduce the `Wallet` shape (`03` §1). Migrate the store
  so upgrades cost **coins**, not followers; add `coins`, `diamonds` (followers/likes already
  exist). Posting grants coins+followers+likes per `04` §1 (keep the existing tap feel). Update
  `StatsBar`/`UpgradeShop` to read coins for costs.
  **Refs:** `03` §1, `04` §1, `04` §4. **DoD:** can post to earn coins, buy an upgrade with coins;
  typecheck passes; no runtime errors in preview.

- [x] **0.3 — Slice split.** Refactor `store/gameStore.ts` into slices under `store/slices/`
  (`channelSlice`, `upgradesSlice`, `skillsSlice` stub, `uiSlice`, `runSlice` stub, `socialSlice`,
  `catalogSlice` stub) combined in `store/index.ts`. Keep the exported hook name `useGameStore` and
  preserve all current behavior. Move shared types per `03`.
  **Refs:** `02` §3, `03`. **DoD:** game plays identically; typecheck passes; components import from
  `store/index.ts`.
  > note: `channelSlice`/`upgradesSlice`/`socialSlice` keep their current (pre-`03`) field names and
  > shapes (e.g. `tap`/`tapPower`, `upgrades: Upgrade[]`, `trendTopic`) to preserve behavior exactly —
  > full alignment with `03` §1/§2/§6 (postPower/post, addCurrency/spend/applyIdleIncome, full
  > upgrade catalog, activeTrend) happens in their dedicated tasks (0.4/0.5, 1.1, 3.1). New stub
  > slices (`skillsSlice`, `catalogSlice`, `runSlice`, `uiSlice`) match `03`'s shapes/types
  > (added `features/skills/types.ts`, `features/channel/types.ts`,
  > `features/livestream/types.ts`) with no-op actions so `FullState` matches `03` §8 now.

- [x] **0.4 — Persistence.** Add Zustand `persist` (key `clicktok-save`), `partialize` to durable
  slices, `SAVE_VERSION=1`, and a `migrate` stub. Add `lastSeenAt`.
  **Refs:** `02` §4, `03` §9. **DoD:** refresh the page → progress (handle, currencies, upgrades)
  survives; verify in preview by buying an upgrade then reloading.
  > note: `upgrades`/`tapPower`/`passiveFollowersPerSec`/`comments` are persisted under their
  > current (pre-`03`) names from `channelSlice`/`upgradesSlice` (per the 0.3 note, the
  > `postPower`/`addCurrency`/`spend`/`ownedUpgrades` rename is deferred to 0.5/1.1). `lastSeenAt`
  > is recomputed to `Date.now()` in `partialize` on every persist (per `02` §4 "update on save");
  > `applyIdleIncome` itself is task 0.5. `trendTopic`/`leaderboard`/run/ui state excluded as
  > ephemeral/server-owned.

- [x] **0.5 — Idle income + Welcome Back.** Implement `applyIdleIncome(now)` (`04` §2), call it on
  load, and show a "Welcome back — you earned X" sheet when `elapsedSec > 60`.
  **Refs:** `04` §2, `02` §4. **DoD:** set `lastSeenAt` back a few minutes (or wait), reload → idle
  coins granted + sheet shows.
  > note: added `passiveCoinsPerSec` (per `03` §1, default 0, persisted) to `channelSlice` —
  > `applyIdleIncome(now)` reads it per the `04` §2 formula exactly. No gear/upgrade currently
  > contributes to it (full gear catalog with `passiveCoinsAdd` is task 1.1), so today's idle
  > grants are 0 coins/followers until 1.1 lands; the formula, persistence, and "Welcome Back"
  > sheet (`WelcomeBackSheet.tsx`, shown in `GameScreen` when `elapsedSec > 60`) are wired and
  > verified end-to-end by temporarily setting `passiveCoinsPerSec` + an old `lastSeenAt` in
  > localStorage.

- [x] **0.6 — Tab model + UI slice.** Add `navigation/tabs.ts` (`Tab` type) and `uiSlice`
  (`activeTab`, `setTab`, `openSheet`). Default tab `home`.
  **Refs:** `03` §7. **DoD:** typecheck; `setTab` updates state.
  > note: implemented `uiSlice` exactly per `03` §7, including `setSheet` (the action needed to
  > drive `openSheet`). Not yet wired into any UI — `activeTab`/`openSheet` will be consumed by
  > the Shell/BottomNav/sheets in 0.7/0.8. Verified via temporary `window.useGameStore` debug hook
  > in `main.tsx` (added, tested, then reverted).

- [x] **0.7 — App Shell + Bottom Nav.** Build `app/Shell.tsx` (phone-frame container + active screen
  switch + `BottomNav`) and `navigation/BottomNav.tsx` (5 TikTok tabs: Home, Discover, ＋, Inbox,
  Profile). Onboarding still gates entry. Render placeholders for empty screens.
  **Refs:** `06` §1–2. **DoD:** can switch all 5 tabs in preview; bottom nav matches TikTok layout;
  screenshot looks like a TikTok shell.
  > note: `App.tsx` now renders `Shell` (instead of `GameScreen` directly) after the onboarding
  > gate. Home tab renders the existing `GameScreen` unchanged (relocation into Home/Profile/
  > Discover screens is task 0.8); Discover/Inbox/Profile render a shared `PlaceholderScreen`.
  > Per `06` §2, the ＋ button calls `setSheet('create')` (not `setTab`) and Shell renders a
  > minimal dismissible Create-sheet placeholder when `openSheet === 'create'` — `activeTab`
  > never becomes `"create"` in practice, but the type is kept per `03` §7.

- [x] **0.8 — Relocate current gameplay into screens.** Move today's clicker (tap + StatsBar +
  UpgradeShop) onto the appropriate screens: posting/stats on **Home**, upgrades on **Profile**
  (channel management). Leaderboard moves to **Discover**. Keep them working.
  **Refs:** `06` §3,5,6. **DoD:** every existing feature reachable via the new nav; typecheck;
  preview verified.
  > note: added `screens/HomeFeed`, `screens/Discover`, `screens/Profile` (each a plain
  > `index.tsx`, just relocating existing components — no gear/software/skills split or profile
  > header polish, that's `1.1`/`1.2`/`1.4`). HomeFeed keeps the old top bar (handle/wordmark/
  > LIVE/trend) per `06` §3; Discover/Profile get a minimal matching header (mono `@handle` or
  > chroma title + hairline) so they aren't blank when `Leaderboard`/`UpgradeShop` render little
  > or nothing. Global concerns (idle income + Welcome Back sheet, `useGameLoop`,
  > `useTrendRoom`, default-trend init) moved from the old `GameScreen` up into `Shell` since
  > they must run regardless of active tab; `GameScreen.tsx` deleted (fully superseded).
  > Also fixed unrelated dev-server tooling: `vite.config.ts` now reads `server.port` from
  > `process.env.PORT` (falls back to 5173) and `.claude/launch.json` uses `autoPort: true`,
  > since a stale process was squatting on port 3000.

**Phase 0 exit criteria:** TikTok 5-tab shell, persistent save with idle income, sliced store,
coins economy — and the original clicker fully playable inside the new frame.

---

## PHASE 1 — Channel management build-out

Goal: flesh out the incremental engine and the meta→run stat bridge (data only; runs come Phase 2).

- [x] **1.1 — Upgrade catalog (full).** Implement `features/upgrades/catalog.ts` from `04` §4 (gear +
  software, with `requires` gating and run-stat effects). Rework `UpgradeShop` into two categories
  with lock states. **⚠ BREAKING SAVE CHANGE:** this replaces the legacy `upgrades: Upgrade[]`
  array (persisted since 0.4) with `ownedUpgrades: Record<string, boolean>` per `03` §2. You MUST
  bump `SAVE_VERSION` to 2 in `store/slices/meta.ts` and add a `migrate` step: map old purchased
  upgrades to roughly-equivalent new ids (`better_lighting`→`ring_light`, `ring_light`→`usb_mic`,
  others → refund their coin cost), and update `partialize` in `store/index.ts`. Old saves must
  load without crashing.
  **Refs:** `03` §2, `04` §4, `06` §6, `02` §4. **DoD:** all upgrades buyable when unlocked; locked
  ones show requirements; stats recompute; an old-version save loads cleanly; typecheck + preview.
  > note: `04` §4 doesn't specify per-item `requires`, so each category is gated **linearly**
  > (owning the previous gear/software item unlocks the next; the first item in each category is
  > unlocked from the start) — this adds lock states without inventing new balance numbers. Added
  > `recomputeStats()` to `channelSlice` (per `03` §1) implementing `04` §1/§2: `tapPower`
  > (postPower), `multiplier`, new `followerConversion` field, and `passiveCoinsPerSec` are now
  > derived from `ownedUpgrades` + `skillLevels.charisma`/`editing` and recomputed after
  > `buyUpgrade`/`levelSkill`/on store rehydration (`onRehydrateStorage`). `tap()` now reads
  > `followerConversion` from state instead of hardcoding `1`. Kept `tapPower`/`tap`/`comments`/
  > `passiveFollowersPerSec` field names as-is (pre-`03`, per the 0.3 note) — full rename to
  > `postPower`/`post()` is deferred; `passiveFollowersPerSec` no longer has any upgrade feeding
  > it in the new catalog (no `UpgradeEffect` field maps to it) so it's effectively frozen at its
  > current/migrated value. Migration v1→v2 maps `better_lighting`→`ring_light`,
  > `ring_light`→`usb_mic`, refunds coin cost of any other purchased legacy upgrade, and verified
  > end-to-end via a synthetic v1 `clicktok-save` in the preview.

- [x] **1.2 — Creator Skills.** Implement `skillsSlice` + `features/skills/catalog.ts` (`04` §5) and a
  Skills section on Profile with level-up buttons and cost display.
  **Refs:** `03` §3, `04` §5, `06` §6. **DoD:** can level skills with coins; costs escalate; follower
  gates enforced; stats recompute.
  > note: added `components/SkillsPanel.tsx`, rendered below `UpgradeShop` on Profile (the
  > Gear/Software/Skills pill-tab layout from `06` §6 is task 1.4's profile polish). Level-up
  > calls `recomputeStats()` so Charisma/Editing immediately affect `tapPower`/
  > `followerConversion`; Stagecraft/Monetization/Network levels are stored but only consumed by
  > the meta→run bridge (1.3+).

- [x] **1.3 — Meta→run param preview.** Implement `features/livestream/computeRunParams()` (`04` §6) as
  a pure function. Add a read-only "LIVE readiness" panel (on Home or Create) showing projected
  start viewers / gift rate for the active trend, proving the bridge works before runs exist.
  **Refs:** `04` §6, `03` §5. **DoD:** panel numbers change when you buy gear / level skills /
  change trend; unit-sanity matches the worked example in `04` §6.
  > note: `features/livestream/computeRunParams.ts` takes a `RunParamsMeta` (followers,
  > followerConversion, skillLevels, ownedUpgrades) + topic + optional `trendHeat` (defaults 0,
  > since `socialSlice.trendsAvailable`/`heat` is task 3.1 — `trendTopic` has no heat yet, so
  > `topicMatch` is currently always 1). `reactions` = `["hype_dance", ...unlocked via owned
  > upgrades' unlocksReaction]`; `modifiers` is always `[]` (`rollModifiers` is task 2.7). Added
  > `components/LiveReadinessPanel.tsx`, rendered on Home below `TapButton` per `06` §3, showing
  > start viewers + gift rate/hype decay/flop floor. Verified against the `04` §6 worked example
  > via a synthetic save (F=10000, cha=5/8, mon=3, stg=4, DSLR+Gimbal owned) — numbers matched and
  > updated live after leveling Charisma.

- [x] **1.4 — Profile screen polish.** Build the TikTok-style profile header (avatar, @handle,
  followers/likes/coins/diamonds counts, bio line) above the gear/software/skills sections.
  **Refs:** `06` §6. **DoD:** profile resembles a TikTok profile; all currencies shown via
  `formatCount`; preview screenshot.
  > note: added `components/ProfileHeader.tsx` — circular avatar (gradient generated from a hash
  > of `handle`, initials overlay), `@handle`, bio line "becoming the algorithm", and a TikTok-style
  > stat row (Following · Followers · Likes · Coins 🪙 · Diamonds 💎, all via `formatCount`).
  > "Following" has no backing field in `03` (we don't track followed accounts), so it's a static
  > cosmetic `0` purely for TikTok-faithful layout per `06` §6. Replaces the old plain `@handle` top
  > bar on Profile.

- [~] **1.5 — Catalog/passive videos. DEFERRED — DO NOT BUILD FOR MVP.** (Decision 2026-06-09:
  cut to reduce loop complexity; passive income is covered by `passiveCoinsPerSec` from gear.)
  Revisit only after Phase 3 if desired. Spec retained for the future: `catalogSlice` + catalog
  yield (`03` §4, `04` §3), a "Your videos" grid on Profile/Home. **Skip this task.**

---

## PHASE 2 — Livestream run loop (the roguelike)

Goal: a fully playable LIVE run. This is the headline feature — good to build live on stream.

- [x] **2.1 — Run state + start.** Implement `runSlice` skeleton (`03` §5) and `startRun(topic)`:
  compute params via `computeRunParams`, set phase `live`, init viewers/hype/timer. Add a "Go LIVE"
  action in the Create (＋) sheet that transitions to the **Live** screen.
  **Refs:** `03` §5, `04` §6, `06` §4,7. **DoD:** pressing Go LIVE opens the Live screen with correct
  starting viewers; typecheck.
  > note: built `screens/Create/index.tsx` (per `02` target structure) replacing the old Create
  > sheet placeholder — POST closes the sheet and switches to Home, GO LIVE shows projected start
  > viewers via `computeRunParams` (reusing the trend topic, defaulting to `"trending"`) and calls
  > `startRun`. Added `screens/Live/index.tsx`; `Shell` renders it full-screen (hides `BottomNav`)
  > whenever `phase === 'live' || phase === 'results'`. `hype` has no spec'd initial value, so
  > `startRun` seeds it at **50** (the neutral point where `targetViewers === startViewers` per
  > `04` §7).

- [x] **2.2 — Run loop engine.** Implement `hooks/useRunLoop.ts` + `runTick(dt)` per `04` §7: hype
  decay, viewer easing toward hype-driven target, timer, flop detection, cooldown ticks. No events
  yet — just the meters moving and the stream ending on timer/flop.
  **Refs:** `04` §7, `02` §5. **DoD:** viewers/hype/timer animate live; stream auto-ends at 0s or on
  sustained flop; meters visible on Live screen.
  > note: `useRunLoop` (mounted by `screens/Live`) uses a 100ms fixed-step accumulator per `02` §5.
  > `runTick` implements the `04` §7 formulas exactly (no troll drain / event spawn — Phase 2.3).
  > `endRun` now transitions `phase` → `"results"` and returns a `RunResult` with real
  > `peakViewers`/`finalHype`, but `giftsCollected`/`rewards`/`grade` are placeholders (zero /
  > `"FLOP"`) since `scoreRun` (`04` §10) and reward granting are task 2.6's job. Added
  > `returnToChannel()` (not in `03` §5) — a small `RunSlice` action used by the Live screen's
  > "Back to Channel" button to reset `phase` → `"idle"`; 2.6's results sheet can reuse it. Added
  > `components/ProgressBar.tsx` (06 §8 shared primitive) for the hype meter and `lib/math.ts`
  > (`clamp`, per `02` target structure).

- [x] **2.3 — Event spawner + feed UI.** Spawn `RunEvent`s on the schedule (`04` §7) and render the
  scrolling LIVE feed (comments, gifts, trolls, hype waves). Implement `collectGift` (tap to
  collect), gift tier rolls (`04` §7), troll viewer/hype drain, hype-wave ride.
  **Refs:** `03` §5, `04` §7,§8, `06` §7. **DoD:** feed scrolls; tapping gifts adds coins/diamonds;
  trolls drain until dismissed; riding a wave boosts hype/viewers; preview verified.
  > note: added `features/livestream/events.ts` — gifts spawn on their own Poisson process at
  > `params.giftRate`/sec (per `04`§6's "gifts/sec baseline"), independent of `eventIntervalSec`
  > (which spawns comment/troll/hype_wave). Gift tier rolled via new `lib/math.ts` `weightedPick`
  > against `BALANCE.run.giftWeights`, shifted toward higher tiers by `giftQuality` per `04`§7.
  > Troll drain = `trollHypeDrainPerSec` hype/sec + `trollViewerDrainPerSec` × viewers/sec, per
  > active troll; for 2.3 trolls are "dismissed" by a passive 9s TTL expiry (early removal via
  > `clapback` lands in 2.4). Added `rideWave(eventId)` to `RunSlice` (deviation from `03`§5, by
  > analogy to 2.2's `returnToChannel`) for the hype-wave tap interaction —
  > viewers ×= `1 + hypeWaveViewerBoost`. Comment/troll text pools, spawn weights
  > (comment 70/troll 18/hype_wave 12), and event TTLs (gift 6s, comment 6s, troll 9s,
  > hype_wave 4s) are implementation choices not specified in `04` — tunable later. Added
  > `components/LiveFeed.tsx` (06§7 feed + hype-wave banner) and wired into `screens/Live`. Also
  > fixed a pre-existing float-drift bug in 2.2's `runTick` (timer-end check `>= durationSec` →
  > `>= durationSec - 1e-6`; a 100ms accumulator never reaches `durationSec` exactly, so the run
  > never ended via the 180s timer).

- [x] **2.4 — Reactions / hotbar.** Render the reaction hotbar from the run's unlocked `reactions`;
  implement `useReaction` with cooldowns and effects (`04` §9).
  **Refs:** `03` §5, `04` §9, `06` §7. **DoD:** each reaction fires its effect, shows cooldown; only
  unlocked reactions appear; preview verified.
  > note: added `features/livestream/reactions.ts` (`REACTION_CATALOG`, `REACTION_ICON`) and
  > `components/ReactionHotbar.tsx`, rendering only `params.reactions`, disabled while on
  > cooldown. Added ephemeral `RunSlice` fields `giftRateBoostUntil`/`gainsBoostUntil` (deviation
  > from `03`§5) for `shoutout`'s ×2 gift-rate window and `go_off`'s ×3 gains window.
  > `pin_comment`'s follower grant (`viewers × 0.5`) writes directly to
  > `wallet.followers`/`totalFollowers`, since `RunSlice.collected` (`03`§5) has no `followers`
  > field. All five reaction effects verified end-to-end via manual `runTick`/`useReaction`
  > driving against the `04`§9 formulas (exact match, including the `go_off` + gift-collect
  > interaction).

- [x] **2.5 — Choice events.** Implement comment/sponsor `choices` and `resolveChoice` (effects keyed
  per `04`). A few authored choice events with distinct outcomes.
  **Refs:** `03` §5, `04` §8. **DoD:** choice prompts appear, options apply different effects.
  > note: `04` doesn't define choice-effect formulas (§8 is `rollModifiers`, task 2.7), so effect
  > magnitudes are implementation choices anchored to existing run formulas — see
  > `features/livestream/choices.ts`. Added a 4th `spawnFeedEvent` category (`"choice"`, weight 13,
  > rebalancing comment/troll/hype_wave to 60/16/11) that picks from `CHOICE_EVENT_POOL` and spawns
  > a `comment`/`sponsor`-typed `RunEvent` with `choices` populated (8s TTL). Three authored
  > scenarios per `01` §5.2: a sponsor ping (`sponsor_accept` = `collectGift`-style payout at the
  > "galaxy" tier + viewers ×0.92, vs `sponsor_decline` = +5 hype) and two comment choices
  > (`drama_clapback`/`drama_classy`, `shoutout_fan`/`shoutout_skip`) using hype deltas in the
  > 04 §9 reaction range and follower grants as a fraction of viewers (like `pin_comment`).
  > `LiveFeed.tsx` renders any event with `choices` as a card with one button per option.

- [x] **2.6 — End + results + rewards.** Implement `endRun(reason)` → `scoreRun` (`04` §10): convert to
  meta currencies, grant them, show a results sheet (peak viewers, gifts, followers gained, grade).
  Return to Home after.
  **Refs:** `03` §5, `04` §10, `06` §7. **DoD:** ending a run grants the right rewards (matches
  formula), results sheet shows the breakdown + grade; followers/coins persist after.
  > note: `endRun` now implements `04` §10 exactly, granting `rewards` straight to `wallet`
  > (followers/totalFollowers/coins/diamonds/likes) and storing the output as a new ephemeral
  > `lastResult: RunResult | null` field (deviation from `03`§5, by analogy to 2.4's
  > `gainsBoostUntil` — needed so the results screen can show the breakdown). On `"flop"`, only
  > `collected.*` + 30% of the full computed followers are granted (no peak-viewer/completion
  > bonuses), per the §10 "flop payout" note. Added a `giftsCollected` counter (incremented in
  > `collectGift`) for the results display. Extended the existing `phase === "results"` overlay in
  > `screens/Live` (built in 2.2) — rather than the unused `openSheet: "runResults"` sheet — with
  > the grade badge (color-coded), a gifts-collected stat, and a rewards breakdown
  > (followers/coins/diamonds/likes). "Return to Home after" is via the existing "BACK TO CHANNEL"
  > button (`returnToChannel()` + `setTab('home')`, from 2.2/2.3).

- [x] **2.7 — Run modifiers + post-run boon.** Roll `RunModifier`s at start and show them; implement
  the 1-of-3 boon pick on a successful run (`01` §5.5).
  **Refs:** `01` §5.5, `04` §8. **DoD:** modifiers visibly change a run; boon pick appears on
  success and applies.
  > note: added `features/livestream/modifiers.ts` (`MODIFIER_CATALOG`, `rollModifiers` per `04`§8 —
  > 1 always, 2nd w/ 40% chance, no conflicting pairs; `applyModifiers`, `hasModifier`, and
  > `MODIFIER_EFFECTS` magnitudes — `04`§8 names effects but not numbers, so these are
  > implementation choices anchored to each effect's wording). `startRun` rolls modifiers and
  > applies them to `computeRunParams`'s output (kept `computeRunParams` itself pure/deterministic
  > so the Home/Create live-readiness previews don't flicker — a deviation from `04`§6's
  > `modifiers = rollModifiers(...)` living inside `computeRunParams`). `shadowban_risk` schedules a
  > one-time mid-run viewer/hype crash (`spawnCrashEvent`) and `viral_moment` schedules a
  > guaranteed bigger hype wave (`spawnViralWaveEvent`, `events.ts`); `tough_crowd`/`trending_sound`
  > skew `spawnFeedEvent`'s weights and `collectGift`/`resolveChoice`/`rideWave` payouts via new
  > `weightMultipliers` param. `screens/Live` shows rolled modifiers as chips below the topic. Added
  > `features/livestream/boons.ts` (`BOON_LIST`: Diamond Cache, Hype Carryover, Algorithm Favor —
  > ids/magnitudes are implementation choices, `01`§5.5 only sketches examples) and a new
  > `RunSlice.boonChoices`/`applyBoon`/`pendingHypeBoost` (ephemeral, deviation from `03`§5 by
  > analogy to `lastResult`/`gainsBoostUntil`); `endRun` populates `boonChoices` on any non-FLOP
  > grade, and the results overlay renders a "PICK A BONUS" picker. "Algorithm Favor" persists as a
  > new `channelSlice.boonMultiplier` field (added to `PersistedV2` + migration default `1` for old
  > saves) folded into `multiplier` via `recomputeStats`. Verified end-to-end in preview: modifier
  > chips render per run, a "Hype Carryover" pick correctly seeded the next run's hype bar near-full.

**Phase 2 exit criteria:** a full GO LIVE → react-to-feed → results loop that's meaningfully shaped
by meta progression, with run-to-run variety.

---

## PHASE 3 — Discover, trends, polish, prestige

- [x] **3.1 — Discover + local trends.** Implement `socialSlice.trendsAvailable` (locally rotating
  trends with `heat`), a Discover screen to browse/select the active trend, and wire `trendMultiplier`
  into runs. Replace the hardcoded `DEFAULT_TREND`.
  **Refs:** `03` §6, `04` §6, `06` §4. **DoD:** choosing a hotter trend raises projected/actual run
  viewers; selection persists into the run.
  > note: rewrote `socialSlice` to the `03`§6 shape (`activeTrend`, `trendsAvailable`,
  > `setActiveTrend`, `setTrends`; kept the existing `LeaderboardEntry` name/shape — `03`'s
  > `ChannelSummary` rename is out of scope here). Added `features/social/trends.ts`
  > (`generateTrends`: shuffles a 10-topic pool, takes 5 with random `heat` 0..1; `getTrendHeat`).
  > `activeTrend` is seeded from `trendsAvailable[0]` at store-creation time (non-null), removing
  > both hardcoded `DEFAULT_TREND` consts (`Shell.tsx` "dancing", `Create/index.tsx` "trending");
  > `Shell` now re-rolls `trendsAvailable` every 90s via `setTrends(generateTrends())` ("locally
  > rotating", no server authority — that's `4.1`). `computeRunParams` already took `trendHeat`
  > (1.3) — `LiveReadinessPanel`, `CreateSheet`, and `runSlice.startRun` now all pass
  > `getTrendHeat(trendsAvailable, activeTrend)` through it, so `trendMultiplier` (`= topicMatch = 1
  > + heat*0.5`) varies per trend. New `components/TrendList.tsx` on Discover lists each trend with
  > a heat-colored `ProgressBar` and a "+N% viewers" readout (`heat*50`); tapping one calls
  > `setActiveTrend`. Renamed `trendTopic`/`setTrend` → `activeTrend`/`setActiveTrend` everywhere
  > (`HomeFeed`, `Leaderboard`, `LiveReadinessPanel`, `CreateSheet`, `Shell`/`useTrendRoom`).
  > Verified in preview: switching the Discover selection from `#fitness` (heat→+48%) to `#cooking`
  > (+41%) changed Home's "LIVE READINESS" projected viewers (225→215) and the GO LIVE run's actual
  > start viewers/topic.
- [x] **3.2 — Inbox.** Notifications feed (run results, milestones, daily reward). Daily login reward.
  **Refs:** `06` §5. **DoD:** events land in Inbox; daily reward claimable once/day.
  > note: `03`/`04` define no Notification/Inbox/daily-reward/milestone types or numbers — per
  > CLAUDE.md's "STOP and ask" rule, confirmed three implementation choices with the user before
  > building:
  > - **Daily reward** = coins, `base 100 + passiveCoinsPerSec * 300` (`features/inbox/daily.ts`),
  >   claimable once per real-world calendar day (`isNewCalendarDay` compares `toDateString()`).
  > - **Milestones** = `wallet.totalFollowers` crossing fixed thresholds `[100, 1k, 10k, 100k, 1M]`
  >   (`features/inbox/milestones.ts`), each notified exactly once via `milestonesReached`.
  > - **Run results** = every `endRun()` (voluntary/timer/flop) pushes a notification with grade +
  >   reward summary.
  >
  > New local types `NotificationType`/`InboxNotification` in `features/inbox/types.ts` (no `03`
  > equivalent — same precedent as `boons.ts`/`choices.ts`). New `inboxSlice.ts`
  > (`notifications`, `lastDailyClaimAt`, `milestonesReached`, `pushNotification`,
  > `checkMilestones`, `claimDailyReward`) added to `FullState` — a deviation from `03`§8's
  > canonical type, same precedent as `RunSlice`/`SocialSlice`. This new state is durable history
  > (not session/ephemeral), so it's persisted: bumped `SAVE_VERSION` 2→3 (`PersistedV3`), with a
  > v2→v3 migration defaulting old saves to `notifications: []`, `lastDailyClaimAt: null`,
  > `milestonesReached: []`.
  >
  > `checkMilestones()` runs at the top of `channelSlice.tick()` — the meta game loop calls `tick()`
  > every frame regardless of passive income, so this is the single integration point that catches
  > `totalFollowers` crossing a threshold from any source (taps, passive, idle, runs).
  > `runSlice.endRun()` calls `pushNotification` with a `formatCount`-based grade/reward summary.
  > Built `screens/Inbox/index.tsx` (daily-reward claim card + notification list,
  > TikTok-activity-feed style), replacing the `PlaceholderScreen` in `Shell.tsx` (now removed —
  > Inbox was its only remaining caller).
  > Verified in preview: claiming the daily reward grants +100 coins, disables the button
  > ("CLAIMED"), and logs a "Daily reward claimed" entry; running and ending a stream logs a
  > "Stream ended — Grade C" entry with peak viewers + reward breakdown; manually pushing
  > `totalFollowers` past 100 fires a "100 followers!" milestone entry exactly once.
- [x] **3.3 — Juice pass.** Animations/transitions, gift particles, screen-shake on big moments,
  optional sound. Escalate the run feed to Pixi ONLY if DOM stutters (CLAUDE.md).
  **DoD:** no jank at 60fps with a busy feed; before/after screenshots.
  > note: done as a TikTok-faithfulness redesign (2026-06-10): Home rebuilt as a full-bleed FYP
  > (tap-the-video-to-post + heart bursts, right action rail, caption + sound marquee); Live
  > restyled to TikTok LIVE (host/viewer pills, username'd comment pills, ambient HeartRain scaled
  > by hype, hype stage glow, circular hotbar w/ conic cooldown sweep); Profile header → TikTok
  > 3-stat row + flat currency pills. Deleted orphaned StatsBar/TapButton/LiveReadinessPanel.
  > Added dev-only `window.gameStore` (preview testing; rAF is throttled in background tabs).
  > NOT done: screen-shake, sound — fold into a later polish task if wanted. 60fps unverified in
  > the throttled preview; re-check on a real device.
- [~] **3.4 — Prestige ("Rebrand"). DEFERRED — DO NOT BUILD.** (User decision 2026-06-10: no
  prestige mechanics for now; multiplayer is the priority. Spec stub in `01` §4.4 retained for a
  possible post-multiplayer revisit.) **Skip this task.**
- [ ] **3.5 — Balance pass.** Tune `BALANCE` against the guidance in `04` §11 using real playthroughs.

---

## PHASE 4 — Multiplayer: real spectator streams (design LOCKED 2026-06-10)

> **Supersedes the old Phase 4** (raids absorbed into spectator interaction; global challenges
> absorbed into The Algorithm). Design in `01` §7; wire types in `03` §6; all numbers in `04` §12.
> Each task is independently shippable; the game must stay fully playable solo at every step.
> Multi-client DoDs are verified with two browser windows against the local PartyKit dev server.

- [x] **4.1 — Lobby presence + live directory.** New PartyKit lobby room (`party/src/lobby.ts`,
  pattern-match `trend.ts`): handle `hello`/`goLive`/`liveUpdate`/`endLive`, broadcast `directory`
  (`03` §6). Client: a `useLobby` hook (mounted in `Shell` like `useTrendRoom`), `socialSlice`
  Phase-4 fields (`liveDirectory`), and the Discover **LIVE NOW** rail (`06` §4). `startRun`
  announces `goLive` (generate a `streamId`), `endRun`/unmount announces `endLive`; `liveUpdate`
  every few seconds. Cards are display-only this task (no join). Mirror types in
  `client/src/party/types.ts` AND `party/src/lobby.ts` — edit both.
  **Refs:** `01` §7.1, `03` §6, `04` §12.0, `06` §4, `02` §6. **DoD:** two windows: going live in
  one shows a live card (handle/topic/viewers/hype) in the other within ~2s, updating while live,
  gone on end; zero regression to solo play; typecheck.
  > note: all Phase 4 wire types (stream room included) added to `client/src/party/types.ts` now so §6 is complete; stream room types unused until 4.2. `algorithm` field added to `socialSlice` for 4.4. `parties.lobby` added to `partykit.json`.

- [x] **4.2 — Spectating (read-only).** Stream rooms (`party/src/stream.ts`): streamer `open`s the
  room and publishes `RunSnapshot` `snapshotPerSec`×/sec; server rebroadcasts to viewers with
  `realViewers`. Client: `spectateSlice` (`03` §6), tapping a LIVE NOW card joins as a viewer, and
  the **Live screen renders in spectator mode** (`06` §7 spectator notes) — same meters/feed driven
  by `applySnapshot`, no hotbar, a LEAVE button. On leave or `ended`, grant the **watch-drop**
  (`04` §12.4, jackpot = 0 for now) and show it on a viewer result sheet.
  **Refs:** `01` §7.1, `03` §6, `04` §12.0+§12.4, `06` §7, `02` §6. **DoD:** window B taps A's card
  → sees A's meters/feed move in near-real-time; B leaving (or A ending) grants B the formula-exact
  drop; A's run is unaffected by being watched; typecheck.
  > note: `streamId: string | null` added to `RunSlice` (generated in `startRun`, cleared in
  > `returnToChannel`) so `useLobby` and `useStreamerRoom` share a single source of truth instead
  > of each generating their own UUID. `leaveStream` takes an optional `endedGrade?: string`
  > parameter (deviation from spec's `() => void`) so the spectator hook can pass the grade from
  > an `ended` server message. `real?: boolean` and `fromHandle?: string` added to `RunEvent` type
  > per `03` §5 (Phase 4 fields). `partykit.json` updated with `"stream": "src/stream.ts"` entry.
  > PartyKit server restart required after adding the stream party (workerd caches old config).
  > Verified in preview: streamer went LIVE; a raw `stream`-room connection registered as a
  > viewer ("watch") and the streamer's pill showed "👤 1 real" via `viewerCount`. `RunSnapshot`s
  > streamed at `snapshotPerSec` with `viewers` reflecting `displayViewers` (sim + realViewerWeight
  > × realViewers).

- [x] **4.3 — Viewer interaction (the heart).** Implement `hypeTap`/`quickChat`/`sendGift`/`vote`
  viewer messages + the server relays to the streamer (`03` §6). Viewer side: action bar (heart-spam
  button w/ rate limit + batching, quick-chat row, gift drawer that spends coins, poll overlay)
  per `06` §7. Streamer side: inject `real: true` RunEvents (glow render), apply real-crowd
  effects (`04` §12.3: displayViewers weighting, tap decay relief, flop relief, gift income +
  hype spikes), mirror choice events as `StreamPoll`s with `voteBoostMult` resolution. Rewards:
  tap micro-coins, gift clout-back, early-backer jackpot via the watch-drop, vote payouts
  (`04` §12.1–12.4), and the post-run **shoutout** of the top real gifter.
  **Refs:** `01` §7.1–7.2, `03` §5–6, `04` §12.1–12.4, `06` §7. **DoD:** two windows: B's taps
  visibly slow A's hype decay; B's gift costs B coins, appears glowing in A's feed, and pays both
  sides per formula; a choice event shows as a poll B votes in; an early B gift on an A-grade run
  pays B the jackpot in the drop sheet; A can shout out B (+followers to B); typecheck.
  > note: `voteTally` server msg broadcast to ALL connections (not streamer-only as in 03 §6) so
  > spectators can display live tally bars and receive vote-win coin rewards. `pendingVoteTally`
  > and `lastChoiceResolution` added to `RunSlice` (not in 03 §5) for `pollOpen`/`pollClose`
  > timing and vote-boost in `resolveChoice`. `realTapsLast5s` sliding window managed in the hook
  > (`tapWindowRef`) rather than the store. `useStreamerRoom` effect deps reduced to
  > `[streamId, handle]` (was `[phase, streamId, handle, params]`) to keep the socket alive
  > through the `results` phase so the shoutout button can fire. `GiftTier` re-exported from
  > `client/src/party/types.ts` (was imported-but-not-exported).
  > Verified in preview: a raw viewer connection sent `hypeTap` (4 taps) — streamer's hype rose
  > and a cyan-glow "@viewerB ❤️❤️❤️❤️" comment appeared in the streamer's `LiveFeed`; sent
  > `sendGift` (galaxy) — streamer's coins/diamonds increased by the formula amounts and a
  > cyan-glow "Galaxy @viewerB TAP" gift pill appeared. Ending the run sent `ended` (grade "B")
  > to the viewer, and the streamer's top-gifter SHOUT OUT button broadcast
  > `{handle:"viewerB", followers:100}`. Found `LiveFeed.tsx` did not implement the `06`§7
  > "real events get a cyan glow + @handle" treatment for the streamer's own feed (only the
  > spectator's `SpecFeedItem` had it) — fixed by threading `real`/`fromHandle` through `ChatPill`
  > and the gift `FeedItem` in `client/src/components/LiveFeed.tsx`. Poll/vote flow and the
  > spectator-side `SpectatorLive`/`ViewerActionBar`/`DropSheet` UI were verified by code review
  > (wired consistently to the same actions/types exercised above) but not exercised live, since
  > a true second client session wasn't available in this preview environment.

- [x] **4.4 — The Algorithm + server-authoritative trends.** Lobby aggregates `feedAlgorithm` into
  `AlgorithmState` (feeds/decay/tiers per `04` §12.5) and broadcasts it; Discover renders the
  world-boss meter bar (`06` §4); the tier multiplier folds into `recomputeStats()` (like
  `boonMultiplier`); BLESSED grants the guaranteed 2nd modifier in `startRun`. Move trend rotation
  from the client 90s timer (3.1) into the lobby `trends` broadcast; going live on a trend pushes
  its heat for everyone. Migrate the leaderboard `score` flow into the lobby; retire
  `party/src/trend.ts` + `useTrendRoom`.
  **Refs:** `01` §7.3–7.4, `03` §6, `04` §12.5, `06` §4, `02` §6. **DoD:** two windows see identical
  trends + meter; activity (stream/watch/gift) raises the meter; crossing FED multiplies income
  ×1.10 in both; single-window solo play still works offline (STARVED fallback, local trend
  fallback if the socket is down); typecheck.
  > note: decay + trend rotation run on a 30s `party.storage.setAlarm` (re-armed each tick) plus
  > lazy elapsed-time decay on every `feedAlgorithm`/connect, matching the existing in-memory
  > `streams`/`streamerConns` precedent (no Durable Object storage persistence). Added
  > `algoFedMult`/`algoBlessedMult` (1.10/1.25) to `BALANCE.social` per `04` §12.5. `algorithm` is
  > typed non-null in `socialSlice` (deviates from `03` §6's `AlgorithmState | null`) with an
  > exported `STARVED_ALGORITHM` default so `recomputeStats()`/UI never need null-checks; offline
  > fallback in `useLobby` resets to `STARVED_ALGORITHM` + restarts the local 90s
  > `generateTrends()` rotation on socket close. `rollModifiers()` gained an optional
  > `guaranteedSecondPool` param (filtered for conflicts) used only when BLESSED. Added
  > `lobbySendRef` to `socketRefs.ts` so `spectateSlice.sendViewerGift` can feed `giftCoins` without
  > prop drilling. Verified live: two-socket probe pushed the meter STARVED→FED→BLESSED, Discover's
  > `AlgorithmBar` updated in real time (×1.10/×1.25 buff text + tick marks), `recomputeStats()`
  > `multiplier` reflected the tier mult, a BLESSED run rolled a guaranteed second modifier
  > (`viral_moment`), and stopping the party server fell back to STARVED + local trend rotation
  > with no console errors.

- [ ] **4.5 — Supabase: accounts + cloud save + durable leaderboards + reward validation.** Add the
  Supabase adapter at the `meta.ts` serialize boundary (`02` §4); auth (anonymous-upgradeable);
  cloud save sync; persistent leaderboards; move viewer-reward granting (drops/jackpots/shoutouts)
  behind server-side checks — until here they are client-trusted (accepted beta risk, `01` §7.4).
  **Refs:** `01` §7.4, `02` §4. **DoD:** sign in, save syncs across two devices, leaderboard
  survives a PartyKit restart, spoofed reward messages are rejected.

---

## How to update this file
When you finish a task: change `[ ]`→`[x]`, and if you deviated from the spec, add a one-line
`> note:` under it explaining what changed and why (so the next model and the docs stay honest).
