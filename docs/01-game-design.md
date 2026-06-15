# 01 — Game Design Document

> Source of truth for *what the game is*. Numbers live in `04-economy-formulas.md`; types in
> `03-data-model.md`; screens in `06-ui-screens.md`. When this doc and your intuition disagree,
> this doc wins.

## 1. Vision

You are a TikTok creator clawing your way from 0 followers to algorithm domination. The game has
two interlocking layers:

- **Meta layer — "Channel" (incremental/clicker).** Always-on. You post content, earn currency,
  buy gear, and level creator skills. This is your persistent progression. It never resets (except
  optional prestige). **It exists to make your livestreams better.**
- **Run layer — "LIVE" (roguelike).** On demand. You start a livestream — a timed "run" — and
  react to a live feed of comments, gifts, and events. Each run is randomized but **bounded and
  scaled by your meta progression.** Runs are where you earn the bulk of your rewards. A run can
  flop (end early, poor payout), but your meta progress is always safe.

The connective tissue (the thing that makes this *one* game and not two): **more followers →
more viewers; better skills → better events, slower hype decay, richer gifts; better gear →
stronger reactions.** You grind the clicker to go live bigger, you go live to grow the clicker
faster. See `04-economy-formulas.md` § "Meta → Run bridge" for the exact mechanics.

## 2. Design pillars

1. **Authentically TikTok.** Layout, vocabulary, and feel mirror the real app (FYP feed, LIVE
   gifts like Rose/Galaxy/Lion, hashtags, For You). Players who use TikTok feel at home instantly.
2. **The grind has a payoff you play.** Idle progression is not the destination; it's the loadout
   you bring into a run. Every upgrade visibly changes how a stream goes.
3. **Runs are different every time, but earned.** Randomness creates variety; meta progression
   creates power and control. You never feel cheated — bad runs trace to under-preparation.
4. **Built for an audience.** The game is developed live; mechanics should be legible and fun to
   watch and suggest. Favor readable systems over hidden math.
5. **Community is the long game.** Eventually players' streams affect each other (raids, shared
   trends, global events). Architect for it now; build it last.

## 3. Currencies & resources

| Resource | Symbol | Role | Earned from | Spent on |
|---|---|---|---|---|
| **Followers** | 👤 | Headline progression stat. Gates content/skills; **scales run viewership.** Rarely spent. | Posting, runs (the big source), milestones | Unlock gates (thresholds), rarely direct cost |
| **Coins** | 🪙 | Main soft currency. | Posting, passive catalog income, runs (gifts→coins) | Gear, software, skill levels |
| **Diamonds** | 💎 | Premium/rare currency. The roguelike "meta-reward." | LIVE gifts (rare), run completion bonuses, milestones | Elite gear, prestige perks, rare unlocks |
| **Likes** | ❤️ | Engagement. Feeds multipliers and some thresholds. | Posting, runs | Some upgrades; passive multiplier source |

Run-only resources (exist only during a live run, never persisted):

| Resource | Role |
|---|---|
| **Viewers** | Live concurrent audience. The run's "health/scale." Falls to the flop floor → stream ends. Drives gift rate and final payout (peak viewers matters most). |
| **Hype** | Momentum meter 0–100. Global multiplier on gains. Decays over time; raised by riding hype waves and good reactions. |
| **Stream timer** | Runs last a fixed duration (default 180s real-time, tunable). Ending voluntarily at high hype grants a bonus. |

## 4. Meta layer — "Channel" (the incremental engine)

### 4.1 Posting (active clicker)
The core active action. The player creates a post (a tap). Each post grants Coins + Followers +
Likes scaled by **Post Power** and the global **Multiplier**. This is the evolution of the current
"POST NOW" button — reframed as "create a post." Formula in `04` § Posting.

- **Catalog (Phase 1.x enhancement, optional for MVP):** each post can become a persistent
  *video* in your catalog that generates passive income over time (TikTok back-catalog). MVP may
  model passive income as a single `coinsPerSec` stat from gear instead; the catalog is the
  richer target. The data model supports both — see `03` § Catalog.

