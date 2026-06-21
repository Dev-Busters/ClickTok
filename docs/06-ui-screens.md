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

## 3. Home — the clicker stage (`screens/HomeFeed/`; Phase 7 REVISED — `01` §8)

Home houses the clicker loop: TAP CORE center, the **element stage** above it, `VideoCanvas`
ambience behind it. (The 3.3-era tap-to-post layout is superseded; the swipe-up video pager
layers in at task 7.5 without changing this layout.)

**Layout (390×844 reference):** top stat strip (followers hero + currency pills) → element stage
(upper ~35%, where waves spawn; locked "???" pods dock at its top edge) → **TAP CORE** at dead
center → GO LIVE pill + caption/marquee at the bottom → right action rail → bottom nav. Backdrop:
full-bleed `VideoCanvas` (NPC-seeded pre-7.5) under a dark scrim, `intensity` fed by combo and
wave events — every tap makes the whole screen breathe.

- **TAP CORE:** ~140px circular target, unmistakably a button — concentric rings, soft glow,
  slow idle "breathing," a "TAP" micro-label until the first tap each session. Per tap: a radial
  **shockwave ripple** + small particle ring + floating `+N` per currency (arcing up with slight
  scatter) + a 1–2px screen-kick. The **combo ring** wraps the core, filling toward `comboCap`;
  it **drains visibly** when idle (the player SEES the combo dying — that's the pressure). At
  each `comboMilestones` stage the core re-tiers: ring color walks the palette
  (`--dim` → `--cyan` → `--red` → `--gold`) with brighter glow and denser tap particles. Combo
  counter ("×1.32") rides above the ring in mono caps.
- **Locked element pods:** small dim circles docked above the stage, each with "???", a lock
  glyph, and its requirement in plain text ("2.5K 🪙 · needs 1K followers"). Within reach (gate
  met, ≥80% of the coins) they shimmer. Tap → unlock sheet (name, tagline, a tiny looping demo
  animation of the mechanic, cost button). Unlock = the pod ignites and flies into the stage.
- **BEAT SYNC wave:** 3 pods fade-in across the stage in a shallow arc. Each pod has an
  **approach ring** — a glowing stroke (SVG circle, `--cyan` w/ drop-shadow) that shrinks from
  2.2× the pod's size to 1×, staggered left→right so the hit moments cascade like a 3-note
  phrase. **The ring's scale and the grading derive from the same wave clock** (Framer
  `useAnimationFrame` against `wave.startedAt`) — never animate it with an independent tween.
  On tap: PERFECT = the ring *locks* onto the pod with a white flash, gold burst, "PERFECT" in
  mono caps; GOOD = cyan pulse; OK = dim tick; MISS = red flicker + 4px x-shake, ring shatters
  into 2–3 fading shards. All-PERFECT wave = full-screen white pulse, `VideoCanvas` intensity
  spike, "+BONUS" banner. Grade colors: PERFECT `--gold`, GOOD `--cyan`, OK `--dim`, MISS
  `--red` — consistent everywhere, including floating numbers.
- **DUET LOOP wave:** 3 dormant pods (dim, slow pulse). A TAP CORE tap fires an **energy beam**
  — an animated gradient streak (red→cyan, ~120ms) from the core to the next pod, igniting it
  (ring flare + glow + "TAP!" label). Tapping the armed pod sends the beam back with a
  counter-pulse on the core. Each completed pod leaves a faint **afterglow link** between core
  and pod; finish the chain inside `flowSec` and the three links flash into a triangle with a
  gold "FLOW" banner + bonus. Armed-pod timeout: the glow gutters out (no harsh fail signal —
  the chain just stalls).
- **Performance rules:** transforms + opacity only (no layout/paint properties in animation),
  one shared rAF clock for wave timing, pods/rings are fixed-size elements scaled via
  `transform`, target 60fps on a phone with the canvas + a wave + particles all live.
