# Architecture

React + Vite mobile web app. No backend. Pure logic sits apart from components, stays Node-testable.

```
README.md             — human entry point: run locally, how the release pipeline flows
index.html            — Vite entry (#root + script tag + two Google fonts)
src/main.jsx          — mounts <App/>, imports styles.css
src/App.jsx           — screen: title, <Wheel/>, cupping sheet, brew management
src/wheel.jsx         — <Wheel> + <Fingerprint>: whole SVG + pointer handling
src/lib.js            — ALL pure logic + storage (no React): geometry, colors, wheel layout,
                        pill orbit, fingerprint math, brew store
src/styles.css        — whole stylesheet
public/flavors.yaml   — flavor tree, user-editable (Family -> {color, notes[], noteColors?, groups?})
pnpm-workspace.yaml   — pnpm settings. Not a monorepo: holds the install-script allowlist only
test.js               — pure-function checks against src/lib.js (`pnpm test`, plain Node)
.github/workflows/    — ci.yml, tag.yml, release.yml: whole release pipeline
```

## Screen
Primary screen = one terminal. Stack of full-width strips: topbar, wheel, notes window, run controls.
Run swaps wheel for brew card while preserving mounted wheel state. Brew archive replaces workspace
with scrollable newest-first cards. All chrome mono; frames drawn with fill + spacing, never border rules.

```
▐brews/▌ 2026-09-01/jairo-strawberry█ ▾     ← topbar: sys menu · path (name editable) · file tree
        ◯  (wheel)
~/brews/2026-09-01/jairo-strawberry         ← notes window titlebar
func coffee(washed, colombia, ombligon) {
  let brew = V60 1:16;
  let scores = {
    fragrance  ██████░░░░  6.0
    ...
  };
  // remarks as comments
}
```

Topbar: `brews/` block = sys menu (import, copy, export, rm current). `▾` = file tree, year >
month > day > coffees, indented, current path pre-unfolded, `+ new file...` pinned last. `+`
beside caret = same new-brew action, one tap. Name edits in place (contenteditable), block cursor
parked after it. All actions live in these two menus — no button strips. Esc closes either menu.
Picker buttons carry 10px side padding — two ~18px targets 1ch apart in thumb corner was
fat-finger bait, and missed caret lands on `+`, which creates state.

Wide screens (`min-aspect-ratio: 1/1` + `min-width: 700px`, media block LAST in styles.css —
overrides base `.wheel`/`.sheet` by cascade order, not specificity): `#root` becomes grid
(`auto minmax(340px,1fr)` / `auto 1fr`), topbar spans, wheel left `clamp(320px, min(50vw,
100dvh - 120px), 800px)` vertically centred, sheet right full-height (`align-self: stretch`).
320px floor = tier-1 band at 44px touch minimum. Portrait base: wheel capped `min(100%,
max(393px, 100dvh - 560px))` so whole stack fits one screen; 393px floor keeps phones full-width.

## Vocabulary
Names used across code, plans, commits. Most point at something on screen.