### 4.2 Gear & Software (upgrades — reworked shop)
One-time (MVP) purchases that boost stats. Two visible categories:
- **Gear** (hardware: lighting, ring light, mic, camera, tripod, green screen) — boost Post Power,
  passive income, and specific **run stats** (e.g., camera → starting viewers; mic → troll
  resistance).
- **Software** (editing apps, scheduler, analytics, "algorithm hacks") — multipliers, follower
  conversion rate, passive tick rate.

Costs are **Coins** (and **Diamonds** for the elite tier). This replaces the current scaffold
where upgrades cost *followers*. Catalog of upgrades + effects in `04` § Upgrades.

### 4.3 Creator Skills (the explicit meta→run bridge)
A small set of leveled stats. **Each level visibly changes runs.** These are the heart of the
"clicker controls the livestream" promise.

| Skill | Meta effect | Run effect |
|---|---|---|
| **Charisma** | +Post Power | +starting viewers, +viewer growth from hype |
| **Editing** | +passive income, +follower conversion | +follower payout per run (conversion rate) |
| **Stagecraft** (Hype) | small ×income | slower hype decay, stronger hype waves |
| **Monetization** | small ×coins | higher gift rate & gift value during runs |
| **Network** | unlocks collabs | better raid/collab events (and multiplayer raids later) |

Leveling costs escalate in Coins and may gate behind Follower thresholds. Exact curves in `04`.

### 4.4 Prestige — "Rebrand" (Phase 3)
Optional reset: trade your Followers/Coins for a permanent **Clout** multiplier and keep
Diamonds + select unlocks. Encourages replay. Deferred to Phase 3; design stub only for now.

## 5. Run layer — "LIVE" (the roguelike)

### 5.1 Pre-stream setup
From **Discover** (or a "Go LIVE" sheet), the player picks a **trend/topic** to stream. The game
computes the run's starting parameters from meta state (`04` § Meta→Run bridge):
- `startViewers` from Followers + Charisma + topic match
- `giftRate`, `giftQuality` from viewers + Monetization
- `hypeDecay` from Stagecraft
- `eventInterval` / event pool & difficulty from viewers + unlocked content
- available **Reactions** (hotbar) from Gear/Skills
- **run modifiers** rolled randomly (see 5.5)

### 5.2 The live feed (core loop)
A vertical, auto-scrolling feed (TikTok LIVE style) spawns **events** over time. The player
watches and reacts. Event types:

| Event | Behavior | Player action |
|---|---|---|
| **Comment** | Flavor text scrolling by; some are *choice prompts*. | Usually ambient; choice prompts offer 2–3 quick options with different effects. |
| **Gift** | A gift icon floats up (Rose/Heart/Galaxy/Lion, ascending value). | **Tap to collect** → Coins / Diamonds. Missed gifts expire. |
| **Hype wave** | Viewers surge; a "ride the wave" prompt appears briefly. | Tap/react in time → big Hype gain + viewer boost. |
| **Troll / hater** | Drains Hype (and viewers) while present. | Use a **Clapback** reaction (or tap to dismiss) before it does damage. |
| **Raid / collab** | Another creator's audience pours in → viewer boost. (Later: real players.) | Accept; may trigger a short collab bonus. |
| **Sponsor ping** | Offers Coins now but annoys viewers (small viewer dip). | Accept (greedy) or decline. |
| **Challenge** | "Do X in Y seconds" mini-goal (e.g., N taps). | Complete for a reward. |

The run **ticks** faster than the meta loop (event spawning, hype decay, viewer drift, gift
timers). See `02` § Game loops.

### 5.3 Reactions / hotbar (the build)
A small set of activated abilities with cooldowns, unlocked via meta (Gear/Skills). Examples:
- **Hype Dance** — +Hype.
- **Clapback** — neutralize a troll.
- **Pin Comment** — convert a comment into followers.
- **Shoutout** — temporarily boost gift rate.
- **Go Off** (ultimate) — short burst of huge multiplier; long cooldown.