- **Kept from the current build:** right action rail, GO LIVE pill (with ~viewers projection),
  bottom nav. ⚠ The rail is REWORKED in the Phase 8 block below — it becomes the watched card's
  engagement and actually pays (the "cosmetic counts ok v1" ruling is superseded).
- **First-run coach marks (task 7.8):** 3-step dimmed overlay anchored to real elements —
  (1) TAP CORE "Tap to earn", (2) element stage "Unlock new ways to play", (3) GO LIVE pill
  "Streams pay 10×". Advances per tap, never shows again (`uiSlice.coachMarksSeen`, persisted).
- **(Task 7.5) Pager:** the screen becomes one card in a vertical snap pager — swipe up/down
  changes the backdrop video + active **mod banner** (slim pill above the stage: mod icon +
  name + effect, e.g. "🎯 WIDE WINDOW — easier PERFECTs on this video"); poster `@handle`,
  caption, `#topic`, and tap-counter overlay bottom-left, TikTok style. TAP CORE, combo, and the
  element stage persist across swipes (combo resets, waves reschedule).

**Phase 8 — second-playtest juice pass (design LOCKED 2026-06-12; `01` §8.6, `04` §13.7–13.8):**

- **Top-zone layout contract (task 8.3).** Fixed bands at the 390×844 reference; nothing renders
  outside its band, so feed features stop colliding:

  | band | y (≈) | contents |
  |---|---|---|
  | stat strip | 0–56 | followers hero + currency pills |
  | mod banner | 56–88 | the active card's mod pill, centered in its OWN full-width band — nothing else docks here |
  | element stage | 88–340 | waves + the locked-pod dock (pods live INSIDE the band, below the banner) |
  | core zone | vertical center | TAP CORE + combo ring + tap FX + floating-text lanes |
  | left column | bottom-up | GO LIVE pill (persistent, bottom) → poster `@handle`/caption/sound block above it; width clears the rail |
  | right rail | right edge, lower third | the engagement rail — part of the CARD layer from 8.5 (slides with the card) |

  **Pager feel:** the card layer (backdrop, mod banner, poster block, and — from 8.5 — the rail)
  follows the finger (translate-Y) during the drag and slides off/in with a spring on release;
  the HUD (stat strip, element stage, TAP CORE, GO LIVE) stays fixed. The 7.5a crossfade is
  retired. After ~10s idle on a card (first session only), a small animated swipe-up chevron
  hints at the scroll.
- **TAP CORE v2 (task 8.1, zero economy change).** The core is the production centerpiece:
  - **Tier skins**, not border recolors — same `comboMilestones`: tier 0 "glass" (dim disc,
    faint inner rings), tier 1 "neon" (slow-rotating cyan conic-gradient sweep), tier 2 "plasma"
    (two counter-rotating red radial layers), tier 3 "gold rush" (gold sunburst rays + shimmer).
    Skins are stacked absolutely-positioned layers crossfaded by opacity on tier change, with a
    tier-up flash ring. A center glyph (♪) replaces the empty middle; "TAP" micro-label only
    pre-first-tap and during idle attract.
  - **Press feel:** pointer-down = squash-and-stretch (scaleX 1.06 / scaleY 0.90, ~60ms, glyph
    stamps down); release = spring overshoot to ~1.05 then settle (stiffness ~600). Shockwave =
    TWO staggered expanding rings + a brief flash disc whose intensity scales with comboMult.
    Particles: 8–12 per tap, mixed 3–7px, gravity arcs (up and out, then fall); tier ≥2 mixes in
    glyph particles (♪ ✦).
  - **Idle attract:** 6s without a tap → breathing amplitude doubles and the "TAP" label fades
    back in.