| Name | On screen | Code |
| --- | --- | --- |
| **wheel** | whole circular thing. Everything below sits inside it | `<Wheel>`, `src/wheel.jsx` |
| **family** | top-level flavour group: Citrus, Floral, Tea… | keys of `public/flavors.yaml` |
| **note** | specific flavour inside a family: bergamot, dark chocolate | `notes:` under a family |
| **tier 1** / **family ring** | ring of coloured family segments. Always visible | `tier1` |
| **tier 2** / **fan** | notes spreading outward when you press a family, along that family's own direction | `tier2`, `noteFan` |
| **drill** | going family → note: press family, drag out to note, release to log | `onDown`/`onMove`/`onUp` |
| **dwell guard** | 80 ms you must linger on a note before release counts. Stops fast drag *through* a note logging it | `noteAt` in `onUp` |
| **sticky** | other way to log: tap family (fan stays open), then tap note. No drag | `sticky` ref |
| **pill** | logged note, drawn as small capsule with its name in it | `layoutPills` |
| **orbit** / **rim** | circle of pills round the hub. Drag pill to move, tap to delete | `orbit` |
| **ring 0 / ring 1** | pill rim is one circle until room runs out; second wider circle appears outside it. That second one = ring 1, its arrival = **overflow** | `layoutWheel` |
| **hub** / **fingerprint** | disc at centre. Not decoration — cup rendered as one blended colour | `<Fingerprint>`, `fingerprintTones` |
| **tone** | one logged note's colour contribution to hub. Log note twice, its tone weighs more | `tones` |
| **share** | how much of hub one tone takes. **Handles** — small draggable circles on hub edge — set it. Pull one inward, that note takes over blend, others shrink | `mixWeightFor` |
| **cup** / **brew** | one tasting session: name, origin, method, notes, scores. One saved document | `newBrewDoc` |
| **notes window** / **sheet** | terminal window under wheel holding the cup as source: `func coffee(...)` signature, `let brew`, `let scores`, `//` remarks | `.sheet` |
| **topbar** / **pane** | sticky strip: sys-menu block, editable file path, file-tree caret | `.pane` |
| **sys menu** | drops from `brews/`: import, copy, export, `rm` current brew | `menu === 'sys'` |
| **file tree** | drops from `\u25be`: year/month/day dirs, fold state throwaway | `brewRows`, `open` |
| **coffee line** | `coffee(process, origin, varietal)` — three inputs reading as one signature, each highlighted in one of the cup's own note colours | `TRIO`, `.sig` |
| **score bar** | ten mono cells per SCA dimension, `\u2588` filled and `\u2591` empty, with the real range input invisible on top | `.score` |
| **intensity** | one of four score bars, only one with a side effect: drives whole wheel's saturation | `sat` |

Code-only words: **bearing** = direction from centre (0° up, clockwise). **span** = width in degrees.
**flip** = label sits on bottom half, drawn reversed to stay right-way-up. **squeeze** (`fscale`) =
how far pill labels shrank to fit.