Which reactions you bring = your loadout = roguelike build expression. Unlock rules in `04`.

### 5.4 Resources & failure
- **Viewers** drift/decay; troll events and ignored hype cost viewers; hype + good reactions grow
  them. If viewers stay below the **flop floor** for `FLOP_GRACE` seconds → **the stream flops**:
  it ends early with a reduced payout.
- **Hype** decays continuously; multiplies all gains. Riding waves & reactions raise it.
- **Timer** counts down from the run duration. Player may **End Stream** early; ending at high hype
  grants an **outro bonus**.

### 5.5 Roguelike variety — run modifiers & boons
- **Run modifiers** (rolled at start, 1–2 per run): e.g., "Algorithm Boost" (×viewers, but faster
  decay), "Tough Crowd" (more trolls, bigger gift payouts), "Trending Sound" (hype waves more
  frequent). These reshape the event pool and scoring so runs feel distinct.
- **Post-run boon (Phase 2.5):** on a successful run, choose 1 of 3 rewards (e.g., a temporary
  next-run buff, bonus Diamonds, or a permanent small unlock). This is the roguelike "reward pick."

### 5.6 End of run — scoring & rewards
On stream end (voluntary, timer, or flop), convert performance into meta currency:
- **Followers gained** = f(peak viewers, final hype, trend multiplier, Editing conversion). This is
  the big payout and why runs are primary income.
- **Coins / Diamonds** = what you collected (tapped gifts) + a completion bonus scaled by hype.
- **Likes** accrued.
- A results screen shows the breakdown (peak viewers, gifts collected, followers gained, grade).
Exact formulas in `04` § Run scoring.

## 6. Game flow (player journey)

1. Onboarding: pick a creator handle (exists today). →
2. Channel hub: post content, earn Coins, buy first Gear, level a Skill. →
3. First LIVE: pick a trend, run the feed-and-react loop, earn a big Follower payout. →
4. Loop: spend run rewards on Gear/Skills → stronger runs → bigger payouts → unlock new content,
   trends, reactions, and eventually prestige. →
5. (Later) Community: ride global trends, get raided by / raid real players, join global events.

## 7. Multiplayer — real spectator streams (Phase 4; design LOCKED 2026-06-10)

**Core decision: a run is a real livestream other players can watch and interact with.** The
single-player game already *simulates* a live audience; multiplayer makes parts of that audience
real. Real players' joins, taps, comments, and gifts arrive in the streamer's feed as events typed
identically to simulated ones (flagged `real`, rendered with a glow). NPC events keep filling the
gaps, so a stream with zero real viewers plays exactly like today's single-player — the game
degrades gracefully at any population.

### 7.1 The viewer loop (watching is gameplay)
- **Discover** lists who is live now (TikTok LIVE-tab style cards: streamer, topic, viewers, hype).
- Joining opens a **read-only spectator Live screen** (same UI as streaming) plus a viewer action
  bar:
  - **Hype taps** — free, rate-limited heart-spam; each tap nudges the streamer's hype.
  - **Quick-chat** — canned TikTok-style comments ("W", "🔥🔥🔥", "an icon"…). No free text
    (moderation surface + more authentic to TikTok spam culture). Appears in the streamer's feed
    under the viewer's handle.
  - **Gifts** — cost the viewer coins; the streamer gets the coins + a hype spike; the viewer gets
    a partial clout-back scaled by the streamer's **creator level**, plus an **early-backer
    jackpot** if a gift sent in the first 30s ends in an ≥A-grade run ("I backed them first").
  - **Votes** — the streamer's choice events double as audience polls; the majority boosts the
    chosen effect, winning voters share a payout.
- **Watch-drops:** when the stream ends (or the viewer leaves), the viewer receives a single drop =
  watch time × streamer's creator level × the run's final grade. Higher-progressed streamers are
  better loot zones — **progressed players literally become content and rewards for everyone
  else.** This is the global effect: the more anyone grinds, the richer everyone's options.