- **Arcade floating numbers (task 8.2).** One shared `FloatingTextLayer` (mounted once on Home)
  with an imperative `pushFloatText({ text, kind, magnitude })`; ALL payout text routes through
  it — core `+N`, element grades, rail payouts, sweep, VIRAL burst:
  - **Lanes:** 4 spawn lanes (x ≈ −70 / −25 / +25 / +70 from core center) cycled round-robin,
    ±10px jitter, random −8°…+8° tilt, slight horizontal drift along the rise — consecutive
    numbers can never overlap.
  - **Magnitude tiers** vs the current base tap gain: <3× = 16px in tier color; ≥3× = 22px gold
    with a thin dark outline; ≥10× = 30px, scale-pop entrance (overshoot ~1.3), bold outline,
    trailing "!".
  - **Flavor callouts** (center lane, larger): combo tier-ups print NICE! / ON FIRE! /
    UNSTOPPABLE! / VIRAL!!; the rail sweep prints SUPERFAN!; element grade words keep their `04`
    colors (PERFECT `--gold`, GOOD `--cyan`, OK `--dim`, MISS `--red`).
  - Cap ~12 live items (cull oldest); transforms + opacity only.
- **Engagement rail (task 8.5).** The rail belongs to the CARD and slides with it. Top→bottom:
  poster avatar + follow `+` (flips to ✓ once followed), ❤ likes, 💬 comments, ↗ shares —
  counters are THE CARD'S totals (`card.reactions`; NPC cards seeded per `04` §13.7, player
  cards accrue real ones), never the player's wallet. Each action pays once per video
  (`04` §13.7): the icon fills/locks (heart fills red, TikTok-style pop), the counter bumps
  optimistically, the payout floats via the FX layer. A spent button shakes ~2px and pays
  nothing. All four on one card → SUPERFAN sweep: rail icons flash gold in sequence + callout +
  bonus. The comment action also floats a canned one-liner from a preset pool ("this is fire",
  "POV: quality content", …) bottom-left — cosmetic only, moderation-safe. The bottom-left
  tap-counter icon changes ❤→👆 (binge taps) so the rail heart is the only heart on screen.
- **VIRAL (task 8.4).** Ring hits full → eruption: full-screen white flash, burst payout as a
  tier-3 float, the combo ring blazes (animated gradient stroke + heavy glow), the core goes
  white-hot, `VideoCanvas` intensity pins to 1, and a slim "🔥 VIRAL ×2" banner with a draining
  time bar sits above the core for `viralSec`. On exit the ring drains smoothly to
  `viralExitCombo` (never snaps) and the banner pops away.

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

## 6. Profile (`screens/Profile/`) — channel analytics hub

*(Updated 07 §E — Phase 11.8. No buy UI here; upgrades live in Creator Studio.)*

TikTok profile layout, repurposed as a **read-only analytics hub**. Top to bottom:

- **`ProfileHeader`:** circular avatar (generated from handle), `@handle`, bio line ("becoming the
  algorithm").
  - **Primary stat row** (TikTok-faithful): `Following · Followers · Likes`.
  - **Secondary lifetime row:** `Views · Total Followers · Streams` (slightly smaller, dimmer).
  - **Currency pills:** Coins 🪙 · Diamonds 💎.
  - **Passive income pill** (shown only when > 0): `+N/s 🪙` and/or `+N/s 👤` in a small rounded
    pill. Hidden until the player has passive income.
- **CREATOR STUDIO ›** entry row (gated to VIEWER unlock; badge if any pillar has affordable items).
  Clicking opens the Creator Studio sheet. *No buy UI below this point.*
- **Creator Insights** (inlined, no back button): the metric ladder (`screens/CreatorInsights/`)
  rendered in-page with a section label instead of a standalone header.
- **Creator Breakdown:** per-pillar (VIEWER / POSTING / LIVE) card — unlocked/locked badge, READY
  badge if `affordablePillars.includes(pillar)`, and skill-level chips for all skills in that pillar.
  Locked pillars render at reduced opacity.
- **Element Portfolio:** 2×2 grid of all 4 elements (BEAT SYNC / DUET LOOP / HOLD DROP / SWIPE
  HITS). Each card shows icon + name + OWNED (cyan) or LOCKED (dim). Locked cards at 40% opacity.
- **`CloudAccountPanel`** at the bottom (account sync / reset — unchanged).

## 7. Live (`screens/Live/`) — the run (full-screen overlay)

This is a TikTok LIVE screen. Full-screen, hides the BottomNav.

- **Top bar:** `@handle` + a pulsing **LIVE** badge, current **viewer count** (big, top-left like
  TikTok), the active **#trend**, and a **stream timer** countdown. Show rolled **run modifiers** as
  small chips.
- **Hype meter:** a prominent bar (0–100) — the momentum gauge. Color shifts toward `--red`/`--gold`
  as it climbs. This is the player's main feedback.
- **Center/background:** the "stage" — **(Phase 7.5)** the `VideoCanvas` procedural visual,
  seeded by the streamer's `streamId`/`handle` + topic, runs full-bleed behind everything (both
  streamer and spectator views) with animation intensity scaling with hype, under a dark scrim
  that keeps feed/meter legibility. No dead center (`01` §8.4). Particle/gift visuals float here
  (DOM/Framer Motion; escalate to Pixi only if needed).
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
- `VideoCanvas` — (Phase 7) the procedural "video" visual: deterministic from a seed string +
  topic; props for `intensity` (0–1, drives animation energy) and `dim`. Used by feed cards AND
  the Live stage backdrop. Pure CSS/Framer animation; must hold 60fps on a phone.
- `StatPill` — label + value + optional icon, `formatCount`.
- `CurrencyRow` — the followers/likes/coins/diamonds cluster.
- `ProgressBar` — used for hype, cooldowns, trend heat.
- `IconButton` / nav icons — keep the SVG style already in `public/icons.svg` / `TapButton`.
- `LockBadge` — shows `requires` on locked upgrades/skills.

## 10. Phase 9 — Onboarding & progressive unlock (`01` §10)

### 10.1 TEB first-press teaching (Phase 9.1 — `TapCore.tsx`)

On the very first TEB tap ever (`!tebTeachSeen`): a one-time callout tooltip slides in above
the combo multiplier readout — copy: **"The Engagement Button"** (display font, large) with
sub-line **"tap to grow your channel"** (mono, small). Auto-dismisses after 3 s via
`AnimatePresence`. After dismiss, `setTebTeachSeen()` fires (persists across sessions). The
idle "TAP" micro-label inside the button is unchanged.

### 10.2 Creator Insights screen (Phase 9.4 — `screens/CreatorInsights/`)

Reached from a "CREATOR INSIGHTS ›" row on the Profile screen's stats section.

- **Header:** "CREATOR INSIGHTS" (display font), subtitle "lifetime metrics" (mono, dim).
- **Metric ladder:** scrollable list. Each row:
  - Icon + stat name + threshold (e.g. "100 VIEWS")
  - Reward badge: coin/diamond icon + amount
  - Unlock label if applicable ("↳ unlocks Creator Tools")
  - State: ✓ checked (cyan) if reached; highlighted/gold for the *next* unmet metric; dimmer
    beyond the next two.
- **Home tracker chip** (Phase 9.3): bottom of Home screen, above nav — "▶ 100 VIEWS → +60🪙 ·
  Creator Tools". Tap → navigate to Creator Insights. Updates as metrics are crossed.

### 10.3 Fresh Home layout (Phase 9.3 — post progressive-unlock)

> **Superseded for fresh saves by Phase 18 (`14`, this doc §13).** Keep this as historical behavior
> for preserved old saves only; do not combine its independent metric reveals with the new journey.

Before any metric is crossed, Home renders ONLY:
1. Top stat strip: followers (hero) + coins pill.
2. TEB at center, with first-press teaching (§10.1) + idle "TAP" attract.
3. Ambient `VideoCanvas` backdrop (always on, NPC seed pre-7.5).
4. Bottom nav: Home tab active; other tabs hidden/dimmed until their unlock metric is crossed.