## Blocks
- **src/lib.js — geometry (pure)**: `polar`, `sectorPath`, `capsulePath`, `arcPath`, `flipped`, `norm`, `angDist`. Authored in fixed 390-unit space centred on `ORIGIN`. `viewBoxFor` crops and zooms around that origin instead of rescaling, so every radius is absolute. 0° up, angles clockwise. Labels ride `arcPath` baselines as `<textPath>`, reversed on lower half so they never read upside down.
- `ink()` reads both hex fills and the `hsl()` strings `shades()` returns; before that every ramp colour fell through to white ink.
- **src/lib.js — colorMapper (swappable)**: `{category(name, def), note(catName, def, i, n)}`. Only place colours are computed — reassign its properties to swap schemes. Note uses its own authored `noteColors` entry when it has one, else a `shades()` ramp off family hue. `noteColorOf` = defensive lookup at render time. `ink()` picks dark or light text per fill.
- **src/lib.js — wheel layout**: `ringOrder` keeps families in YAML order and applies one rotation offset to the complete ring. `radialGroups` splits a family with `groups:` into concentric bands. `wheelGeom` returns radii for one state (`open` bites tier 1 inward + shrinks hub; `overflow` frees room for second pill rim; `tiered` widens note band). `hitWheel` resolves a pointer already reduced to (r, ang), hysteresis on both rings.
- **src/lib.js — pill orbit**: `layoutPills` places every logged note as a capsule on hub rim, recomputed from scratch each render. `layoutWheel` runs it twice — outer rim spawns only when inner genuinely cannot hold everything — and when both rims are full falls back to even fixed pitch, so a heavy cup crowds rather than loses notes. Past ~20 notes labels hit the 5.8 px floor: still legible, practical ceiling for one cup. `dragPillAngle` clamps a dragged pill at its neighbour's edge, jumps past only once cursor clears that neighbour's centre.
- **src/lib.js — fingerprint**: `fingerprintTones` turns logged notes into one tone each, placed on its own bearing just outside hub disc. Share pulls a tone inward on a log curve. `mixWeightFor` renormalises blend when a handle is dragged. Base coat = cup's true blend: `mixColors` (weighted average, linear-light sRGB — gamma-space averaging darkens) over all tone colours by share, so dragging a handle shifts whole disc. Each tone pre-mixed 18% toward that blend before render — overlapping gradients read as regions of one liquid, not contrasting stickers. `toRgb` parses both colour formats app produces (#hex, hsl()).
- **src/lib.js — brew store**: `uuid`, `validateBrews`, `newBrewDoc`, `fillBrew`, `mergeBrews`, `loadStore`/`saveStore` (localStorage keys `brews`, `currentBrewId`). Docs MongoDB-shaped `{_id, name, origin, process, varietal, brewMethod, createdAt, scores{}, remark, notes:[{category, note, ts}]}`, insertable as-is. Future backend swaps only `loadStore`/`saveStore` for fetch. `fillBrew` back-fills cupping fields and `createdAt`, so pre-v0.2 docs still load — the header date is that stored `createdAt`, so an old cup shows its own date, not today's.
- **src/wheel.jsx — `<Wheel>`**: owns transient interaction state (open family, hot note, hand-placed pill angles, hand-set mix), turns pointer events into `onAdd`/`onRemove`. Press-drag-release and tap-tap both commit, guarded by 80 ms dwell so fast drag-through does not log.
- **src/wheel.jsx — pill drag bypasses React on purpose**: sliding a pill along the rim is pure rotation about origin, so a move writes one `transform="rotate(...)"` attribute to the pill's wrapper `<g>` and returns. State commits once, on release (once more if pill crosses the 90°/270° line where its label must re-flip). Drill re-renders only when pointer crosses into a new sector, but a drag yields a continuous angle — routing that through state meant a full `layoutPills` + `fingerprintTones` pass per pointer event, and since a tone's bearing follows its pill, every such frame also dirtied hub blur + `feTurbulence` grain. That re-rasterisation, not the layout maths, made dragging feel heavier than selecting.
- Each pill renders as two nested `<g>`: outer = drag rotation (SVG attribute, written imperatively), inner = CSS transform for delete + ring-switch animations. Cannot share a node — CSS `transform` overrides the SVG `transform` attribute outright.
- `at()` caches SVG bounding rect for the length of a gesture. Measuring per move forced a layout flush between DOM writes.
- **Saturation applies per layer, never once around whole wheel.** A CSS `filter` forces its entire subtree into one offscreen buffer, so a single `saturate()` wrapper welded tier 1, tier 2, pills and hub into one raster unit: anything moving re-rasterised all of it, *through* hub blur + `feTurbulence` grain. Tier 1, tier 2, orbit, fingerprint now each carry their own `filter: sat`, rasterise independently.
- Hub tone circles are radial gradients already fading to `stopOpacity 0`, so `feGaussianBlur` over them bought very little — and its `<animateTransform repeatCount="indefinite">` drift meant that blur re-ran every frame, forever, over a filter region 16× disc area. Filter gone. Softness comes from the gradients.
- **src/wheel.jsx — `<Fingerprint>`**: the hub. One radial gradient per tone over a base coat, clipped to disc, grain wash + vignette on top. Drift uses SVG `<animateTransform>`, not CSS transform, which would escape the clip in some renderers. Tone circles oversized (2.4× share radius) so gradient's zero-edge lands outside clipped disc — only smooth interior falloff visible, never circle rim (zen-browser trick); ramp 5 eased stops, near-gaussian. Old white glint blobs removed — read as hard white spots once blur died.
- **src/App.jsx — `<App>`**: state = `flavors` (fetched yaml) + `store` ({brews, currentId}, persisted via effect) + `screen` (`wheel`, `card`, `archive`) + transient menus. `<Wheel>` keyed by brew id, so switching cups resets wheel transient state; card mode overlays it instead of unmounting it, preserving pill bearings and tone shares across edit/run. `SpectrumCard` reuses live fingerprint tones for current brew and computed tones for archived brews. Archive is separate `100dvh` app-shell screen: conditional header followed by independently scrolling newest-first card main, with body scroll lock and explicit 68px bottom clearance for Safari's floating toolbar.
- **Identity is `_id`, never the name.** Rename = edit the path in place; selection, merge and delete all key by `_id`, so two brews may share a name. `rm` guards with native `confirm`, falls to first remaining brew, recreates `Untitled brew` when the store empties.
- **Topbar name is contenteditable, not `<input>`**: inputs are single-line by spec, so a long name could only scroll or push the row — contenteditable wraps and the whole bar grows taller. Uncontrolled on purpose (keyed by brew id, ref seeds text): feeding keystrokes back through React resets the caret to the start.
- **Menus are custom, not `<select>`**: OS renders a select's popup, CSS cannot reach it. Both menus anchor `position: absolute; top: 100%` to the sticky (hence positioned) pane.
- **iOS width discipline**, learned the hard way: any element poking past the viewport makes Safari shrink the whole page to fit (`overflow-x: clip` on both `html` and `body` guards it); editable text under 16px makes Safari zoom on focus (everything editable is 16px); absolute overlays must never extend right past their row.
- **src/App.jsx + styles.css — the sheet is typeset, not boxed**: every field is a code-block line — a mono row, braced, with the value sized to its own content in `ch` (mono makes a character count a width; the `size` attribute pads by a couple of characters per field and that slack alone wrapped the row). Separators are real space characters, not flex `gap`: two inline-blocks with only margin between them give the line nowhere to break, so the row overflowed instead of wrapping. The signature carries a 2ch hanging indent; each argument and its trailing punctuation share a nowrap span, because browsers may break between two inline-blocks even with no space — that stranded `) {` alone on a row. Remarks' `//` gutter is a repeating SVG background, not text, so the stored remark stays plain prose. Remark textarea auto-grows (height = scrollHeight per keystroke, keyed by brew id, `resize: none`) — each new line picks up its `//` free from repeat-y.
- **Field highlights cycle the cup's own note colours**, `noteColorOf` per logged note, first to process, second to origin, third to varietal. The cycle never runs longer than the coffee line: brew and the score bars reuse those same three rather than putting a fourth colour on screen that nothing above them matches. No notes logged, no highlights. `ink()` picks the text colour over each fill.
- **Score bars draw in glyphs, the native range still drives them**: ten `█`/`░` cells per dimension, with `input[type=range]` absolutely positioned over them at `opacity: 0`. Touch behaviour, keyboard and screen reader stay native for the price of one rule; the drawing costs no pointer code. Bars round to whole cells while the input steps 0.25 — the printed number carries the precision.
- **.github/workflows — release pipeline**: `ci.yml` runs install/test/build on every push to main and every PR, deploys nothing. `tag.yml` fires on every push to main: if `version` is already tagged it exits quietly (the state of most pushes), else validates semver, runs the tests, then pushes an annotated `v<semver>` tag as `github-actions[bot]`. `release.yml` builds the tag, uploads `dist/` as a Pages artifact, deploys, and cuts a GitHub Release with auto-generated notes.
- **`release.yml` has two entry points because a tag pushed with the default `GITHUB_TOKEN` never triggers another workflow.** GitHub's guard against recursive runs. So it declares both `workflow_call` (tag.yml invokes it directly after tagging, passing `tag:`) and `push: tags` (a hand-pushed tag still deploys — the escape hatch). On the `workflow_call` path `github.ref` is main, not the tag, so build checks out `inputs.tag` explicitly and the release step reads `inputs.tag || github.ref_name`.
- **`tag.yml` asks "is this version tagged yet", never "did package.json change".** Earlier shape diffed `version` against `HEAD~1` behind `paths: ['package.json']`, and stranded the common case: red tests leave no tag, but the follow-up fix commit touches `src/` only, so the tagger never woke again and the version sat unreleased in silence. Tags already record what has shipped, so the diff was redundant state. Now a retry after red tests is free — same `version`, just push the fix. Checkout needs `fetch-tags: true`; without tags the check can never see one and the failure surfaces later as a confusing push error.
- Tests run *before* the tag is created: a tag is the permanent record of a release, so a red tree must never earn one.
- **Prerelease suffixes are the iteration currency.** `0.2.1-dev.1` → `-dev.2` → `0.2.1`. Gestures can only be judged on a real phone, and Pages is the only way onto one, so prerelease tags deploy to Pages like any other — single environment, and getting the build in hand is the point. Only the GitHub Release differs: a tag containing `-` is created `--prerelease`, so *Latest release* keeps pointing at the last stable version.
- `concurrency: { group: pages, cancel-in-progress: false }` on `release.yml` — two deploys must not interleave. `false` because a superseded deploy still has to finish cleanly rather than be killed mid-publish.

