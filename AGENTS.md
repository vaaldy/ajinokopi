# AGENTS.md

Coffee taste-note wheel. React + Vite, static, no backend. Read this first. Read only what table
below says you need — repo small, but blind grep still wastes tokens.

## Stack

Three plugins/skills always on. Do not re-derive their rules, read source if unsure.

| Tool | Governs | Rule |
| --- | --- | --- |
| **ponytail** (`full`) | what gets built | Laziest thing that works. Stdlib/native before deps. Delete before add. Root cause, not symptom. Never lazy about *reading* first. |
| **caveman** | how prose reads | Docs + planning docs terse. No articles, no filler, no hedging. Fragments fine. Technical terms exact. |
| **`/note-take`** | doc freshness | Run before + after every release. Owns `architecture.md` + `status.md`. Never runs git. |

Caveman applies to docs only. Code, code comments, commit messages, PR bodies stay normal prose.

## Where to look

| Need | File | Notes |
| --- | --- | --- |
| What exists now, why shaped that way | `architecture.md` | File map, **Vocabulary** (UI names), Blocks, data flow, conventions. Start here. |
| What is done / open | `status.md` | One line per version + Open list. Lean by design. |
| What was intended, per release | `prompts/vN.md`, `prompts/vN_plan.md` | Historical. Frozen — read, never edit, never restyle. `prompts/phase_1_*.md` = v0.1, named before the scheme. |
| Vocabulary (hub, pill, drill, tone, fan…) | `architecture.md` → Vocabulary | Every UI name defined once. Check before inventing a term. |
| All pure logic + storage | `src/lib.js` | Geometry, colors, wheel layout, pill orbit, fingerprint math, brew store. No React. |
| SVG + pointer handling | `src/wheel.jsx` | `<Wheel>`, `<Fingerprint>`. Perf-sensitive — read architecture.md Blocks before touching. |
| Screen, state, brew management | `src/App.jsx` | |
| Flavor data | `public/flavors.yaml` | User-editable. Family → `{color, notes[], noteColors?, groups?}`. |
| Doc discipline, run before + after each release | `prompts/note-take.md` | Canonical `/note-take` skill. Owns `architecture.md` + `status.md`. Copy to `.claude/skills/note-take/SKILL.md` to make the command work — `.claude/` is gitignored. |
| Tests | `test.js` | `pnpm test`. Pure functions in `src/lib.js` only. `.jsx` has no coverage. |
| How to release / deploy, in human terms | `README.md` | Contributor-facing. Workflow table, walkthrough, gotchas. |
| Release pipeline | `.github/workflows/` | `ci.yml` (main + PRs), `tag.yml` (version bump cuts tag), `release.yml` (build, Pages, GitHub Release). Design notes in `architecture.md` Blocks. |

`dist/` and `node_modules/` gitignored. Never read them.

## Dev cycle

Releases named by semver, never "phase N" — phase N shipped as v0.N. `package.json` `version`
is source of truth; a bump on main cuts the release — `tag.yml` tags it, `release.yml` deploys it. Never `git tag` by hand.

```
/note-take                 # before: read docs, check drift, open version line
<build>                    # ponytail rules
pnpm test && pnpm build    # must pass
/note-take                 # after: architecture.md = reality, status.md = version state
<user commits>             # git manual, agent never commits/tags/pushes
```

## Gotchas

- `.jsx` untested. Anything touching `src/wheel.jsx` or `src/App.jsx` needs the user on a real phone.
- Perf lives in the render tree, not the maths. CSS `filter` on an ancestor welds its whole subtree
  into one raster unit — see `architecture.md` Blocks.
- `git status` to read is fine. Changing git state is not.
- pnpm only. `npm install` regenerates `package-lock.json` and desyncs from CI's `--frozen-lockfile`.