Each feature appears silently as its metric is crossed — no ceremony beyond the inbox
notification. The "next metric" tracker chip appears on Home from the first metric onward.

### 10.4 Repeatable upgrade section in UpgradeShop (Phase 9.1 — `components/UpgradeShop.tsx`)

A new **LEVEL UP** section renders at the TOP of the UpgradeShop list (before GEAR/SOFTWARE).
Each row:
- **Name** (display font, 19px) + **description** (mono, 10px dim) — e.g. "+1 POST POWER/LV"
- **LV N** badge (mono, cyan) showing the current level
- **Next cost** (display, 22px, cyan if affordable / dim if not) + "COINS" label
- **LEVEL UP** button (full-width, cyan bg when affordable, dim when not/maxed)
- At `maxLevel`: replace cost/button with "MAXED" (gold, mono) — row stays visible as a trophy

The section header reads "LEVEL UP" with the same mono + hairline-divider treatment as GEAR /
SOFTWARE. No "OWNED" state — repeatables are always levelable until maxed.

## 11. Phase 10 — Creator Studio & FYP de-clutter (`01` §11)

### 11.1 Creator Studio screen (`screens/CreatorStudio/`)

> **Phase 18 opening override:** use §13.3's one-tab/one-card Studio until a later chapter is authored.
> The full three-pillar surface below remains dormant for later progression.

Full-screen hub opened via:
- A **STUDIO** button in the Home top stat-strip (right side, compact icon+label), gated by the
  `viewer` unlock (~10 followers).
- A **CREATOR STUDIO ›** entry row on the Profile screen (same gating).

**Layout:**
- Header: "CREATOR STUDIO" (display font) + close ✕ button (top-right).
- Pill-tab row: **VIEWER · POSTING · LIVE**. A tab is only rendered if its pillar is unlocked.
  Active tab: cyan underline + `--text`. Inactive: `--dim`.
- **Currency bar** (`components/CurrencyBar.tsx`, Phase 11.1): a sticky sub-header directly below
  the pill-tab row, above the scrollable content — outside the scroll container so it never
  scrolls away. Shows three pills (coins 🪙 gold, followers red, diamonds 💎 cyan), same visual
  language as `ProfileHeader`'s currency pills (which now import `CurrencyPill` from this file).
  Likes are omitted (not spent on upgrades). Reads live from `wallet` via store selector, so it
  updates immediately on any purchase.
- Scrollable content area per tab:
  - **VIEWER**: repeatable upgrades (viewer pillar) + gear/software (viewer pillar, linear-locked
    as on Profile) + Charisma + Editing skills + element unlock list.
  - **POSTING**: posting-pillar upgrades + posting skills (placeholder until Phase 10.2).
  - **LIVE**: live-pillar gear/software + Stagecraft/Monetization/Network skills.

Buying/leveling from the Studio updates the store exactly like buying from Profile. No separate
action needed.

**Buy-button affordability hint (Phase 11.1):** when a repeatable upgrade, one-time gear/software
item, or skill is affordable, its cost block shows a small dim "after {formatCount(coins after
purchase)}" line below the "COINS" label — lets the player see their post-purchase balance without
mental math.

### 11.2 FYP top stat-strip additions

When `viewer` is unlocked, the stat strip gains a **STUDIO** pill button (left of currency
pills). Tap → open Studio overlay.

### 11.3 FYP element stage (post 10.1)

Remove locked "???" pods entirely. `ElementStage` renders ONLY active waves; the
`LockedPod` render block is deleted. Unlocking elements happens in Studio → Viewer.

## 13. Phase 18 — staged opening and interaction-field rhythm (`14`)

### 13.1 Sparse pre-video Home

Before `video_fyp`, Home uses a dedicated composition rather than an empty version of the final
feed. Render only:

