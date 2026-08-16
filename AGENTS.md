# AGENTS.md

Coffee taste-note wheel. React + Vite, static, no backend. Read this first. Read only what table
below says you need — repo small, but blind grep still wastes tokens.

## Stack

Three plugins/skills always on. Do not re-derive their rules, read source if unsure.

| Tool | Governs | Rule |
| --- | --- | --- |
| **ponytail** (`full`) | what gets built | Laziest thing that works. Stdlib/native before deps. Delete before add. Root cause, not symptom. Never lazy about *reading* first. |
| **caveman** | how prose reads | Docs + planning docs terse. No articles, no filler, no hedging. Fragments fine. Technical terms exact. |
| **`/note-take`** | doc freshness | Run before + after every phase. Owns `architecture.md` + `status.md`. Never runs git. |

Caveman applies to docs only. Code, code comments, commit messages, PR bodies stay normal prose.

## Where to look

| Need | File | Notes |
| --- | --- | --- |
| What exists now, why shaped that way | `architecture.md` | File map, **Vocabulary** (UI names), Blocks, data flow, conventions. Start here. |
| What is done / open | `status.md` | One line per phase + Open list. Lean by design. |
| What was intended, per phase | `prompts/phase_N.md`, `prompts/phase_N_plan.md` | Historical. Frozen — read, never edit, never restyle. |
| Vocabulary (hub, pill, drill, tone, fan…) | `architecture.md` → Vocabulary | Every UI name defined once. Check before inventing a term. |
| All pure logic + storage | `src/lib.js` | Geometry, colors, wheel layout, pill orbit, fingerprint math, brew store. No React. |
| SVG + pointer handling | `src/wheel.jsx` | `<Wheel>`, `<Fingerprint>`. Perf-sensitive — read architecture.md Blocks before touching. |
| Screen, state, brew management | `src/App.jsx` | |
| Flavor data | `public/flavors.yaml` | User-editable. Family → `{color, notes[], noteColors?, groups?}`. |
| Doc discipline, run before + after each phase | `prompts/note-take.md` | Canonical `/note-take` skill. Owns `architecture.md` + `status.md`. Copy to `.claude/skills/note-take/SKILL.md` to make the command work — `.claude/` is gitignored. |
| Tests | `test.js` | `npm test`. Pure functions in `src/lib.js` only. `.jsx` has no coverage. |

`dist/` and `node_modules/` gitignored. Never read them.

## Dev cycle

```
/note-take                 # before: read docs, check drift, open phase line
<build>                    # ponytail rules
npm test && npm run build  # must pass
/note-take                 # after: architecture.md = reality, status.md = phase state
<user commits>             # git manual, agent never commits/tags/pushes
```

## Gotchas

- `.jsx` untested. Anything touching `src/wheel.jsx` or `src/App.jsx` needs the user on a real phone.
- Perf lives in the render tree, not the maths. CSS `filter` on an ancestor welds its whole subtree
  into one raster unit — see `architecture.md` Blocks.
- `git status` to read is fine. Changing git state is not.
