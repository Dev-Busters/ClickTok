# 05 — Roadmap (Implementation Tasks)

> **This is the work queue.** Tasks are atomic, ordered, and have acceptance criteria. An
> implementer takes the lowest-numbered unchecked task in the active phase, reads ONLY the doc
> sections it names, implements it, runs `pnpm typecheck`, verifies in the browser preview when
> visible, then checks the box. Do not skip ahead a phase. Do not batch multiple tasks unless a
> task says so.
>
> Legend: `[ ]` todo · `[x]` done · **Refs** = which docs to read · **DoD** = acceptance criteria.
> Each task is sized to be doable by a small model in one focused session.

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

- [ ] **0.7 — App Shell + Bottom Nav.** Build `app/Shell.tsx` (phone-frame container + active screen
  switch + `BottomNav`) and `navigation/BottomNav.tsx` (5 TikTok tabs: Home, Discover, ＋, Inbox,
  Profile). Onboarding still gates entry. Render placeholders for empty screens.
  **Refs:** `06` §1–2. **DoD:** can switch all 5 tabs in preview; bottom nav matches TikTok layout;
  screenshot looks like a TikTok shell.

- [ ] **0.8 — Relocate current gameplay into screens.** Move today's clicker (tap + StatsBar +
  UpgradeShop) onto the appropriate screens: posting/stats on **Home**, upgrades on **Profile**
  (channel management). Leaderboard moves to **Discover**. Keep them working.
  **Refs:** `06` §3,5,6. **DoD:** every existing feature reachable via the new nav; typecheck;
  preview verified.

**Phase 0 exit criteria:** TikTok 5-tab shell, persistent save with idle income, sliced store,
coins economy — and the original clicker fully playable inside the new frame.

---

## PHASE 1 — Channel management build-out

Goal: flesh out the incremental engine and the meta→run stat bridge (data only; runs come Phase 2).

- [ ] **1.1 — Upgrade catalog (full).** Implement `features/upgrades/catalog.ts` from `04` §4 (gear +
  software, with `requires` gating and run-stat effects). Rework `UpgradeShop` into two categories
  with lock states.
  **Refs:** `03` §2, `04` §4, `06` §6. **DoD:** all upgrades buyable when unlocked; locked ones show
  requirements; `recomputeStats` reflects effects; typecheck + preview.

- [ ] **1.2 — Creator Skills.** Implement `skillsSlice` + `features/skills/catalog.ts` (`04` §5) and a
  Skills section on Profile with level-up buttons and cost display.
  **Refs:** `03` §3, `04` §5, `06` §6. **DoD:** can level skills with coins; costs escalate; follower
  gates enforced; stats recompute.

- [ ] **1.3 — Meta→run param preview.** Implement `features/livestream/computeRunParams()` (`04` §6) as
  a pure function. Add a read-only "LIVE readiness" panel (on Home or Create) showing projected
  start viewers / gift rate for the active trend, proving the bridge works before runs exist.
  **Refs:** `04` §6, `03` §5. **DoD:** panel numbers change when you buy gear / level skills /
  change trend; unit-sanity matches the worked example in `04` §6.

- [ ] **1.4 — Profile screen polish.** Build the TikTok-style profile header (avatar, @handle,
  followers/likes/coins/diamonds counts, bio line) above the gear/software/skills sections.
  **Refs:** `06` §6. **DoD:** profile resembles a TikTok profile; all currencies shown via
  `formatCount`; preview screenshot.

- [~] **1.5 — Catalog/passive videos. DEFERRED — DO NOT BUILD FOR MVP.** (Decision 2026-06-09:
  cut to reduce loop complexity; passive income is covered by `passiveCoinsPerSec` from gear.)
  Revisit only after Phase 3 if desired. Spec retained for the future: `catalogSlice` + catalog
  yield (`03` §4, `04` §3), a "Your videos" grid on Profile/Home. **Skip this task.**

---

## PHASE 2 — Livestream run loop (the roguelike)

Goal: a fully playable LIVE run. This is the headline feature — good to build live on stream.

- [ ] **2.1 — Run state + start.** Implement `runSlice` skeleton (`03` §5) and `startRun(topic)`:
  compute params via `computeRunParams`, set phase `live`, init viewers/hype/timer. Add a "Go LIVE"
  action in the Create (＋) sheet that transitions to the **Live** screen.
  **Refs:** `03` §5, `04` §6, `06` §4,7. **DoD:** pressing Go LIVE opens the Live screen with correct
  starting viewers; typecheck.

- [ ] **2.2 — Run loop engine.** Implement `hooks/useRunLoop.ts` + `runTick(dt)` per `04` §7: hype
  decay, viewer easing toward hype-driven target, timer, flop detection, cooldown ticks. No events
  yet — just the meters moving and the stream ending on timer/flop.
  **Refs:** `04` §7, `02` §5. **DoD:** viewers/hype/timer animate live; stream auto-ends at 0s or on
  sustained flop; meters visible on Live screen.

