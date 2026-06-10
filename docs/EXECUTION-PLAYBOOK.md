# Execution Playbook (for the human operator)

How to drive the cheap models through the spec set efficiently. This file is for **you**, not the
implementer models (they follow `CLAUDE.md` + `docs/05-roadmap.md`).

## The core loop

> **Plan with the expensive model. Implement with the cheap model. One task per session.**

1. Open a **new session** in the ClickTok project folder.
2. Set the model to **Sonnet** (default for implementation). Use **Haiku** only for the trivial
   tasks flagged below.
3. Paste the **task prompt** (template below), naming the exact task number.
4. Let it work. It reads `CLAUDE.md` + only the docs the task references, implements, runs
   `pnpm typecheck`, and verifies in the browser preview.
5. When it's done: skim its summary/screenshot, then tell it **"commit this"** (one commit per
   task = clean rollback points).
6. Close the session. Start a fresh one for the next task.

That's it. Repeat down `docs/05-roadmap.md`.

## Why one task per fresh session

Long sessions accumulate transcript = more tokens per message. Each task in the roadmap is
self-contained and tells the model exactly what to read, so a fresh, small session is cheapest and
most reliable. **Exception:** closely related UI tasks (e.g., 0.6 → 0.7 → 0.8) can share one session
if it's still responsive — but start fresh at every phase boundary.

## Model settings

| Setting | Recommendation |
|---|---|
| **Model** | **Sonnet 4.6** for everything in Phases 0–2 (real refactoring/logic). **Haiku 4.5** only for the mechanical data-entry tasks: **1.1, 1.2** (typing the upgrade/skill catalogs) and **3.x copy/polish**. |
| **Fast mode / Opus** | **Off** for implementation — Opus burns your allowance fastest. Reserve Opus for *planning new features* and *rescuing a stuck task*. |
| **Permission mode** | Default is fine. To get interrupted less while streaming, turn on **auto-accept edits** and allowlist safe commands — run `/fewer-permission-prompts` once to add `pnpm typecheck`, `pnpm dev`, etc. Don't use full bypass. |
| **Plan mode** | Not needed — the plan is in the docs. Optionally use it on the two hardest tasks (0.3, 2.2) so the model shows its approach first. |

## The task prompt (copy-paste, edit the task number)

```
Read CLAUDE.md, then implement Task 0.1 from docs/05-roadmap.md.
Read only the docs that task references. Follow docs/03-data-model.md for types and
docs/04-economy-formulas.md for numbers EXACTLY — do not invent design or balance.
When done: run `pnpm typecheck`, verify visible behavior in the browser preview if it
renders anything, check the task's box in docs/05-roadmap.md, and give me a one-line
summary. If the spec is ambiguous or something's missing, STOP and ask me instead of guessing.
```

Generic version (let it auto-pick): replace the first line with *"…implement the next unchecked
task in docs/05-roadmap.md."* Naming the exact number is safer with smaller models.

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
