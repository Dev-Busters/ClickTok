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

## 7. Multiplayer / community (Phase 4 — design ahead, build last)

Goal: individual players measurably affect all others, for richer live-dev content.
- **Global trends:** server-authoritative trending topics rotate on a timer; streaming the hot
  trend yields more. Players collectively "push" trends by streaming them (aggregate effect).
- **Live raids (player→player):** when you're live, you can be raided by another live player —
  their viewers spill into your run as a real buff, and vice versa. Direct cross-player effect.
- **Gifts/collabs between players;** **global challenges** (server-wide goals with shared rewards).
- **Leaderboards:** global and per-trend (the current PartyKit trend room is the seed of this).
- Backed by **Supabase** for accounts, durable saves, and persistent leaderboards.

Architecture must not paint us into a corner here: keep run scoring and trend state expressible
as messages a server could authoritatively own later. See `02` § Multiplayer-readiness.

## 8. Out of scope (for now — note so models don't build them)

- Real video/audio, real TikTok API integration, real accounts of real creators.
- Monetization/IAP, ads.
- Sound design (optional juice, Phase 3+).
- Anti-cheat / server authority (runs are client-trusted until Phase 4 hardening).
