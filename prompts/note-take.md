---
name: note-take
description: Sync architecture.md and status.md around a phase. Run BEFORE starting a phase implementation (ground in what exists, open the phase line) and AFTER finishing one (record what shipped). Also on "note-take", "/note-take", "update the docs", "write it down", or when asked the current state of the project. Never touches git.
---

# note-take

> Canonical copy. `.claude/` is gitignored, so this file is what survives a clone.
> To get the `/note-take` command back: copy this file to `.claude/skills/note-take/SKILL.md`.

Two files carry this project's memory between sessions. This skill keeps both honest.

| file | holds |
| --- | --- |
| `architecture.md` | **whole** architectural overview — what exists now, why shaped that way |
| `status.md` | lean phase tracker — one line per phase, plus open items |

`prompts/phase_N.md` and `prompts/phase_N_plan.md` are **inputs**. Read them, do not rewrite them
here. They record what was *intended* at the time. Frozen.

**Never runs git.** No commit, no tag, no push, no branch. User does all of that by hand. Reading
state (`git status`, `git log`) to find out what changed is fine. Changing it is not.

## Before a phase

1. Read `architecture.md` + `status.md` in full, plus the phase plan in `prompts/` if one exists.
2. Verify docs against the tree — files listed that no longer exist, files present no doc mentions,
   commands in "Local dev" that would fail today. Fix drift you can confirm. **Report** drift that
   depends on an unsettled decision rather than silently picking a side.
3. Add or update the phase's line in `status.md`, marked `(planned)`.
4. Do not describe the new phase in `architecture.md` yet. That file documents what *exists*.

## After a phase

1. Update `architecture.md` to match reality: new files in the file map, new blocks in **Blocks**,
   changed data flow, new conventions. Delete what is no longer true — stale line beats missing line
   never; missing beats stale.
2. Update the phase's line in `status.md` to `(done)` or `(partial — <what is left>)`.
3. Move anything unfinished into **Open**, one line each, concrete enough to act on months later.
4. Fold durable caveats — perf ceilings, known limits, "degrades at N" — into `architecture.md` where
   the relevant block is described. Properties of the design, not open tickets.

## status.md format

Lean. One line per phase, short comma list of what it delivered, parenthetical state. Nothing else.

```markdown
# Status

phase 1 = <thing>, <thing> and <thing> (done)
phase 2 = <thing>, <thing> and <thing> (done — <caveat>)
phase 3 = <thing>, <thing> and <thing> (partial — <what is left>)

## Open
- <one actionable line>
- <one actionable line>
```

States: `(planned)` · `(in progress)` · `(partial — …)` · `(done)` · `(done — …)` · `(dropped — why)`.

Phase line needing a second sentence belongs in `architecture.md` or `prompts/`, not here.

## Rules

- **Write caveman style**, per `AGENTS.md`: no articles, no filler, no hedging, fragments fine,
  technical terms exact, code blocks untouched. Substance never compressed away.
- **Write what is true, not what was planned.** Phase shipped three of five things → line says so.
  Tracker always reading "done" tracks nothing.
- **Never delete a phase line.** Dropped phase becomes `(dropped — why)`. History of what was decided
  against beats the tidiness of removing it.
- **Open is for actions**, not observations. "Measure `layoutPills` on a phone" = action.
  "`layoutPills` is O(n) per render" = architecture.
- Edit lines in place over rewriting whole files, so diffs stay readable.
- Report what changed in the two files at the end. One or two sentences, no diff dump.