### 7.2 The streamer side
Real viewers are strictly better than sim ones: they count extra in the viewer total (and payout),
their gifts are bonus income, their taps slow hype decay, a real crowd effectively raises flop
protection. Post-run, the streamer can **shout out** their top real gifter — that viewer gains
followers. Reciprocity in the loop.

**Economy guardrail:** viewing earns **coins** (and rare diamonds); **followers stay
streamer-primary** (watch-drops grant only token follower amounts). Watching makes you richer;
streaming makes you bigger. This keeps "everyone lurks, nobody streams" from being optimal.

### 7.3 The Algorithm (global meter)
One server-wide meter fed by all live activity (streams started, watch-seconds, gifts). Decays
hourly; at thresholds grants everyone tiered buffs (FED: +10% all income; BLESSED: +25% + bonus
run modifier). Shown on Discover like a world-boss bar. Collective play visibly improves the whole
game — the simplest, most legible "players affect everyone" mechanic.

### 7.4 Also in Phase 4
- **Server-authoritative trends** (was the old 4.1): trend rotation lives in the lobby server;
  streaming a trend pushes its heat for everyone.
- **Leaderboards:** global and per-trend (the existing PartyKit trend room is the seed).
- **Supabase** last: accounts, cloud saves, persistent leaderboards, stable player ids (until
  then, handle = identity; acceptable for beta).
- **Known constraints (accepted for beta):** client-trusted rewards are spoofable — server-side
  validation comes with Supabase; cold-start handled by sim "featured streams" filler + the game
  being fully playable solo; 3-min runs keep the directory fresh (a "stay live" run-chaining
  option is a possible later addition).

Architecture rule still stands: run scoring and trend state stay expressible as messages a server
could authoritatively own later. See `02` § Multiplayer-readiness.

## 8. The Feed — the clicker becomes a video feed (Phase 7; design LOCKED 2026-06-12)

**Origin: first human playtest (2026-06-12).** Findings: players don't know what's tappable or
why; the center of every screen is blank; the clicker has no fiction. This redesign fixes all
three with one structure: **the Home screen becomes a real TikTok-style vertical video feed, and
the clicker lives at its center.**

### 8.1 The structure (REVISED 2026-06-12 after design session — elements first, videos after)
- Home houses **the clicker gameplay loop**. Dead center: the **TAP CORE** — a large,
  obviously-tappable pulsing target. Tapping it ("engaging") earns the existing per-tap gains
  (economy unchanged, `04` §1) × a **combo** multiplier that builds with consecutive taps and
  drains when you stop. Floating `+N` numbers, bursts, and the combo ring make every tap legible.
- Behind everything, a full-bleed **`VideoCanvas`** ambient visual (NPC-seeded until the video
  system lands) — the screen is never blank, and the canvas *reacts* to play (tap pulses, wave
  hits spike its intensity).
- Above the core sits the **element stage**: the zone where unlockable gameplay **elements**
  spawn interactive "waves." This is the progression surface — see §8.2.

### 8.2 The element system (the addiction engine)
**Elements are gameplay mechanics you unlock with the resources the game pays you.** Each is a
self-contained minigame that works *alongside* the base button, registered in a catalog
(framework first — adding element N+1 must be a catalog entry + one component, no framework
surgery). Unlocks cost coins and are gated by metrics (followers etc.); **locked elements are
visible on the FYP as dim "???" pods showing their unlock requirements** — desire before access.
A **scheduler** runs at most ONE element wave at a time (phone-screen clarity), rotating through
unlocked elements with breathing gaps; the base button always works.

