---
name: note-take
description: Sync prompts/architecture.md and prompts/status.md around a release. Run BEFORE starting work on a version (ground in what exists, open the version line) and AFTER shipping it (record what shipped). Also on "note-take", "/note-take", "update the docs", "write it down", or when asked the current state of the project. Never touches git.
---

# note-take

> Canonical copy. `.claude/` is gitignored, so this file is what survives a clone.
> To get the `/note-take` command back: copy this file to `.claude/skills/note-take/SKILL.md`.

Two files carry this project's memory between sessions. This skill keeps both honest.

| file | holds |
| --- | --- |
| `prompts/architecture.md` | **whole** architectural overview — what exists now, why shaped that way |
| `prompts/status.md` | lean release tracker — one line per version, plus open items |

`prompts/vN.md` and `prompts/vN_plan.md` are **inputs** (`prompts/phase_1_*.md` = v0.1, named before the scheme). Read them, do not rewrite them
here. They record what was *intended* at the time. Frozen.

**Never runs git.** No commit, no tag, no push, no branch. User does all of that by hand. Reading
state (`git status`, `git log`) to find out what changed is fine. Changing it is not.

## Before a release

1. Read `prompts/architecture.md` + `prompts/status.md` in full, plus version plan in `prompts/` if one exists.
2. Verify docs against tree — files listed that no longer exist, files present no doc mentions,
   commands in "Local dev" that would fail today. Fix drift you can confirm. **Report** drift that
   depends on unsettled decision rather than silently picking a side.
3. Add or update version line in `prompts/status.md`, marked `(planned)`.
4. Do not describe new version in `prompts/architecture.md` yet. That file documents what *exists*.

## After a release

1. Update `prompts/architecture.md` to match reality: new files in file map, new blocks in **Blocks**,
   changed data flow, new conventions. Delete what is no longer true — stale line beats missing line
   never; missing beats stale.
2. Update version line in `prompts/status.md` to `(done)` or `(partial — <what is left>)`.
3. Move anything unfinished into **Open**, one line each, concrete enough to act on months later.
4. Fold durable caveats — perf ceilings, known limits, "degrades at N" — into `prompts/architecture.md`
   where relevant block is described. Properties of design, not open tickets.

## status.md format

Version numbers, never "phase N". Minor bump = release with new behaviour, patch = fix on top.
Lean. One line per version, short comma list of what it delivered, parenthetical state. Nothing else.

```markdown
# Status

v0.1 = <thing>, <thing> and <thing> (done)
v0.2 = <thing>, <thing> and <thing> (done — <caveat>)
v0.3 = <thing>, <thing> and <thing> (partial — <what is left>)

## Open
- <one actionable line>
- <one actionable line>
```

States: `(planned)` · `(in progress)` · `(partial — …)` · `(done)` · `(done — …)` · `(dropped — why)`.

Version line needing second sentence belongs in `prompts/architecture.md` or release plan, not here.

## Rules

- **Write caveman style**, per `AGENTS.md`: no articles, no filler, no hedging, fragments fine,
  technical terms exact, code blocks untouched. Substance never compressed away.
- **Write what is true, not what was planned.** Release shipped three of five things → line says so.
  Tracker always reading "done" tracks nothing.
- **Never delete a version line.** Dropped version becomes `(dropped — why)`. History of what was decided
  against beats the tidiness of removing it.
- **Open is for actions**, not observations. "Measure `layoutPills` on a phone" = action.
  "`layoutPills` is O(n) per render" = architecture.
- Edit lines in place over rewriting whole files, so diffs stay readable.
- Report what changed in the two files at the end. One or two sentences, no diff dump.