## Data flow
press family → tier 2 fans out → release on note → `onAdd` appends to current brew → note leaves
drill, becomes a pill → `saveStore` effect → re-render.

## Conventions
- `flavors.yaml` list order = family ring order and note fan order within each family. `ringOrder` applies its fixed rotation offset without reordering families.
- Editing `flavors.yaml` can orphan notes already logged in a brew. They still render, neutral fallback colour.
- Export writes `<brew name> DD-MM-HH-MM.json`, not fixed `brews.json`. Debugging convenience: folder of dumps says which cup and when, two exports never overwrite. Name stripped to `\w`, space, `-`; falls back to `brews` if nothing left. Import ignores filename, validates contents.
- Vite `base: './'` so built site works on GitHub Pages subpaths. `dist/index.html` must reference `./assets/...`; absolute `/assets/...` 404s on a project-page subpath and only there.
- **pnpm, pinned.** `packageManager: pnpm@11.3.0` in `package.json` is what `pnpm/action-setup` reads, so CI uses the laptop's pnpm instead of drifting to latest. CI installs with `--frozen-lockfile` — `pnpm-lock.yaml` is the only lockfile that counts.
- **Dependency install scripts are blocked unless named in `pnpm-workspace.yaml` `allowBuilds`.** pnpm 11 refuses to run any dependency `postinstall` by default and *errors* rather than warns, because an install script is arbitrary code executing with whatever credentials the shell has. `esbuild` needs its own: it is a compiled Go binary, and the script places the build matching the platform (`@esbuild/linux-x64` on the runner). Blocked means vite has nothing to transform JSX with.
- This bites again for any future dependency shipping a native binary, and only in CI — a laptop with a warm `node_modules` reports `Already up to date` and runs no scripts, so the failure appears exclusively on a fresh install. `pnpm approve-builds <pkg>` writes the entry.
- The setting lives in `pnpm-workspace.yaml` because pnpm 10+ made that its general settings file, monorepo or not. `package.json`'s `pnpm.onlyBuiltDependencies` and `.npmrc`'s `allow-builds[]` are both silently ignored by 11.3.0 — verified, and most advice online still names the old key.
- Releasing = bump `version` in `package.json`, push to main. Nothing else by hand. No `git tag`, no `dist/` commit.

## Local dev
```
conda env create -f environment.yml   # once (python + nodejs)
pnpm install --frozen-lockfile        # once. Same flag CI uses, so a stale lock fails here first
pnpm dev                              # http://localhost:5173, --host exposes LAN for phone testing
pnpm test                             # pure-function checks
pnpm build                            # dist/ for GitHub Pages
```
pnpm, not npm — `npm install` would regenerate `package-lock.json` and desync from what CI installs.
