# 16 — The TEB Engagement Loop (current)

> **Read this before touching the opening chapter.** It supersedes every earlier
> description of TEB scoring: `14` §B (TEB editor zones) and §C (pulse-graded taps),
> `04` §17.2 (pulse formulas), and `06` §13's dial/editor UI. Those systems are **deleted
> from the codebase**, not deprecated — do not reimplement them.

## §0 — What was removed and why (do not relitigate)

The opening previously graded each tap against an orbiting pulse crossing a 48° green arc,
plus purchasable zones the player dragged onto the dial. It was removed 2026-07-24 after
playtesting. Recorded reasons, so this decision is not accidentally reversed:

1. **It demanded concentration disproportionate to its payoff.** The player had to watch a
   moving indicator to earn a baseline reward — precision work before any fun.
2. **It gated the loop behind a chore.** The interesting parts (upgrades, growth) sat behind
   a timing minigame the player had to clear first.
3. **It was one mechanic pretending to be depth.** Adding zones added *more of the same
   check*, not new decisions.

**Locked decision: the core clicker loop contains no precision-timing requirement.**
Skill expression lives in the rhythm/video layer (`17`), never in the base tap.

## §1 — Shape of the loop

Every tap always succeeds. Variety comes from layers that resolve on different timescales,
so something is always about to happen:

| Layer | Timescale | Player action | Source |
|---|---|---|---|
| Base tap | instant | tap TEB | always |
| Combo heat | ~2–4s | keep tapping | always |
| Shout-Out | random, ~8%/tap | none (luck) | `meet_teb` goal |
| Engagement feed | ~2.4s spawns | tap drifting bubbles | staged, §3 |
| Momentum bonus | ~25 fills | none (auto-fires) | `buy_audience_reach` |
| VIRAL | ~22s set window | catch V·I·R·A·L in the feed | `reach_700`, §2b |
| Raid Squad | passive/sec | none (idle) | Studio purchase |
| TAP THREE | 18s cooldown | hold TEB, play chart | `unlock_rhythm` |

**Design rule:** every layer is *optional* except the base tap. Ignoring bubbles or never
holding for TAP THREE slows progress; it never blocks it and never punishes.

## §2 — Combo, VIRAL, Shout-Out

- **Combo** is a float that increments per tap to `combo.cap` (20) and **decays** at
  `decayPerSec` (7/s) after `decayDelayMs` (1500ms) of no tapping. Multiplier is
  `1 + floor(combo) × perTap` (0.05), so cap = ×2.0.
  *A frozen bar was the bug that made the loop read as "one note" — the bar must always
  reflect what the player is doing right now.*
- **Shout-Out** is the crit analog — a per-tap `shoutOut.chance` (0.08) for `shoutOut.mult`
  (×4). Deliberately *not* called a crit: fiction is a larger creator amplifying you.
- **VIRAL** is no longer a combo side effect — it is earned from the letter set (§2b).
  The combo bar's only job is the multiplier, and it decays under every condition.

## §2b — VIRAL: the V·I·R·A·L letter set

**Changed 2026-07-24.** VIRAL used to fire automatically when the combo bar hit cap, which
made the loop's biggest moment something the player *received* rather than *did*. It is now
the one earned payoff in the opening chapter:

- Letter bubbles (`viral_letter`) spawn in the engagement feed once `reach_700` completes.
  Each carries one of **V · I · R · A · L**; tapping it collects that letter.
- The spawner only ever offers **letters the player still needs**, so a run at the word
  always converges. The challenge is catching the targets, never waiting for the right one.
- The **first** letter starts `viralLetters.setWindowMs` (22000). Miss the deadline and
  collected progress is wiped. Without that window enough patience always spells the word,
  and the mechanic degenerates into a formality.
- Completing the set fires the VIRAL window: `viral.durationMs` (7000) of `viral.mult` (×2)
  on everything and `spawnRateMult` (×3) on bubble spawns. Letters still in flight are
  cleared so the next set starts clean.
- Leaving Home, opening a sheet, or starting a rhythm session drops a half-collected set
  along with the feed — a countdown must never run behind an overlay the player can't tap.

Letters are the **only** part of the opening that asks for reaction, and they remain fully
optional: ignoring them costs the ×2 window and nothing else. This does not contradict §0 —
there is no timing *grade*. A letter is either caught or it isn't; no tap is ever judged.

## §3 — The engagement feed

Comments, gifts, haters and VIRAL letters drift bottom→top in two side channels that never
overlap TEB. Tapping one pays out.

