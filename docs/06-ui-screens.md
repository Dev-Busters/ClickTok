# 06 — UI Screens (TikTok-faithful)

> How each screen looks and behaves. We're doing a **full multi-tab TikTok clone** skin. Match
> TikTok's real layout conventions; keep the existing CRT/terminal accents (CSS vars in
> `index.css`) as flavor, not as the whole identity. Mobile-portrait first (the app renders in a
> phone-frame; target ~390–420px wide). Use `formatCount()` for all big numbers. Reuse CSS vars:
> `--red #ff1f4b`, `--cyan #25f4ee`, `--bg #070708`, `--text #e8e4d8`, `--dim`, `--gold`.

## 1. App frame & navigation model

- The app is a single portrait column (max-width ~420px, centered, the rest of the viewport is the
  dark vignette already in `App.tsx`). Think "phone on a dark stage."
- **Top:** a faux status bar / contextual header per screen (TikTok has minimal chrome).
- **Body:** the active screen (one of the 5 tabs, or the full-screen **Live** overlay).
- **Bottom:** the **BottomNav** (always visible except during a Live run, which is full-screen).
- Onboarding (existing) gates everything until a handle is set.

## 2. Bottom navigation (`navigation/BottomNav.tsx`)

TikTok's 5-slot bar. Fixed to bottom, dark, hairline top border.