1. Followers hero at the top; add the Coin pill only when Studio reveals it.
2. One compact current-goal chip with action, progress, and reward.
3. The TEB system centered in the large free interaction field, labeled **ENGAGEMENT** during the
   staged opening. Every press emits an animated reaction; successful Follower rolls explicitly
   call out `+1 FOLLOWER`.
4. Ambient background motion with no fake video metadata.
5. A Studio edge button only after its reveal.

Do not render hidden feature placeholders, social rail, video caption, creator avatar, currency
pills at zero, passive-income copy, or a scrollable milestone list. Keep BottomNav visible from the
start, but only Profile is enabled during the sparse opening; its early layout shows available
channel stats, account/reset controls, and an explicit Back to Engagement action. The current goal
chip must stay clear of TEB and be no taller than two short lines at 320px width.

### 13.2 Reveal and teaching pattern

Major unlocks use one consistent four-beat interaction:

```text
goal completes → compact celebration names the feature → SHOW ME
→ camera/focus travels to the new control → one-action coach mark → normal play
```

- Celebration is anchored near the unlocked control, not a generic center modal.
- Other unlock checks pause until the first-use teach resolves.
- Dismissed teaches leave a gentle cyan/red pulse and change the goal chip to `TRY <FEATURE>`.
- Use strong motion only for the reveal; normal available/affordable states use restrained glow.
- Reduced motion replaces travel/scale with opacity, outline, and focus order.

### 13.3 Creator Studio onboarding mode

Studio initially shows a header/back button, a single **FYP** tab, Coin balance, and one full-width
Audience Reach card. The card's hierarchy is:

- name + `LV N`;
- plain-language benefit;
- large exact `current → next` value;
- cost and one primary `UPGRADE` action.

Do not print the current Follower-chance percentage on the TEB; the button always reads
**"THE / ENGAGEMENT / BUTTON"**. After Lv1 purchase, animate the Studio's changed
Follower-chance value first, then reveal Engagement Rate below it and enable Audience Reach's next
level. A level-zero card uses a gold `NEW BONUS` badge and `UNLOCK BONUS` action; an owned card
uses cyan `LEVEL N` and `LEVEL UP`. Supporting copy is at least 13px on phone with high-contrast
text and an opaque card backing. Do not show locked future categories or cards.

### 13.4 Engagement-ready TEB

When Engagement Rate is introduced, a thin engagement ring/meter becomes part of TEB's existing
visual anatomy and begins filling on quick taps without competing with the Followers float text.
Before rhythm unlocks it reads as progress being built for TAP THREE but cannot launch a chart. At
full after rhythm unlocks:

- the ring closes and holds a stable gold edge;
- idle copy changes to `READY — HOLD`;
- the first-time hold/release teach points directly to TEB;
- the state remains readable without pulsing the entire screen.

### 13.5 Rhythm interaction field (corrected Phase 17 behavior)

Count-in, play, and result remove only TEB and TEB-local clutter. Keep top stats, Studio control,
video, avatar/handle, caption, social rail, and bottom navigation visible at their normal opacity.
Do not mount a full-screen dim layer.

Measure the available center from live chrome rectangles. Rhythm targets render inside that field;
chrome remains above/beside it visually and is temporarily pointer-inert. On 390×844, reserve the
top stat strip, right rail, lower caption block, and nav. On 320×640, reduce target spread/spacing
before reducing hit areas. Result feedback reforms into TEB at center.

### 13.6 Video FYP chapter transition — deferred

Do not restore the video feed, social rail, or captions in Phase 18. After the
first TAP THREE completion, retain the sparse opening composition and its repeatable engagement
loop until a later phase defines the authored video-FYP chapter transition.

## 9. Visual language rules

- Layout = TikTok (familiar, clean, dark, bottom-nav, profile grid). Accents = our CRT/terminal
  identity (mono labels in caps with letter-spacing, chromatic wordmark, thin red/cyan lines, the
  scanline overlay). Don't let the CRT flavor fight the TikTok legibility — it's seasoning.
