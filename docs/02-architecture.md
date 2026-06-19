# 02 — Architecture

> How the code is organized and the rules implementers follow. Pairs with `03-data-model.md`
> (types) and `05-roadmap.md` (build order). When adding code, match these patterns.

## 1. Monorepo layout

```
ClickTok/
  client/          # React app (the game)
  party/           # PartyKit realtime server (multiplayer)
  server/          # reserved (workspace declared, unused for now)
  docs/            # specs (this folder)
  CLAUDE.md        # entry point / conventions
```

`pnpm dev` runs client + party together. `pnpm typecheck` checks both.

## 2. Target client structure

We migrate from the current flat `components/` layout to feature folders. **Do this incrementally
per the roadmap — do not big-bang rewrite.** Target end state:

```
client/src/
  main.tsx
  index.css                     # global CSS + design tokens (keep CSS vars)
  app/
    App.tsx                     # mounts Shell; routes by active tab; onboarding gate
    Shell.tsx                   # phone frame + active screen + BottomNav
  navigation/
    BottomNav.tsx               # TikTok 5-tab bottom bar
    tabs.ts                     # Tab enum + metadata (icon, label)
  screens/
    HomeFeed/                   # "For You" — ambient feed + posting entry
    Discover/                   # trends + leaderboard (multiplayer surface)
    Create/                     # ＋ sheet: Post / Go LIVE
    Inbox/                      # notifications, events, daily reward
    Profile/                    # channel mgmt: stats, gear, software, skills
    Live/                       # the run (livestream) — feed + react + hotbar
  features/
    onboarding/                  # ordered opening goals, reveal catalog, pure progression checks
    economy/                    # currency helpers, formula functions (pure)
    channel/                    # posting, catalog, passive income
    upgrades/                   # gear/software catalog + apply logic
    skills/                     # creator skills catalog + leveling
    livestream/                 # run engine: event spawner, scoring, reactions
    teb/                        # TEB launch + rhythm charts, input reducer, judgement/reward
    social/                     # trends, raids, global events (Phase 4)
  store/
    index.ts                    # createStore: combines slices + persist
    slices/
      channelSlice.ts           # handle, currencies, post power, multipliers
      upgradesSlice.ts          # owned gear/software, purchase logic
      skillsSlice.ts            # skill levels, leveling logic
      catalogSlice.ts           # video catalog (optional/Phase 1.x)
      runSlice.ts               # EPHEMERAL live-run state (not persisted)
      socialSlice.ts            # leaderboard/trends (mostly ephemeral)
      uiSlice.ts                # active tab, open sheets/modals
      meta.ts                   # SAVE_VERSION, migrations, partialize config
  hooks/
    useGameLoop.ts              # meta passive tick (rAF) — exists
    useRunLoop.ts               # run tick (event spawn, hype/viewer update)
    useTrendRoom.ts             # PartyKit connection — exists
  lib/
    format.ts                   # number formatting — exists
    rng.ts                      # seeded RNG (for runs)
    math.ts                     # clamp, lerp, formula helpers
  party/types.ts                # shared client<->server message types — exists
  components/                   # shared dumb UI primitives (Button, Sheet, Stat, etc.)
```

Phase 17 rhythm boundary (`13`): `features/teb/` owns serializable chart definitions, seeded
geometry, pure pointer transitions, judgement, and reward. `screens/HomeFeed/rhythm/` owns DOM/SVG
rendering and pointer capture plumbing. `tebSlice` owns the ephemeral session snapshot. Do not put
DOM nodes, browser PointerEvents, SVG path instances, Framer controls, or timer handles in Zustand.

Phase 18 onboarding boundary (`14`): `features/onboarding/` owns the ordered goal catalog and pure
requirement/progress checks. `onboardingSlice` owns durable journey/reveal/teach state and is the sole
authority for fresh-opening feature availability. Screens render that state and report semantic
actions (`studio_opened`, `upgrade_bought`, `teach_completed`); they never infer unlocks directly
from wallet totals. Legacy metrics remain achievement data and may not mutate onboarding state.

Phase 18 rhythm layout (`14` §F): `HomeFeed` measures visible chrome rectangles and passes one
`RhythmInteractionField` rectangle to the chart builder. Rhythm renderers do not query or hide feed
components themselves. Home owns temporary chrome input-gating; rhythm owns target input inside the
measured field. This keeps progression, layout, and scoring independently testable.

Pragmatic note for cheap models: feature folders are the *destination*. If a task is small, it's
fine to keep a helper next to its consumer and move it later — but new **screens** and **store
slices** must go in the folders above from the start.

## 3. State management (Zustand)

- **One store**, composed of **slices**. `store/index.ts` calls `create()(persist(...))` and spreads
  each slice creator. Pattern:

```ts
// slices are (set, get) => ({ ...state, ...actions })
export const createChannelSlice: StateCreator<FullState, [], [], ChannelSlice> = (set, get) => ({ ... });
// store/index.ts
export const useGameStore = create<FullState>()(
  persist(
    (set, get, api) => ({
      ...createChannelSlice(set, get, api),
      ...createUpgradesSlice(set, get, api),
      // ...
    }),
    persistOptions, // see §4
  ),
);
```

- Components subscribe with **narrow selectors**: `useGameStore(s => s.coins)`. Never select the
  whole store. Never store derived values you can compute — but DO cache expensive derived stats
  (post power, passive/sec) on state, recomputed in the action that changes their inputs (the
  current `computeStats` pattern in `gameStore.ts` — keep it).
- Cross-slice reads use `get()`. Keep slices cohesive; a run reads channel stats via `get()`.

### Migrating the existing store
The current `client/src/store/gameStore.ts` is a single store. Phase 0 splits it into slices but
**preserves behavior**. Keep `useGameStore` as the exported hook name so existing components keep
working during migration; update imports as files move.

## 4. Persistence

- Use Zustand **`persist`** middleware → `localStorage`, key `clicktok-save`.
- **`partialize`**: persist ONLY durable slices: channel (handle, currencies, post power,
  multipliers, lastSeenAt), upgrades (owned), skills (levels), catalog. **Exclude**: `runSlice`
  (ephemeral), `socialSlice` (server-owned), `uiSlice` (session).
- **Versioning:** `SAVE_VERSION` integer in `store/slices/meta.ts`. On any breaking shape change,
  bump it and add a `migrate(persistedState, fromVersion)` step. Never silently change shapes.
- **Offline/idle income:** persist `lastSeenAt` (ms). On load, compute `elapsed = now - lastSeenAt`,
  grant capped passive income (`min(elapsed, IDLE_CAP)` × passive rate), and show a "Welcome back"
  summary. Formula in `04` § Idle. Update `lastSeenAt` on save and on a periodic heartbeat.
- **Cloud sync (Phase 4):** Supabase becomes a second persistence target. Keep the serialize/
  deserialize boundary in `meta.ts` clean so a Supabase adapter can reuse it. Do NOT wire Supabase
  before Phase 4.

## 5. Game loops

Two independent loops:
- **Meta loop** (`useGameLoop.ts`, exists): a rAF tick driving passive income. Runs whenever the
  app is mounted. dt capped (already done) to avoid tab-restore spikes.
- **Run loop** (`useRunLoop.ts`, new in Phase 2): active only during a live run. Higher logical
  frequency. Responsibilities: advance stream timer, decay hype, drift viewers, spawn events on
  schedule, expire un-collected gifts, tick reaction cooldowns, check flop condition. Should use a
  fixed timestep accumulator (e.g., 100ms logic steps) for deterministic-ish behavior; render via
  React state/Framer Motion. Keep heavy per-frame particle work out of React if it ever stutters
  (escalate to Pixi only then — see CLAUDE.md).

Both loops mutate the store through actions, not by writing state directly in the component.

## 6. Realtime (PartyKit) — current & future

- Today: `party/src/trend.ts` is a per-room ("trend") leaderboard server; client connects via
  `useTrendRoom.ts`. Message types are duplicated in `client/src/party/types.ts` and
  `party/src/trend.ts` — **edit both together.**
- Phase 4 extends this (see `01` §7, `03` §6): one global **lobby** room (presence, live
  directory, trends, leaderboard, The Algorithm meter) + one **stream room per live run**
  (streamer broadcasts `RunSnapshot`s; spectators send interaction messages back). Design messages
  so the server can later own scoring/trends authoritatively. Keep client→server messages
  describing *intent/score*, server→client describing *world state* (already the shape).

## 7. Multiplayer-readiness rules (cheap to follow now, expensive to retrofit)

1. Run scoring is computed in a **pure function** (`features/livestream` `scoreRun(...)`), separate
   from UI, so a server can run the same function later.
2. Trend identity is a **string id**; never hardcode the active trend in a component — read it from
   state/`socialSlice`. The DEFAULT_TREND constant is a temporary stand-in.
3. The player's public summary (handle, followers, likes, current trend, live-status) is a single
   serializable object (see `03` § ChannelSummary) — the unit of multiplayer exchange.

## 8. Conventions recap (full list in CLAUDE.md)

- TS `strict`; no `any` without a comment justifying it.
- Pure formula functions in `features/*/...` import constants from `04`'s implementation
  (`features/economy/balance.ts`) — see §below.
- **Balance constants live in code** at `client/src/features/economy/balance.ts`, mirroring
  `docs/04-economy-formulas.md`. Docs are the spec; `balance.ts` is the runtime copy. Keep in sync;
  when you change one, change the other and note it.
- Selectors narrow; actions mutate; components stay dumb where practical.
- Reuse `formatCount`, CSS vars, and existing animation keyframes before adding new ones.