Launch elements (both rhythm-flavored — the fiction is TikTok's own audio culture):
1. **BEAT SYNC** (timing rings): a pod row of 3 buttons appears; a glowing **approach ring
   shrinks** onto each; tap each button exactly when its ring matches its size. The three rings
   are **staggered**, so clean play is literally tapping a rhythm. Graded per tap —
   PERFECT / GOOD / OK / MISS — with payouts multiplying the base tap gain; an all-PERFECT wave
   pays a bonus. (Think osu!/Guitar Hero compressed into 2 seconds of TikTok sound culture.)
2. **DUET LOOP** (call-and-response): 3 dormant pods; **each requires a TAP CORE tap to arm it**
   — tap the core, an energy beam ignites the next pod, tap the pod, back to the core… Fast
   full chains earn a **FLOW** bonus. The back-and-forth IS the rhythm; and because core taps
   build combo, Duet Loop naturally feeds the combo engine while you play it.
Payouts everywhere are `× gainPerPost × current comboMult` (`04` §13) — elements and the base
button feed each other instead of competing.

### 8.3 Videos & posting (integrates AFTER the element system is fun on its own)
The player-video feed (publish via POST, server pool, NPC padding, swipe-up pager, royalties —
all as previously designed) layers on top **once the clicker loop stands alone**. The key change
from the original §8 design: videos no longer carry flat stat boosts — **a video's bonus
modifies the clicker mechanics themselves** (slower rings, an extra ring, wider timing windows,
longer FLOW windows, supercharged core taps, faster wave spawns…). Swiping is hunting for the
modifier that fits how you like to play; posting puts YOUR modifier card in everyone's feed.
Captions stay preset-template-only (moderation), publish stays burst+cooldown, royalties stay
live-only likes. Tap = engage ≠ post (the 3.3-era tap-to-post stays retired).

### 8.4 No more blank centers (applies to every mode)
The `VideoCanvas` visual also becomes the **Live stage backdrop** (streamer and spectator),
seeded by the streamer's identity/topic, with intensity that scales with hype. Rule going
forward: **no screen ships with a dead center** — something animated and meaningful occupies it.

### 8.5 First-run legibility (from the same playtest)
A one-time 3-step coach-mark overlay on first Home visit (TAP THE CORE → the element stage:
"unlock new ways to play" → GO LIVE for the real rewards), an idle "TAP" pulse hint, and an
affordance rule: **every interactive element shows a visible label** — if it's a button, it must
look like one.

### 8.6 Second playtest (2026-06-12) — juice, the engagement rail, VIRAL (design LOCKED)
**Findings:** the TAP CORE works but feels flat — the press animation and the floating numbers
read as placeholder (every `+N` spawns in the same spot, same size, and they overlap); the right
rail LOOKS tappable (it's TikTok's visual grammar) but does nothing — the worst affordance lie
on the screen, and it shows the player's own wallet, which confuses "my stats" with "this
video"; filling the combo ring has no payoff moment; the mod banner overlaps the locked element
pods. Four locked responses:

1. **Juice pass (zero economy change).** The core becomes the production centerpiece it should
   be: per-tier visual skins (not just border recolors), squash-and-stretch press feel, layered
   shockwaves, gravity-arc particles, a center glyph, an idle attract state. Floating numbers
   become arcade pop text: spawn lanes so they never overlap, size scaled by payout magnitude,
   flavor callouts on milestones. One shared FX layer serves every payout source (core, elements,
   rail, viral) so the language stays consistent. Visual spec `06` §3 (Phase 8 block).
2. **The rail is the video's engagement — and pressing it pays.** Rail counters stop mirroring
   the player's wallet and show the WATCHED card's real totals (likes/comments/shares — NPC cards
   seeded with plausible counts, player cards accrue real ones). Each rail action (follow, like,
   comment, share) is a **once-per-video micro-payout** (× comboMult); doing all four on one card
   pays a SUPERFAN sweep bonus; on player cards the reactions flow back to the poster as royalty
   likes/followers. This makes the rail honest (it does something), teaches scrolling (a fresh
   card = a fresh rail), and deepens multiplayer (your engagement literally pays the creator).
   Numbers `04` §13.7.
3. **VIRAL — the combo-cap payoff.** Filling the ring now ERUPTS: an instant burst payout plus a
   short VIRAL state where every payout is doubled while the ring blazes; then the combo settles
   back to a floor and the climb restarts. The combo becomes a pump-and-pop jackpot cycle instead
   of a meter that quietly saturates. Numbers `04` §13.8.
4. **Top-zone layout contract + true scroll feel.** Fixed vertical bands (stat strip / mod banner
   / element stage) so nothing overlaps as feed features stack up, and the pager card follows the
   finger and slides like TikTok (crossfade retired) — the groundwork for the full video-scrolling
   loop. Spec `06` §3.

## 9. Out of scope (for now — note so models don't build them)

- Real video/audio, real TikTok API integration, real accounts of real creators.
- Monetization/IAP, ads.
- Sound design (optional juice, Phase 3+).
- Anti-cheat / server authority (runs are client-trusted until Phase 4 hardening).

## 10. Onboarding, Creator Insights & progressive unlock (Phase 9; design LOCKED 2026-06-13)

**Origin: post-Phase-8 review.** A 0-follower player landing on Home faces the full Phase-8
surface — video pager, engagement rail, element pods — with almost none of it usable or legible
cold. There's also no fast early-reward loop and the clicker has no first-press teaching. This
pass makes the early game legible and motivating.

### 10.1 The Engagement Button (TEB) — display rename

Display/fiction: the clicker is **The Engagement Button (TEB)**. On the player's very first tap
ever a one-time callout appears: "The Engagement Button — tap to grow your channel." The
existing idle "TAP" micro-label stays. Internal identifiers (`TapCore.tsx`, `engageTap`,
`combo`) are unchanged.

### 10.2 Creator Insights — the progression spine

A **Creator Insights** screen (TikTok-authentic analytics fiction) surfaces a ladder of
**metrics** the player climbs. Each metric: a tracked stat → a threshold → a reward
(coins / 💎) → an optional feature unlock. The whole ladder is always visible — completed
(checked), upcoming with requirement + reward + unlock — so the player always has the next
target in sight. Desire before access.

Metrics are real TikTok analytics stats:
- **Views** = lifetime TEB taps (persisted as `viewsTotal`; incremented by `engageTap`).
- **Followers** = `wallet.totalFollowers` (monotonic). **Likes** = `wallet.likes`.
- **Streams** = lifetime runs completed. **Coins earned** (lifetime).

This generalizes today's `FOLLOWER_MILESTONES` / `checkMilestones` / `milestonesReached`.

### 10.3 Progressive-unlock framework

`isFeatureUnlocked(featureId)` derives from which unlock-bearing metrics have been crossed
(reads `metricsReached`; no extra persisted set needed). UI surfaces render nothing until
unlocked. Gated surfaces and their unlock metric:

- Creator Tools / Upgrades (Profile) → 100 Views
- GO LIVE pill + Create/Live tab → 100 Followers
- Diamonds pill → 50 Followers; passive-income readout → first passive source owned
- Inbox tab + daily reward → first Stream completed
- Discover tab (trends) → 500 Followers
- Feed pager + engagement rail + mod banner + element stage → 1,000 Followers

**Fresh Home** = TEB (named, first-press teaching) + followers/coins stat strip + ambient
`VideoCanvas` backdrop. Nothing else until metrics are crossed. An "active metric" tracker
chip on Home always shows what to aim for next.

### 10.4 Dual-axis upgrades — repeatable leveled upgrades

The existing one-time gear/software catalog ("obtain new content") gains a second axis:
**repeatable leveled upgrades** ("improve along the way"). A `repeatable: true` flag on
`UpgradeDef` adds `baseCost`, `costGrowth`, `maxLevel`; levels stored in a new persisted
`upgradeLevels: Record<string, number>`. Cost at level L = `round(baseCost × costGrowth^L)`.
Effects scale linearly with level (`postPowerAdd`, `followerConversionAdd`,
`passiveCoinsAdd`); `multiplierMult` compounds via `Math.pow`. See `04` §14 for numbers.

**Early repeatable catalog** (available immediately, no gating):
1. **Engagement Boost** — +postPower/level. 10 🪙 base, ×1.45/level.
2. **Loyal Followers** — +followerConversion/level. 40 🪙 base, ×1.5.
3. **Auto-Engage Bot** — +coins/sec passive/level. 75 🪙 base, ×1.6.

Core loop: tap → coins → buy Engagement Boost → more coins/tap → buy Loyal Followers →
more followers/tap → cross follower metric → unlock GO LIVE; Auto-Engage earns while idle.

### 10.5 Updated player journey (§6 revision)

1. Onboarding: pick handle. →
2. **Fresh Home:** TEB pulses — first-press teaching fires. Tap → earn coins → buy Engagement
   Boost in ~2 taps → visible earnings increase.
3. Earn followers → cross metric → **Upgrades surface appears** at ~100 views,
   **GO LIVE unlocks** at 100 followers.
4. **First run:** big follower payout → Creator Insights fills up.
5. Loop: spend run rewards on repeatable + one-time upgrades → stronger runs → bigger
   payouts → unlock Discover, Feed, element pods. →
6. (Later) Community raids, global trends, prestige.

## 11. Creator Studio, clicker revamp & whole-game polish (Phase 10; design LOCKED 2026-06-14)

**Origin: post-Phase-9 playtest.** Three problems surfaced: (1) The FYP is cluttered — locked
"???" element pods overlap the stage. (2) Gameplay is too TEB-centric and shallow. (3) Visual
polish is uneven; reference bar: **Pegfinity** (bold, legible cascade of pop-numbers during
action, cohesive arcade aesthetic, dedicated upgrade page, celebration popups on unlocks).

### 11.1 Creator Studio — the 3-pillar upgrade hub

**Creator Studio** is a full-screen hub housing ALL upgrades, off the FYP. It is a progression
unlock itself (appears at ~10 followers) and is organized around three **creator pillars** — the
three things a creator does — each unlocking in turn:

| Pillar | Threshold | What unlocks | Studio section |
|---|---|---|---|
| **VIEWER** | ~10 followers | Studio button appears on Home + FYP elements + feed scroll + rail | Viewer tab: clicker/element upgrades + element unlocks |
| **POSTING** | ~100 followers | Publish videos + Posting tab | Posting tab: publish/royalty/mod upgrades |
| **LIVE** | ~500 followers | GO LIVE + Live tab | Live tab: run-stat gear, reactions, run skills |

Every `UpgradeDef` carries a `pillar: "viewer" | "posting" | "live"` field so the Studio can
route it to the right section and the affordability-badge system (Phase 10.2) knows where to show
the indicator. A skill→pillar map assigns skills to sections:
- **viewer pillar**: Charisma, Editing (content creation skills)
- **live pillar**: Stagecraft, Monetization, Network (run-performance skills)
- **posting pillar**: (reserved for Phase 10.2+)

The Studio is the game's **onboarding / tutorial** — everything appears naturally as thresholds
are crossed; the player is never shown a list of locked features they can't act on yet.

### 11.2 FYP de-clutter (Phase 10.1)

Remove the locked "???" element pods from the FYP entirely. Element unlocking happens in
Creator Studio → Viewer section. The FYP renders ONLY active waves; with no locked pods there
is no overlap clutter.

### 11.3 Elements: fix first, then expand (Phase 10.3–10.4)

Primary goal: make Beat Sync + Duet Loop actually interactive (fix the stacking / pointer-events
bug so pod taps register). Un-gate to the viewer unlock (~10f, not 1k). Raise spawn frequency.
Then add two new rhythm elements:
- **HOLD DROP** — press-and-hold to fill a charge ring; release inside the target window.
- **SWIPE HITS** — directional flicks in time (DDR-flavored).

### 11.4 Whole-game polish pass (Phase 10.5)

Pop-numbers v2 (bigger, bolder, color-coded, cascade with arc + scatter), celebration popups on
unlocks (radial burst), cohesive CRT/arcade meters across all screens. Quality reference:
Pegfinity's f17 frame — a screenful of bold gold/green/cyan numbers during a big moment.