The **ambient kinds are forgiving by design**: 54px targets, `bubbles.lifetimeMs` (5200ms)
of dwell, no timing check. They add a second thing to *do* without a second thing to
*concentrate on* — the distinction the retired pulse system failed.

| Kind | Unlocks at | Effect |
|---|---|---|
| `comment` | start | Followers ×5 base, +4 Momentum (once the meter exists) |
| `gift` | `unlock_studio` | **Gold** — first repeatable Gold source |
| `hater` | `buy_audience_reach` | Popping pays ×4 base; **ignoring costs 2% of Followers** |
| `viral_letter` | `reach_700` | Followers ×2 base; collect all five → VIRAL (§2b) |

**`like` was removed 2026-07-24.** The heart bubble was retired when VIRAL moved onto the
letter set; the like mechanic is parked until the real FYP feed needs it. Do not
reintroduce it as ambient decoration.

Letters are the one kind that breaks the forgiveness rule, deliberately: they run at
`viralLetters.minLifetimeMult`–`maxLifetimeMult` (0.5–0.95) of the base lifetime and roll
one of five motion profiles — `float`, `sway`, `zigzag`, `dart`, `bob`. The variety is the
challenge; five identical taps would not be one.

Haters are the only downside in the loop and are fully avoidable. The feed pauses and
clears whenever a sheet is open, a rhythm session is active, or the player leaves Home —
never let an unreachable hater drain followers behind an overlay.

## §4 — Momentum and its bonus roll

Momentum fills per tap by `engagementPerTap(level)`. **At cap it auto-fires and resets on
the spot** — it is a repeating heartbeat, never a gate the player must notice and spend.

At fill, one bonus is rolled from the player's unlocked pool (weights in
`momentumBonuses.ts`). Owning more **widens** the pool; nothing is ever replaced:

| Bonus | Cost | Effect |
|---|---|---|
| `follower_surge` | free | Followers ×8 of the triggering tap |
| `gold_rush` | 20 | 4–9 Gold |
| `comment_storm` | 35 | spawns 5 bubbles instantly |
| `duet_boost` | 50 | next 15 taps pay ×3 |
| `algorithm_push` | 70 | 8s of guaranteed Shout-Outs + ×3 bubble spawns |

Bought one-off in Creator Studio's `MOMENTUM BONUSES` section, revealed once
`engagement_rate` ≥ 1. Persisted as `unlockedMomentumBonuses` (SAVE_VERSION 20).

## §5 — Integrity ceilings (see `15` for the full architecture)

These are **balance constants that double as anti-automation controls**. They are set above
sustained human performance so honest players never feel them.

- **Token bucket on base payout** — `tapPayout.refillPerSec` (8), `capacity` (24). Sustained
  payout is capped; the capacity absorbs genuine human bursts. Unpaid taps still register
  (combo, animation) and simply pay nothing.
- **Momentum fill wall-clock cap** — `engagement.maxFillPerSec` (8). Because the bonus is
  the dominant earner, this means input volume cannot farm it at all.
- **Interval floor** — `minTapIntervalMs` (55). A crude backstop against absurd rates only;
  deliberately permissive so two-finger bursts feel responsive.

**Measured** (10-minute session, live store): a 30 taps/sec macro earns **−11.5%** versus a
human at 8 taps/sec, because its unpaid taps still burn combo and Momentum cycles. Human
bursts at 12 and 15 taps/sec are paid in full.

**Do not tighten these to "catch cheaters".** Their job is to make automation pointless;
detection and enforcement belong server-side (`15` §2).

## §6 — TAP THREE readiness

Decoupled from Momentum entirely. Readiness is unlock + `BALANCE.teb.cooldownSec` (18s).
A `HOLD FOR TAP THREE` pill appears when ready. Momentum's job is the tap heartbeat; TAP
THREE's is a periodic skill opportunity. Conflating them made both illegible.

## §7 — Open tuning questions

Unresolved as of 2026-07-24 — needs playtest data, not more theory:

- Bubble spawn rate (`baseSpawnMs` 2400) — too sparse or too busy?
- Hater frequency (weight 10) and drain (2%) — good tension or annoying?
- Momentum cap 25 — fires roughly every 25 taps; right cadence?
- Bonus weights — does `follower_surge` still dominate in felt play?
- **Letter set window (22s) and spawn weight (34)** — how often does a real player actually
  complete V·I·R·A·L? Target feel is "most sets land, a missed one stings"; if the word is
  never finished the window is too tight, and if it's never missed the window is theatre.
- **`dart` letters** — the fastest profile at 0.5× lifetime. Fair, or a cheap miss?
