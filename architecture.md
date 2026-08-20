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
test.js               — pure-function checks against src/lib.js (`pnpm test`, plain Node)
.github/workflows/    — ci.yml, tag.yml, release.yml: whole release pipeline
```

## Screen
One cup per screen, top to bottom: name (tap pencil to rename), wheel, cupping sheet — origin,
method, four SCA sliders, remarks. Footer: brew switcher + copy/export/import.

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
| **cupping sheet** | form under wheel: origin, method, four SCA sliders, remarks | `<App>` |
| **intensity** | one of four sliders, only one with a side effect: drives whole wheel's saturation | `sat` |

Code-only words: **bearing** = direction from centre (0° up, clockwise). **span** = width in degrees.
**flip** = label sits on bottom half, drawn reversed to stay right-way-up. **squeeze** (`fscale`) =
how far pill labels shrank to fit.

## Blocks
- **src/lib.js — geometry (pure)**: `polar`, `sectorPath`, `capsulePath`, `arcPath`, `flipped`, `norm`, `angDist`. Authored in fixed 390-unit space centred on `ORIGIN`. `viewBoxFor` crops and zooms around that origin instead of rescaling, so every radius is absolute. 0° up, angles clockwise. Labels ride `arcPath` baselines as `<textPath>`, reversed on lower half so they never read upside down.
- **src/lib.js — colorMapper (swappable)**: `{category(name, def), note(catName, def, i, n)}`. Only place colours are computed — reassign its properties to swap schemes. Note uses its own authored `noteColors` entry when it has one, else a `shades()` ramp off family hue. `noteColorOf` = defensive lookup at render time. `ink()` picks dark or light text per fill.
- **src/lib.js — wheel layout**: `ringOrder` seats families by "power" (note count), biggest take slots nearest vertical where a portrait screen has headroom. `radialGroups` splits a family with `groups:` into concentric bands. `wheelGeom` returns radii for one state (`open` bites tier 1 inward + shrinks hub; `overflow` frees room for second pill rim; `tiered` widens note band). `hitWheel` resolves a pointer already reduced to (r, ang), hysteresis on both rings.
- **src/lib.js — pill orbit**: `layoutPills` places every logged note as a capsule on hub rim, recomputed from scratch each render. `layoutWheel` runs it twice — outer rim spawns only when inner genuinely cannot hold everything — and when both rims are full falls back to even fixed pitch, so a heavy cup crowds rather than loses notes. Past ~20 notes labels hit the 5.8 px floor: still legible, practical ceiling for one cup. `dragPillAngle` clamps a dragged pill at its neighbour's edge, jumps past only once cursor clears that neighbour's centre.
- **src/lib.js — fingerprint**: `fingerprintTones` turns logged notes into one tone each, placed on its own bearing just outside hub disc. Share pulls a tone inward on a log curve. `mixWeightFor` renormalises blend when a handle is dragged.
- **src/lib.js — brew store**: `uuid`, `validateBrews`, `newBrewDoc`, `fillBrew`, `mergeBrews`, `loadStore`/`saveStore` (localStorage keys `brews`, `currentBrewId`). Docs MongoDB-shaped `{_id, name, origin, brewMethod, createdAt, scores{}, remark, notes:[{category, note, ts}]}`, insertable as-is. Future backend swaps only `loadStore`/`saveStore` for fetch. `fillBrew` back-fills cupping fields, so pre-v0.2 docs still load.
- **src/wheel.jsx — `<Wheel>`**: owns transient interaction state (open family, hot note, hand-placed pill angles, hand-set mix), turns pointer events into `onAdd`/`onRemove`. Press-drag-release and tap-tap both commit, guarded by 80 ms dwell so fast drag-through does not log.
- **src/wheel.jsx — pill drag bypasses React on purpose**: sliding a pill along the rim is pure rotation about origin, so a move writes one `transform="rotate(...)"` attribute to the pill's wrapper `<g>` and returns. State commits once, on release (once more if pill crosses the 90°/270° line where its label must re-flip). Drill re-renders only when pointer crosses into a new sector, but a drag yields a continuous angle — routing that through state meant a full `layoutPills` + `fingerprintTones` pass per pointer event, and since a tone's bearing follows its pill, every such frame also dirtied hub blur + `feTurbulence` grain. That re-rasterisation, not the layout maths, made dragging feel heavier than selecting.
- Each pill renders as two nested `<g>`: outer = drag rotation (SVG attribute, written imperatively), inner = CSS transform for delete + ring-switch animations. Cannot share a node — CSS `transform` overrides the SVG `transform` attribute outright.
- `at()` caches SVG bounding rect for the length of a gesture. Measuring per move forced a layout flush between DOM writes.
- **Saturation applies per layer, never once around whole wheel.** A CSS `filter` forces its entire subtree into one offscreen buffer, so a single `saturate()` wrapper welded tier 1, tier 2, pills and hub into one raster unit: anything moving re-rasterised all of it, *through* hub blur + `feTurbulence` grain. Tier 1, tier 2, orbit, fingerprint now each carry their own `filter: sat`, rasterise independently.
- Hub tone circles are radial gradients already fading to `stopOpacity 0`, so `feGaussianBlur` over them bought very little — and its `<animateTransform repeatCount="indefinite">` drift meant that blur re-ran every frame, forever, over a filter region 16× disc area. Filter gone. Softness comes from the gradients.
- **src/wheel.jsx — `<Fingerprint>`**: the hub. One radial gradient per tone over a base coat, clipped to disc, grain wash + vignette on top. Drift uses SVG `<animateTransform>`, not CSS transform, which would escape the clip in some renderers.
- **src/App.jsx — `<App>`**: state = `flavors` (fetched yaml) + `store` ({brews, currentId}, persisted via effect). `<Wheel>` keyed by brew id, so switching cups resets wheel transient state.
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
- `flavors.yaml` list order = order notes fan out within a family. Ring position is *not* file order — `ringOrder` computes it from note counts.
- Editing `flavors.yaml` can orphan notes already logged in a brew. They still render, neutral fallback colour.
- Export writes `<brew name> DD-MM-HH-MM.json`, not fixed `brews.json`. Debugging convenience: folder of dumps says which cup and when, two exports never overwrite. Name stripped to `\w`, space, `-`; falls back to `brews` if nothing left. Import ignores filename, validates contents.
- Vite `base: './'` so built site works on GitHub Pages subpaths. `dist/index.html` must reference `./assets/...`; absolute `/assets/...` 404s on a project-page subpath and only there.
- **pnpm, pinned.** `packageManager: pnpm@11.3.0` in `package.json` is what `pnpm/action-setup` reads, so CI uses the laptop's pnpm instead of drifting to latest. CI installs with `--frozen-lockfile` — `pnpm-lock.yaml` is the only lockfile that counts.
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
