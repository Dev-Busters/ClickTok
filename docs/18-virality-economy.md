# 18 — The Virality Economy

> Added 2026-07-25. Companion to `16` §2b (the V·I·R·A·L letter mechanic itself).
> This doc owns the **currency**, the **shop**, and the **unlock**.

## §0 — Why a new currency exists

The letter mechanic needed a reward that could fund upgrades to itself. Every existing
resource was ruled out on **design** grounds, not convenience (locked by the user
2026-07-25):

| Resource | Why it can't pay for this |
|---|---|
| **Coins** | ClickTok's **premium** currency, mirroring real TikTok Coins. A core-loop mechanic must never mint premium currency. |
| **Likes** | Reserved for **player↔player** interaction — liking a video on the FYP *transfers* that Like to its creator. A solo mechanic must not create them out of nothing. |
| **Comments** | Same as Likes: an interaction between two real players, not a solo drop. |
| **Diamonds** | Premium/rare, sourced from LIVE gifts. Same objection as Coins. |
| **Followers** | The headline progress stat, not a spendable. |

Nothing was left, so **Virality** was added. Keep this table in mind before proposing that
any future mechanic pay out in Coins or Likes — it almost certainly must not.

## §1 — The shape

This is the template the game is meant to grow by: **a mechanic, its own currency, and its
own shop that deepens it.** The tap loop has Coins → Creator Studio. The viral loop has
Virality → The Viral Lab. Future systems should follow the same three-part shape rather
than piling more upgrades onto one shared currency, because two shops on two currencies
keeps two loops legible.

## §2 — Earning Virality

Minted in exactly one place: `popOpeningBubble` in `onboardingSlice`, when the popped
bubble is the letter the V·I·R·A·L chain is waiting for.

- `virality.perLetter` (1) per letter caught — a chain that goes cold still paid something.
- `virality.perWord` (6) **on top of** the final letter, so completing the word pays 7 and a
  full word is worth **11**.
- Both scale with `virality_yield` (CLOUT CHASER).

There is no passive trickle and no other source. If Virality ever appears from somewhere
else, that's a bug.

## §3 — The Viral Lab upgrades

Repeatable levels, cost `baseCost × costGrowth^level`, all spending Virality. Every one
deepens the VIRAL system specifically — nothing here touches the base tap, which is
Creator Studio's job.

| Upgrade | Effect | Base cost | Growth | Per level |
|---|---|---|---|---|
| `letter_rate` — SIGNAL BOOST | letter spawn weight (base 34) | 8 | 1.55 | +10 |
| `viral_duration` — AFTERGLOW | VIRAL window length (base 7s) | 10 | 1.6 | +1.2s |
| `letter_dwell` — STICKY FEED | letter lifetime multiplier | 14 | 1.6 | +0.08 |
| `viral_mult` — PEAK REACH | VIRAL multiplier (base ×2) | 22 | 1.75 | +0.25 |
| `virality_yield` — CLOUT CHASER | Virality per letter and per word | 26 | 1.7 | +0.35 |

**FIRST-PASS NUMBERS.** The first purchase (8) lands just under one completed word (11),
so the Lab pays off on the player's first chain. Everything past that is untested — see §5.

Cards are drip-fed by `revealAtTotalLevels` (0 / 1 / 2 / 4 / 6) so opening the Lab shows
two cards, not five. An owned upgrade never hides again.

**All effects read through `features/virality/catalog.ts`.** Callers never reimplement a
curve, and level 0 always returns the un-upgraded baseline — which is why `openingViralMult`
takes a `multLevel` parameter defaulting to 0.

## §4 — The shop is a sheet, not a nav tab

The Viral Lab is a full-screen sheet (`openSheet: "viralLab"`) reached from a `🔥 LAB`
button on Home, stacked under `STUDIO`.

**It is deliberately not a sixth bottom-nav tab.** Locked design decision #4 fixes the nav
at TikTok's five (Home / Discover / ＋ / Inbox / Profile), and breaking that would cost more
in TikTok fidelity than a nav tab is worth. Creator Studio already establishes shop-as-sheet.

Header lives outside the scroll region (flex), **not** `position: sticky` inside it —
sticky inside a transformed Framer Motion element is a known iOS Safari failure mode.

## §5 — Unlock and progression

Virality, the letter mechanic, and the Lab are **one unlock**, at the `reach_700` goal:

- `reach_700` reveals `virality` and teaches on the first letter caught (`16` §2b).
- `areViralLettersAvailable(completed)` gates the letters, the `🔥 LAB` button, and the
  Virality readout in the Home header. One predicate, three surfaces.
- The Lab itself has no teach gate — it's a shop, not a ladder rung. `viral_lab_opened`
  (set via `markTeachSeen`, which does **not** advance the goal ladder) only stops the
  button pulsing after the first visit.

`SAVE_VERSION 21` adds `wallet.virality` and `viralityUpgradeLevels`. The migration
backfills `wallet.virality` unconditionally, because `wallet` is persisted as a whole
object and a pre-v21 save has no such key.

## §6 — Open tuning questions

Nothing here has been playtested — these are first-pass numbers chosen to be coherent, not
correct:

- **Is 11 per word the right rate?** At `16` §7's measured ~75s per word that's ~9
  Virality/min, so the 2nd–3rd upgrades take several minutes each. Too slow to feel like a
  shop?
- **Do the five upgrades pull in different directions?** SIGNAL BOOST and STICKY FEED both
  make letters easier to catch; if one strictly dominates, one of them is dead weight.
- **PEAK REACH vs AFTERGLOW** — is a bigger multiplier or a longer window more fun? If the
  answer is obviously one of them, the other needs rethinking.
- **Should Virality survive prestige** when prestige exists? Undecided.

## §7 — Room to expand (not built, do not invent)

The user's stated direction is that this shape should deepen over time. Candidates that
fit the three-part template without breaking §0's currency rules:

- Feed density as a purchasable axis (`16` §7) — arguably belongs in the Lab.
- Letter-chain variants: longer words, bonus letters, chains that pay combo.
- A Virality→Follower conversion, making the viral loop a genuine alternative income path.
- Player↔player: spending Virality to boost another creator's video, which is the natural
  bridge to the Likes/Comments economy §0 reserves.

**Do not implement any of these without a design pass with the user.** Cost curves and
scope are unspecified on purpose.
