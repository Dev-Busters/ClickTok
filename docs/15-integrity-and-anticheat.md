# 15 — Integrity & Anti-Cheat

> **Why this exists.** ClickTok is heading for leaderboards and community competition
> ("biggest influencer on ClickTok"). The moment ranking matters, the client becomes an
> adversary. This document is the source of truth for how we defend competitive integrity
> without punishing honest players.

## §0 — The uncomfortable truth, stated plainly

**The client cannot be trusted, and no amount of client-side code changes that.**

ClickTok runs in a browser. Any player can open DevTools and:

```js
useGameStore.setState({ wallet: { followers: 1e12, totalFollowers: 1e12, coins: 1e9 } })
```

That is not an autoclicker problem. It is a **trust architecture** problem, and it is
strictly worse: it needs no tooling, no timing, and no patience. Obfuscation, minification,
integrity checks in JS, and "detect DevTools" tricks all raise the bar by minutes, not days.

**Therefore: any measure that lives only on the client is a speed bump, not a wall.**
The only durable defence is that the server does not believe the client.

### Current exposure (as of this document)

`cloudSlice.persistedStatePatch` / `meta.toPersistedState` push the entire wallet —
including `totalFollowers` — to Supabase, and the server stores what it is given. A
leaderboard built on that data today would be forged in one line. **This must be fixed
before any competitive surface ships.** See §2.

## §1 — Design-level resistance (the measure that costs honest players nothing)

The best anti-cheat is a game where cheating buys little. Before any detection, ask:
*what does automation actually gain here?*

**Rule: the dominant earner must be gated by wall-clock time or by judgement, never by
raw input volume.**

Implemented:

- **Momentum fill is rate-limited in wall-clock time** (`BALANCE.onboarding.engagement.maxFillPerSec`,
  currently 8/sec). Momentum drives the bonus roll, which is the largest income source in
  the opening. A macro at 30 taps/sec fills the bar at exactly the same speed as a human
  at 8 taps/sec. Verified: 60s at 30/sec and 60s at 8/sec both yield 480 fill; a relaxed
  human at 6/sec still gets 75% of the ceiling, so nobody honest feels a wall.
- **Tap interval floor** (`minTapIntervalMs`, 90ms) silently drops superhuman input in
  both the opening tap and the main-game `engageTap`.
- **Combo caps** at a fixed multiplier, so streak length cannot be farmed indefinitely.

Planned (not yet built):

- **Rank on judgement, not volume.** Rhythm charts require correct *positions*, *timings*
  and *slide paths*. A naive autoclicker cannot pass one at all. Making the competitive
  ladder run on chart performance — while the clicker stays the casual/idle layer —
  converts the hardest problem (detecting automated clicking) into a much easier one
  (verifying a replay, §3).
- **Per-session earnings taper** on the idle layer, so a 12-hour bot session is worth
  little more than an honest hour.

## §2 — Server authority (the actual wall)

The server must treat every client message as a *claim*, never as fact.

### 2.1 Plausibility validation

The server stores `{ lastValidatedState, lastValidatedAt }` per account. On sync it
recomputes the **maximum plausible gain** for the elapsed wall-clock time given the
player's *server-known* upgrade levels:

```
maxFollowers = elapsedSec × (maxTapRate × followersPerTap
                             + momentumFillCeiling × bonusExpectedValue
                             + raidPassivePerSec)
             × safetyFactor
```

Claims above that are clamped to the plausible maximum and flagged. This is the single
highest-value control, because it does not care *how* the client cheated — DevTools,
autoclicker, replayed packets, patched bundle, all produce the same impossible delta.

### 2.2 Server-owned economy for anything competitive

Leaderboard-relevant currency must be **derived server-side from validated events**, not
accepted from the client. The persisted save can stay client-authored for the single-player
experience (losing your own save to your own cheating harms nobody), but the *ranked*
number is a separate, server-computed column.

**Design consequence:** keep two figures — a local `totalFollowers` for the player's own
progression, and a server-validated `rankedInfluence` used for all social surfaces. They
are allowed to diverge; only the second one is defended.

### 2.3 Rate limiting and idempotency

Per-account request ceilings, monotonic sequence numbers on sync, and rejection of
retroactive timestamps. Prevents replaying a legitimate "I earned X" message N times.

## §3 — Replay verification (for the rhythm layer)

Rhythm charts are deterministic: given a chart id, a seed, and an input trace
(`{ t, x, y, type }[]`), the judgement pipeline produces exactly one score. So:

1. Client submits the score **with** its input trace.
2. Server re-runs the same pure judgement code and compares.
3. Mismatch ⇒ reject. Missing trace ⇒ reject.
4. The trace is additionally screened for human plausibility (§4) — a synthetic trace can
   be *arithmetically* valid while being obviously non-human.

This is how rhythm games have handled score integrity for two decades, and it is the
strongest tool available to ClickTok because the minigames are already deterministic and
already pure. It requires keeping judgement logic isomorphic between client and server —
worth the constraint.

## §4 — Input-shape signals (evidence, never a verdict)

`features/integrity/signals.ts` collects a rolling buffer of taps and derives:

| Signal | Human | Automation |
|---|---|---|
| Inter-tap interval CV | ~0.9 (measured) | ~0.000 (measured) |
| Position jitter from centroid | ~13px (measured) | 0.00px (measured) |
| Longest run without a >1s rest | bounded | unbounded |

Measured separation on synthetic fixtures: suspicion **0.80** for a fixed-interval,
fixed-pixel macro vs **0.00** for jittered human-like input.

**Hard rules for these signals:**

1. **They never gate rewards on the client.** Enforcement in client code is both
   bypassable and, when wrong, invisible and infuriating.
2. **They are never a sole ban criterion.** Accessibility hardware, switch access,
   styluses, macros used for legitimate reasons, and unusual-but-honest players exist.
   A low-jitter player is *evidence*, not a cheater.
3. **They inform a server-side score** combined with §2 plausibility, and at most trigger
   review or leaderboard shadow-exclusion — never a silent earnings nerf.

## §5 — What we explicitly will not do

- **Client-side bans or reward suppression on suspicion.** False positives are invisible
  to us and rage-inducing to the player.
- **Punishing fast tappers.** The rate ceilings are set above sustained human performance
  precisely so that being good is never penalised.
- **Security through obfuscation as a primary control.** Fine as a minor speed bump; never
  counted as defence.
- **Kernel/OS-level anti-cheat.** Wildly disproportionate for a browser incremental game.

## §6 — Honest limits

A determined attacker who writes a bot that *plays the rhythm game* with human-like jitter
and respects wall-clock ceilings will beat all of the above. That is true of every game
ever shipped. The goal is not perfection; it is:

- making casual cheating (DevTools, off-the-shelf autoclickers) **fail outright**, and
- making sophisticated cheating **cost more effort than simply playing**.

Layer §1 already achieves the second for the clicker: there is very little to gain.

## §7 — Build order

1. **Now (done):** design-level rate ceilings; input-signal collection; this document.
2. **Before any leaderboard:** §2.1 plausibility validation + §2.2 separate server-owned
   ranked figure. *Non-negotiable — a leaderboard without this is decorative.*
3. **With the rhythm ladder:** §3 replay verification; move judgement into shared code.
4. **Ongoing:** telemetry dashboards on §4 signals to find out whether cheating is even
   happening before investing further.