- Typography already set: `--font-display` (Bebas) for big numbers, `--font-mono` (JetBrains) for
  labels/HUD, `--font-ui` (Rajdhani) for body.
- Every number that can get large uses `formatCount`. Every actionable element has a pressed state
  (Framer `whileTap`/scale), matching current components.

## 12. Phase 17 — TEB Rhythm Canvas (`13`)

### 12.1 Playfield takeover

On charge release, `RhythmPlayfield` becomes the Home screen's interaction owner from count-in
through result:

- hide and disable top stats, Studio, modifier/buff pills, video info, engagement rail, metric
  tracker, swipe hint, GO LIVE, and bottom navigation;
- freeze feed paging and engagement-rail actions;
- keep the active `VideoCanvas` moving beneath a dark scrim/vignette at reduced contrast;
- mount the rhythm layer above the video and below global emergency/system sheets;
- capture the measured playfield rectangle after chrome exits, then build chart geometry;
- restore all feed chrome only after result grace, not between the last hit and reward.

The usable field respects CSS safe-area insets but includes the space normally occupied by the
right rail and bottom nav. At 390×844 the first target may not enter the top 52 px or bottom 28 px;
at other sizes derive insets from the actual container and safe-area variables.

### 12.2 Persistent rhythm HUD

Only one HUD cluster remains during play:

- top-left: `×N` rhythm combo, hidden at zero;
- top-right: compact live quality percentage or four-segment quality ticks;
- no timer bar, score panel, chart card, currency display, or permanent instructions;
- HUD uses code-native `--font-display` numbers and `--font-mono` labels with a dark text keyline;
- HUD never receives pointer events.

### 12.3 Count-in and teaching

Count-in lasts 720 ms and shows:

- chart name (`TAP THREE`, `HOLD THE BEAT`, `CONNECT`, or `RIDE THE LINE`);
- one original SVG gesture pictogram;
- one verb: `TAP`, `HOLD · RELEASE`, `PRESS · CONNECT`, or `PRESS · TRACE`;
- three restrained field pulses; no modal/card backdrop.

On first encounter, add one extra gesture demonstration before count-in. The teach may be skipped,
is recorded per chart, and disappears before the first target becomes active.

### 12.4 Targets, paths, and judgement bursts

- Visible target diameter: 72 px default, never below 64 px.
- Upcoming targets use a dark glass disc, white keyline, and separated cyan/red chromatic ghosts.
- The current target uses a gold approach ring contracting from 2.2× to 1×.
- Target order is always encoded with a number/glyph, never color alone.
- Hold targets add radial fill and a converging release cap.
- Swipe paths show dim future links and illuminate completed links behind the pointer.
- Trace paths use a broad dark rail, thin white center, cyan/red edge ghosts, and a guide bead.
- PERFECT/GREAT/GOOD/MISS appears at the resolved target for <=420 ms, then leaves the field.
- MISS is readable but quiet: inward collapse, broken ring, no full-screen red wash.

### 12.5 Result and TEB return

The last resolved target collapses toward the center and reforms as TEB. A short center judgement
bloom precedes the existing reward banner. The banner shows:

- chart name;
- charge grade;
- performance grade;
- max rhythm combo;
- coins/followers/likes reward.

The banner must not look like a generic modal. It is a compact anchored layer near TEB; tapping TEB
continues normal engagement while the launch cooldown runs.

### 12.6 Responsive, accessibility, and reduced feedback

- Rebuild normalized geometry after resize/orientation change; never stretch an old chart.
- Use a larger invisible hit radius than the visible disc.
- `prefers-reduced-motion` removes spark travel, field zoom, and after-image drift but preserves
  timing rings, path fill, target state, and judgement text.
- A `reducedFeedback` setting removes haptics, strong flash, and screen-scale completion bloom.
- Keyboard fallback is visible only after keyboard input or in accessibility settings.
- All chart text maintains 4.5:1 contrast against the darkest keyline/backing treatment.
