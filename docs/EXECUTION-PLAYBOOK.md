# Execution Playbook (for the human operator)

How to drive the cheap models through the spec set efficiently. This file is for **you**, not the
implementer models (they follow `CLAUDE.md` + `docs/05-roadmap.md`).

## The core loop

> **Plan with the expensive model. Implement with the cheap model. Reset context at natural seams.**

1. Start with **fresh context** in the ClickTok project — `/clear` in your current session is the
   cheapest way (same clean slate as a new session, no ceremony). Only open a literally new session
   if you want to change model/settings or run two in parallel.
2. Set the model to **Sonnet** (default for implementation). Use **Haiku** only for the trivial
   tasks flagged below.
3. Paste the **batch prompt** (template below), naming the task(s) for this session.
4. Let it work. It reads `CLAUDE.md` + only the docs each task references, implements, runs
   `pnpm typecheck`, and verifies in the browser preview.
5. As it finishes each task: skim its summary/screenshot. It commits **per task** (the prompt tells
   it to), so you keep clean rollback points even within a batch. If something looks wrong, tell it
   to fix it (or `git reset --hard HEAD~1` to throw away the last task and retry fresh).
6. When the batch is done, `/clear` and start the next batch.

That's it. Work down `docs/05-roadmap.md` in the batches below.

## Session granularity — batch coupled tasks, reset at seams

This is a tradeoff, not a rule:
- **A long session costs more every turn** — each new message re-sends the whole accumulated
  transcript (file reads, screenshots, back-and-forth). Let one run too long and it gets expensive
  *and* the model gets muddy / triggers auto-compaction (which itself burns tokens).
- **A fresh start drops that dead weight** but re-pays the doc-reading startup tax, and loses
  helpful continuity between tasks that build on each other.

So: **group 2–3 tightly-coupled tasks per session, `/clear` between groups.** Reset earlier if the
model slows down or gets confused; keep going if it's flowing and the context is still lean. One
task per session is only worth it for the heaviest/most independent tasks.

### Concrete batches (the list)
Each line = one fresh-context session. Within a multi-task batch, the model commits after each task.

```
Phase 0:  0.1 ✓ | 0.2 ✓ | 0.3 ✓ | 0.4 ✓        (done)
          0.5                    ← idle income (standalone)
          0.6 → 0.7 → 0.8        ← the whole nav shell (tightly coupled)

Phase 1:  1.1 → 1.2              ← upgrade + skill catalogs (both Profile)
          1.3                    ← meta→run bridge fn (give it focus)
          1.4                    ← profile polish
          (1.5 skipped — deferred)

Phase 2:  2.1 → 2.2              ← run state + engine (meters move)
          2.3 → 2.4              ← event feed + reactions (interactivity)
          2.5 → 2.6              ← choice events + results/rewards
          2.7                    ← modifiers + post-run boon

Phase 3:  3.1 → 3.2              ← Discover + Inbox screens
          3.3                    ← juice pass
          3.4                    ← prestige
          3.5                    ← balance pass (play & tune)

Phase 4:  4.1 | 4.2 | 4.3 | 4.4  ← one each (client+server coordination, keep focused)
```

`/compact` is an alternative to `/clear` if you want to keep continuity but trim — but prefer
`/clear` at the seams above; it's cleaner and cheaper than repeated compaction.

## Model settings

| Setting | Recommendation |
|---|---|
| **Model** | **Sonnet 4.6** for everything in Phases 0–2 (real refactoring/logic). **Haiku 4.5** only for the mechanical data-entry tasks: **1.1, 1.2** (typing the upgrade/skill catalogs) and **3.x copy/polish**. |
| **Fast mode / Opus** | **Off** for implementation — Opus burns your allowance fastest. Reserve Opus for *planning new features* and *rescuing a stuck task*. |
| **Permission mode** | Default is fine. To get interrupted less while streaming, turn on **auto-accept edits** and allowlist safe commands — run `/fewer-permission-prompts` once to add `pnpm typecheck`, `pnpm dev`, etc. Don't use full bypass. |
| **Plan mode** | Not needed — the plan is in the docs. Optionally use it on the two hardest tasks (0.3, 2.2) so the model shows its approach first. |

## The batch prompt (copy-paste, edit the task numbers)

Single task — replace `0.5` with the task for this session:
```
Read CLAUDE.md, then implement Task 0.5 from docs/05-roadmap.md.
Read only the docs that task references. Follow docs/03-data-model.md for types and
docs/04-economy-formulas.md for numbers EXACTLY — do not invent design or balance.
When done: run `pnpm typecheck`, verify visible behavior in the browser preview if it
renders anything, check the task's box in docs/05-roadmap.md, commit with a message like
`feat(task 0.5): <short summary>`, and give me a one-line summary. If the spec is
ambiguous or something's missing, STOP and ask me instead of guessing.
```

Multi-task batch — list the tasks (e.g. `0.6, 0.7, 0.8`):
```
Read CLAUDE.md, then implement Tasks 0.6, 0.7, and 0.8 from docs/05-roadmap.md, in order.
For EACH task: read only the docs it references; follow docs/03-data-model.md (types) and
docs/04-economy-formulas.md (numbers) exactly; run `pnpm typecheck`; verify in the browser
preview; check its box in docs/05-roadmap.md; and commit it as `feat(task X.Y): <summary>`
BEFORE starting the next task. Give me a one-line summary per task. If anything is ambiguous
or missing, STOP and ask me instead of guessing.
```

Committing per task (not per batch) keeps your rollback granularity at one task even in a batched
session.

## Hard tasks — use Sonnet, and watch these

These touch many files or core logic. If a small model starts thrashing, stop it and either retry
fresh or bring the task to an **Opus** session:
- **0.3** slice split (multi-file refactor)
- **0.4** persistence + migration
- **2.2** run-loop engine
- **2.3** event spawner + feed

For everything else, Sonnet one-shots it from the spec.

## Scale / what to expect

- **Phase 0:** 8 tasks → a persistent, TikTok-shelled app with the current clicker inside it.
- **Phase 1:** ~4 tasks → full upgrades, skills, profile, the meta→run bridge preview.
- **Phase 2:** 7 tasks → the playable LIVE roguelike (the headline feature).
- **Phase 3:** 5 tasks → discover/trends, inbox, polish, prestige, balance.
- **Phase 4:** multiplayer (build last). ≈25 tasks to a complete single-player game.

Roughly one task per focused session/stream segment.

## Streaming with an audience (capturing their ideas without derailing)

- Don't let suggestions interrupt the current task. **Dump them into `docs/BACKLOG.md`** (just a
  bullet list) as they come in.
- Between tasks, triage the backlog. Small tweaks → add as a new numbered task in
  `docs/05-roadmap.md`. Bigger mechanics → bring to an **Opus planning session** (like the one that
  created these docs) to spec properly, then hand the new spec to cheap models.
- This keeps the plan-then-implement discipline intact even with live chaos.

## When to come back to the expensive model (Opus)

- Designing a **new mechanic/feature** (spec it, don't improvise it on a cheap model).
- A task is **genuinely stuck** or the spec has a **gap/contradiction**.
- A **balance/redesign** pass that needs judgment.
Everything else stays on Sonnet/Haiku.

## Your next action

Start a new Sonnet session and paste the task prompt with **Task 0.1**. Then 0.2, 0.3, … down the
roadmap. Commit after each.