| Slot | Label | Icon | Opens |
|---|---|---|---|
| 1 | Home | house | Home (For You) |
| 2 | Discover | magnifier | Discover |
| 3 | **＋** | rounded rectangle with red/cyan offset edges (TikTok's signature ＋) | Create sheet |
| 4 | Inbox | message/bell | Inbox |
| 5 | Profile | person | Profile |

- Center ＋ is visually larger/raised, uses the red+cyan chromatic offset (reuse `.chroma` idea).
- Active tab: label/icon in `--text`; inactive in `--dim`. Small label under each icon (TikTok
  style). Tap → `setTab` / for ＋ → `setSheet('create')`.

## 3. Home — "For You" (`screens/HomeFeed/`)

The hub. TikTok's home is the vertical video feed; ours blends that with the posting clicker.

- **Header:** centered "For You" / "Following" pill toggle (cosmetic for now), LIVE indicator if a
  run is available. Keep the small `@handle` + LIVE dot from the current top bar.
- **Hero:** the big follower count (reuse current `StatsBar` hero treatment) + passive/sec line.
- **Post action:** the existing tap button, reframed as **"＋ Post"** / "Create" — the active
  clicker. Floating `+N` feedback stays (current `TapButton`). Each tap = a post (`04` §1).
- **(Phase 1.5) Feed:** below the fold, a vertical list/grid of your recent videos (catalog) with
  view counts ticking — visually echoes the FYP. Optional for MVP.
- **LIVE-readiness chip (Phase 1.3):** small panel "You'd start at ~N viewers on #trend → Go LIVE".

## 4. Discover (`screens/Discover/`)

Trends + leaderboard (and the future multiplayer surface).

- **Search bar** (cosmetic placeholder) at top.
- **(Phase 4.1) LIVE NOW rail:** above the trends, a horizontally scrollable rail of live-stream
  cards (TikTok LIVE-tab style) from `socialSlice.liveDirectory`: avatar (handle-generated, like
  Profile), `@handle`, a red **LIVE** badge, `#topic`, viewer count, a thin hype bar. Sorted by
  creator level then viewers. Tap → join as spectator (4.2; display-only in 4.1). Empty state:
  "nobody's live — be the first" + a GO LIVE shortcut.
  (Phase 6.1) sim filler cards (`featured: true`) carry a small **✨ FEATURED** badge in place of
  the red LIVE badge; real streams always render first.
- **(Phase 4.4) The Algorithm bar:** a world-boss-style meter across the top of the screen —
  segmented bar with the FED/BLESSED thresholds ticked, current tier label glowing (`--cyan` FED,
  `--gold` BLESSED), and the active buff ("ALL INCOME ×1.10"). Feeds from `socialSlice.algorithm`.
- **Trending now:** list of trend topics with a `heat` meter (flame/intensity). Selecting one sets
  the **active trend** (`socialSlice.setActiveTrend`) used by runs. Show projected viewer bonus.
- **Leaderboard:** the existing PartyKit `Leaderboard` (top channels for the active trend), styled
  as a TikTok ranking list. Highlight the player's row (already implemented).

## 5. Create (＋) sheet & Inbox

**Create sheet (`screens/Create/`)** — a bottom sheet (slides up) with two primary actions:
- **Post** — quick content; closes sheet, triggers post gains (or just routes to Home's tap). For
  MVP this can simply focus the Home post button.
- **GO LIVE** — the headline. Shows projected start viewers/gift rate for the active trend
  (`computeRunParams`), a trend picker shortcut, and a big red **GO LIVE** button → `startRun` →
  Live screen. (Wired in Phase 2.1.)

**Inbox (`screens/Inbox/`)** — TikTok activity feed style: a list of notifications (run results,
milestone unlocks, daily reward, later: raids/gifts from other players). Daily reward claim button
at top (Phase 3.2).

## 6. Profile (`screens/Profile/`) — channel management

TikTok profile layout, repurposed as the meta/management hub.

- **Profile header:** circular avatar (generated from handle), `@handle`, an editable-looking bio
  line ("becoming the algorithm"). A stat row TikTok-style:
  `Following · Followers · Likes` — plus our extra currencies **Coins 🪙** and **Diamonds 💎**.
  All via `formatCount`.
- **Tabs/sections** (pill or segmented control): **Gear**, **Software**, **Skills** (and **Videos**
  if catalog is built). TikTok profiles have a grid tab row — mirror that affordance.
  - **Gear / Software:** the reworked `UpgradeShop` split by category (`04` §4). Owned items show as
    acquired; locked items show their `requires`. Costs in coins (💎 for elite).
  - **Skills:** the five creator skills with level, next-level cost, and effect summary (`04` §5).
    Level-up button disabled if unaffordable/maxed/gated.
- Keep the current upgrade-row visual language (index number, name, description, cost) — it's good;
  just regroup and add lock/owned states.

## 7. Live (`screens/Live/`) — the run (full-screen overlay)

This is a TikTok LIVE screen. Full-screen, hides the BottomNav.

- **Top bar:** `@handle` + a pulsing **LIVE** badge, current **viewer count** (big, top-left like
  TikTok), the active **#trend**, and a **stream timer** countdown. Show rolled **run modifiers** as
  small chips.
- **Hype meter:** a prominent bar (0–100) — the momentum gauge. Color shifts toward `--red`/`--gold`
  as it climbs. This is the player's main feedback.
- **Center/background:** the "stage" — keep it simple (the creator avatar / a stylized camera view).
  Particle/gift visuals float here (DOM/Framer Motion; escalate to Pixi only if needed).
- **The feed (right/bottom, TikTok LIVE style):** comments scroll up from the bottom-left. Gifts
  float up as tappable icons (Rose/Heart/Galaxy/Lion ascending) — **tap to collect**. Trolls appear
  as angry comments with a small health/timer; hype waves appear as a brief full-width "RIDE THE
  WAVE — TAP" banner.
- **Reaction hotbar (bottom):** a row of the player's unlocked reactions (`04` §9) with icons and
  cooldown sweeps. TikTok puts reaction/gift buttons along the bottom — mirror that.
- **Collected ticker:** small running totals of coins/diamonds collected this run.
- **End Stream button:** top-right; ending voluntarily at high hype = outro bonus.
- **Results sheet (on end):** peak viewers, gifts collected, hype grade (S–D / FLOP), followers
  gained, coins/diamonds — then "Back to Channel" + (on success) the 1-of-3 boon pick.
  (Phase 4.3) adds a **top real gifter** row with a one-tap **SHOUT OUT** button.
- **(Phase 4) Real-viewer rendering:** `real: true` feed events get a glow treatment (cyan border
  glow + the viewer's `@handle`) so real humans visibly stand out from the sim crowd. A small
  "👤 N real" counter sits by the viewer count when `realViewers > 0`.

### 7b. Spectator mode (Phase 4.2–4.3) — same screen, viewer's seat

The **same Live screen layout**, driven by `spectateSlice.liveSnapshot` instead of `runSlice`:
- Top bar shows the **streamer's** `@handle` + LIVE badge + viewers/topic/timer; meters and the
  feed update from snapshots. No End Stream — a **LEAVE** button (top-right) instead.
- **No reaction hotbar.** In its place, the **viewer action bar** (4.3):
  - a big **heart button** — the hype-tap spam target (rate-limited; burst hearts on tap, reuse
    the FYP heart-burst), with a subtle charge meter when rate-limited out;
  - a **quick-chat row** — the `QuickChatId` presets as one-tap pills (cooldown sweep);
  - a **GIFT** button opening a bottom drawer: the four tiers with coin costs (disabled if
    unaffordable); within the early-backer window, the drawer shows an "EARLY 🚀 jackpot ×3"
    ribbon;
  - **polls** — the streamer's choice events render as a voting card (one button per option,
    live tally bars after voting).
- In 4.2 (before interaction lands) the action bar renders disabled with a "soon" hint.
- **Viewer result sheet** (on leave / stream end): the `WatchDrop` breakdown — watch time, coins
  (+jackpot line if hit), likes, token followers, diamond if earned, shoutout banner if you got
  one. "Back to Discover" button.

## 8. Shared UI primitives (`components/`)

Build these once, reuse everywhere:
- `Sheet` — bottom sheet (Framer Motion slide-up) for Create / Welcome Back / Results / Boon pick.
- `StatPill` — label + value + optional icon, `formatCount`.
- `CurrencyRow` — the followers/likes/coins/diamonds cluster.
- `ProgressBar` — used for hype, cooldowns, trend heat.
- `IconButton` / nav icons — keep the SVG style already in `public/icons.svg` / `TapButton`.
- `LockBadge` — shows `requires` on locked upgrades/skills.

## 9. Visual language rules

- Layout = TikTok (familiar, clean, dark, bottom-nav, profile grid). Accents = our CRT/terminal
  identity (mono labels in caps with letter-spacing, chromatic wordmark, thin red/cyan lines, the
  scanline overlay). Don't let the CRT flavor fight the TikTok legibility — it's seasoning.
- Typography already set: `--font-display` (Bebas) for big numbers, `--font-mono` (JetBrains) for
  labels/HUD, `--font-ui` (Rajdhani) for body.
- Every number that can get large uses `formatCount`. Every actionable element has a pressed state
  (Framer `whileTap`/scale), matching current components.
