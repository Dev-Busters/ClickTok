# ClickTok

ClickTok is a TikTok-themed incremental + roguelike game: a clicker/channel-management meta layer
(post content, earn coins/followers, buy gear, level creator skills) gates and scales a real-time
"livestream" run loop, where you react to a scrolling feed of comments, gifts, trolls, and events.
Multiplayer lets other players spectate, hype-tap, gift, and vote in your live streams. Play it at
**https://clicktok-one.vercel.app**.

## Quickstart

```sh
pnpm install

# copy env templates and fill in your own values
cp client/.env.example client/.env
cp party/.env.example party/.env

pnpm dev   # client on :3000, PartyKit on :1999
```

- `client/.env` needs a Supabase project's URL + anon key (`VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`) for auth/cloud-save sync, and `VITE_PARTYKIT_HOST` (defaults to
  `localhost:1999` for local dev).
- `party/.env` is optional for local dev — without it, the lobby falls back to an in-memory
  leaderboard (no Supabase durability).
- `pnpm dev:client` / `pnpm dev:party` run each half individually.
- `pnpm typecheck` — typechecks client + party. Run before declaring any task done.
- `pnpm build` — production build of the client.

## Architecture

```
ClickTok/
  client/   # React 19 + Vite + TypeScript + Tailwind v4 game client -> Vercel
  party/    # PartyKit realtime server (lobby + per-stream rooms) -> PartyKit Cloud
  server/   # reserved, unused
  docs/     # design + architecture specs (source of truth)
```

- **Client** — static Vite build, deployed to **Vercel**
  (prod: `clicktok-one.vercel.app`).
- **Realtime** — PartyKit (stateful WebSocket rooms on Cloudflare; cannot run on Vercel),
  deployed via `partykit deploy`
  (prod: `clicktok.dev-busters.partykit.dev`).
- **Persistence** — Supabase (auth, cloud saves, durable leaderboard), already cloud-hosted.

## Docs & roadmap workflow

Specs live in `docs/` and are the source of truth — read only the sections a task references:

1. `docs/01-game-design.md` — vision, pillars, all mechanics.
2. `docs/02-architecture.md` — folder layout, store slices, persistence, conventions.
3. `docs/03-data-model.md` — canonical TypeScript types.
4. `docs/04-economy-formulas.md` — every number/formula (costs, yields, meta->run bridge).
5. `docs/05-roadmap.md` — the task list (phased, atomic, with acceptance criteria).
6. `docs/06-ui-screens.md` — per-screen UI specs.

To implement a task: open `docs/05-roadmap.md`, take the lowest-numbered unchecked task in the
active phase, read only the docs it names, implement exactly what it says, run `pnpm typecheck`,
verify visible behavior in a browser preview, then check the box (adding a `> note:` for any
deviation). See `CLAUDE.md` for the full set of conventions.

## Deploy runbook

**PartyKit (realtime server):**

```sh
cd party
npx partykit login            # operator completes GitHub OAuth
npx partykit deploy            # project name "clicktok" per partykit.json

# push secrets (values from your local party/.env), then redeploy
npx partykit env add SUPABASE_URL
npx partykit env add SUPABASE_SERVICE_ROLE_KEY
npx partykit env add POSTHOG_API_KEY   # optional telemetry
npx partykit deploy
```

**Vercel (client):**

```sh
vercel            # link/create the project from repo root
```

- Root Directory: `client`
- Framework: Vite (auto-detected)
- Production env vars: `VITE_PARTYKIT_HOST` (the deployed PartyKit host), `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` (last two optional)
- Deploy to production: `vercel --prod`

## Environment variables

No secret values below — names only. See `client/.env.example` and `party/.env.example`.

**`client/.env`**
- `VITE_PARTYKIT_HOST`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_POSTHOG_KEY` (optional — no key means no telemetry, no console noise)
- `VITE_POSTHOG_HOST` (optional — defaults to `https://us.i.posthog.com`)

**`party/.env`** (optional locally; required in production for durable leaderboards)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `POSTHOG_API_KEY` (optional — party rooms run silently without it)
- `POSTHOG_HOST` (optional — defaults to `https://us.i.posthog.com`)