- [ ] **2.3 — Event spawner + feed UI.** Spawn `RunEvent`s on the schedule (`04` §7) and render the
  scrolling LIVE feed (comments, gifts, trolls, hype waves). Implement `collectGift` (tap to
  collect), gift tier rolls (`04` §7), troll viewer/hype drain, hype-wave ride.
  **Refs:** `03` §5, `04` §7,§8, `06` §7. **DoD:** feed scrolls; tapping gifts adds coins/diamonds;
  trolls drain until dismissed; riding a wave boosts hype/viewers; preview verified.

- [ ] **2.4 — Reactions / hotbar.** Render the reaction hotbar from the run's unlocked `reactions`;
  implement `useReaction` with cooldowns and effects (`04` §9).
  **Refs:** `03` §5, `04` §9, `06` §7. **DoD:** each reaction fires its effect, shows cooldown; only
  unlocked reactions appear; preview verified.

- [ ] **2.5 — Choice events.** Implement comment/sponsor `choices` and `resolveChoice` (effects keyed
  per `04`). A few authored choice events with distinct outcomes.
  **Refs:** `03` §5, `04` §8. **DoD:** choice prompts appear, options apply different effects.

- [ ] **2.6 — End + results + rewards.** Implement `endRun(reason)` → `scoreRun` (`04` §10): convert to
  meta currencies, grant them, show a results sheet (peak viewers, gifts, followers gained, grade).
  Return to Home after.
  **Refs:** `03` §5, `04` §10, `06` §7. **DoD:** ending a run grants the right rewards (matches
  formula), results sheet shows the breakdown + grade; followers/coins persist after.

- [ ] **2.7 — Run modifiers + post-run boon.** Roll `RunModifier`s at start and show them; implement
  the 1-of-3 boon pick on a successful run (`01` §5.5).
  **Refs:** `01` §5.5, `04` §8. **DoD:** modifiers visibly change a run; boon pick appears on
  success and applies.

**Phase 2 exit criteria:** a full GO LIVE → react-to-feed → results loop that's meaningfully shaped
by meta progression, with run-to-run variety.

---

## PHASE 3 — Discover, trends, polish, prestige

- [ ] **3.1 — Discover + local trends.** Implement `socialSlice.trendsAvailable` (locally rotating
  trends with `heat`), a Discover screen to browse/select the active trend, and wire `trendMultiplier`
  into runs. Replace the hardcoded `DEFAULT_TREND`.
  **Refs:** `03` §6, `04` §6, `06` §4. **DoD:** choosing a hotter trend raises projected/actual run
  viewers; selection persists into the run.
- [ ] **3.2 — Inbox.** Notifications feed (run results, milestones, daily reward). Daily login reward.
  **Refs:** `06` §5. **DoD:** events land in Inbox; daily reward claimable once/day.
- [ ] **3.3 — Juice pass.** Animations/transitions, gift particles, screen-shake on big moments,
  optional sound. Escalate the run feed to Pixi ONLY if DOM stutters (CLAUDE.md).
  **DoD:** no jank at 60fps with a busy feed; before/after screenshots.
- [ ] **3.4 — Prestige ("Rebrand").** Implement reset-for-Clout-multiplier (`01` §4.4) + UI.
  **DoD:** rebrand resets the right things, keeps diamonds, applies a permanent multiplier.
- [ ] **3.5 — Balance pass.** Tune `BALANCE` against the guidance in `04` §11 using real playthroughs.

---

## PHASE 4 — Multiplayer / community (build last)

- [ ] **4.1 — Server-authoritative trends.** Move trend rotation into PartyKit; clients read the
  global hot trend; aggregate "push" from players streaming it.
  **Refs:** `01` §7, `02` §6–7. **DoD:** all clients see the same rotating trend; streaming it nudges
  its heat.
- [ ] **4.2 — Live raids (player→player).** `goLive`/`raid`/`raided` messages (`03` §6); a live player
  can raid another's run, injecting viewers. The signature cross-player effect.
  **DoD:** two clients: one raids, the other's run gains viewers in real time.
- [ ] **4.3 — Global events / challenges.** Server-wide goals with shared rewards.
- [ ] **4.4 — Supabase accounts + cloud save + durable leaderboards.** Add the Supabase adapter at the
  `meta.ts` serialize boundary (`02` §4); accounts; persistent leaderboards.
  **DoD:** sign in, save syncs across devices, leaderboard persists across server restarts.

---

## How to update this file
When you finish a task: change `[ ]`→`[x]`, and if you deviated from the spec, add a one-line
`> note:` under it explaining what changed and why (so the next model and the docs stay honest).
