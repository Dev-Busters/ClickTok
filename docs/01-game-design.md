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

### 8.1 The structure
- Home is a **full-bleed vertical pager of videos** — one video fills the screen; **swipe up** for
  the next, swipe down to go back, exactly like TikTok. Since we have no real video, a "video" is
  a procedurally animated visual (the `VideoCanvas`: deterministic from the video's id/topic —
  layered drifting gradients/shapes + a topic glyph), with the poster's `@handle`, caption, and
  topic tag overlaid like a TikTok post.
- **Videos are posted by other players.** The ＋ sheet's POST action publishes a `VideoCard` to a
  shared server pool; everyone's feed draws from it. NPC-generated videos pad the pool when real
  content is thin (same cold-start pattern as featured streams). Captions are **preset templates
  only — never free text** (same moderation rule as quick-chat).
- **The center of the video is the TAP CORE** — the clicker. A large, obviously-tappable pulsing
  target. Tapping it ("engaging") earns the existing per-tap gains (economy unchanged, `04` §1).
  Floating `+N` numbers, heart bursts, and a combo ring make every tap legible.

### 8.2 Why you tap, why you swipe (the new tension)
- **Combo:** consecutive taps on the same video build a combo that multiplies gains (caps at
  ×1.5 at 100 taps) and visually evolves the TAP CORE at milestones. Swiping resets it.
- **Boosts:** every video carries a visible **boost** that applies *while you tap with it on
  screen* — e.g. +50% coins, +50% followers, ×2 likes, lucky ×10 taps, or seeding your next run
  with bonus starting hype. Numbers in `04` §13.
- The tension: **stay** and build your combo, or **swipe** hunting a better boost. That's the
  whole TikTok dopamine loop, made mechanical.
- **Royalties:** when other players tap your video, you earn likes in real time (and your video's
  public tap counter climbs). Posting feeds others' boosts; their engagement feeds you back —
  the same "players are content for each other" principle as §7.

### 8.3 Posting (semantic change)
Tapping no longer "posts" (the 3.3-era tap-to-post is retired). **Tap = engage** (the
moment-to-moment clicker income); **POST (＋ sheet) = publish a video** — it grants a burst of
gains (a fistful of taps' worth at once) on a cooldown, and puts your card in everyone's feed.

### 8.4 No more blank centers (applies to every mode)
The `VideoCanvas` visual also becomes the **Live stage backdrop** (streamer and spectator),
seeded by the streamer's identity/topic, with intensity that scales with hype. Rule going
forward: **no screen ships with a dead center** — something animated and meaningful occupies it.

### 8.5 First-run legibility (from the same playtest)
A one-time 3-step coach-mark overlay on first Home visit (TAP THE CORE → SWIPE for new
boosts → GO LIVE for the real rewards), an idle "TAP" pulse hint, and an affordance rule:
**every interactive element shows a visible label** — if it's a button, it must look like one.

## 9. Out of scope (for now — note so models don't build them)

- Real video/audio, real TikTok API integration, real accounts of real creators.
- Monetization/IAP, ads.
- Sound design (optional juice, Phase 3+).
- Anti-cheat / server authority (runs are client-trusted until Phase 4 hardening).
