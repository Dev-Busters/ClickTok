# ClickTok

A TikTok-themed incremental + roguelike game, built live on stream. You play a TikTok
creator: a **clicker / channel-management** meta-layer grows your channel (followers, coins,
gear, skills), and that progression **gates and scales** a **roguelike "livestream" run loop**
where you react to a live comment/gift feed in real time. Long-term goal: multiplayer/community
mechanics where players affect each other.

## Locked design decisions (do not relitigate without the user)

1. **Run loop = "live feed + react."** A livestream is a roguelike "run." A real-time feed of
   comments, gifts, and events scrolls in; the player reacts. See `docs/01-game-design.md`.
2. **Economy = meta gates/scales runs.** The clicker/channel layer (followers, skills, gear)
   determines starting viewers, gift rates, event pools, and reward yield of each run. Runs are
   where you earn the bulk of rewards. Runs are random *within bounds set by meta progression.*
3. **Build order = app shell + persistence first.** Stabilize the store, add save/load, and the
   TikTok navigation shell before deep mechanics. We are in **Phase 0**. See `docs/05-roadmap.md`.
4. **UI = full multi-tab TikTok clone.** Bottom nav (Home / Discover / ＋ / Inbox / Profile),
   FYP-style feed, profile page. See `docs/06-ui-screens.md`.

## Tech stack (already chosen — do not swap)

- **Client:** React 19 + Vite 6 + TypeScript + Tailwind v4 (`client/`)
- **State:** Zustand 5 (with `persist` middleware → localStorage)
- **Animation:** Framer Motion 11. **Optional** heavy visuals: PixiJS / `@pixi/react` (installed;
  use ONLY for the livestream particle/feed layer if DOM perf is insufficient — default to DOM)
- **Realtime multiplayer:** PartyKit (`party/`) via `partysocket`
- **Backend/persistence (later):** Supabase (`@supabase/supabase-js`, env vars already stubbed)
- Monorepo via pnpm workspaces: `client`, `party`, (`server` reserved).

## Spec set — read order

Specs live in `docs/`. They are the source of truth; this repo's design lives in docs, not in
your training data. Read in this order, and only the parts a task references:

1. `docs/01-game-design.md` — the game design document (vision, pillars, all mechanics).
2. `docs/02-architecture.md` — folder layout, store slices, persistence, conventions.
3. `docs/03-data-model.md` — **canonical TypeScript types.** Copy these verbatim; keep in sync.
4. `docs/04-economy-formulas.md` — every number and formula (costs, yields, meta→run bridge).
5. `docs/05-roadmap.md` — **the task list.** Phased, atomic, with acceptance criteria. Start here
   when implementing.
6. `docs/06-ui-screens.md` — per-screen TikTok-faithful UI specs.

## Workflow for implementing a task (read this if you are an implementer)

1. Open `docs/05-roadmap.md`, find the lowest-numbered **unchecked** task in the current phase.
2. Read ONLY the doc sections that task references (it names them). Do not re-derive design.
3. Implement exactly what the task says. If types are involved, mirror `docs/03-data-model.md`.
   If numbers are involved, use `docs/04-economy-formulas.md`. Do not invent balance values.
4. **Definition of Done:**
   - `pnpm typecheck` passes (runs client + party).
   - The task's acceptance criteria are met.
   - You verified visible behavior in the browser preview (use `preview_*` tools) when the change
     renders something.
   - You checked the box in `docs/05-roadmap.md` and noted anything you deviated on.
5. Keep PRs/changes small — one task at a time. Do not start the next phase early.
6. If a design decision is genuinely missing from the docs, STOP and ask the user — do not guess.

## Commands

- `pnpm dev` — runs client (port 3000) + PartyKit (port 1999) together.
- `pnpm dev:client` / `pnpm dev:party` — individually.
- `pnpm typecheck` — typechecks client + party. **Run before declaring a task done.**
- `pnpm build` — production build of client.

## Conventions

- **TypeScript everywhere**, `strict`. No `any` without a written reason.
- **State** goes through Zustand slices (`client/src/store/`). Components read via selectors
  (`useGameStore(s => s.x)`), never the whole store. Derive, don't duplicate.
- **Persistence:** only persistent slices are saved; ephemeral run/leaderboard state is excluded.
  See `docs/02-architecture.md` § Persistence. Bump `SAVE_VERSION` + add a migration on any
  breaking shape change.
- **Styling:** the existing CRT/terminal flavor (CSS vars in `client/src/index.css`) is kept as
  *accent* inside an otherwise TikTok-faithful layout. Reuse the CSS variables (`--red`, `--cyan`,
  etc.). Prefer Tailwind utilities for layout; inline styles are acceptable (matches current code).
- **Shared types** between client and PartyKit live in `client/src/party/types.ts` and must stay
  in sync with `party/src/*.ts` (duplicated by hand — keep both edited together).
- Money/large numbers use `formatCount()` in `client/src/lib/format.ts`.
- Keep new code in the style of the file around it.
