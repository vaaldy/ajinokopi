# Architecture

React + Vite mobile web app, no backend. Pure logic lives apart from components so it stays Node-testable.

```
index.html            — Vite entry (#root + script tag + the two Google fonts)
src/main.jsx          — mounts <App/>, imports styles.css
src/App.jsx           — the screen: title, <Wheel/>, cupping sheet, brew management
src/wheel.jsx         — <Wheel> + <Fingerprint>: the whole SVG and its pointer handling
src/lib.js            — ALL pure logic + storage (no React): geometry, colors, wheel layout,
                        pill orbit, fingerprint math, brew store
src/styles.css        — the entire stylesheet
public/flavors.yaml   — flavor tree data, user-editable (Family -> {color, notes[], noteColors?, groups?})
test.js               — pure-function checks against src/lib.js (`npm test`, plain Noe)
```

## The screen
One cup per screen, top to bottom: its name (tap the pencil to rename), the wheel, then the
cupping sheet — origin, metho, the four SCA sliders, remarks. The footer carries the brew
switcher and copy/export/import.

## Blocks
- **src/lib.js — geometry (pure)**: `polar`, `sectorPath`, `capsulePath`, `arcPath`, `flipped`, `norm`, `angDist`. Authored in a fixed 390-unit space centred on `ORIGIN`; `viewBoxFor` crops and zooms around that origin instead of rescaling, so every radius is absolute. 0° points up, angles run clockwise. Labels ride `arcPath` baselines as `<textPath>`, reversed on the lower half so they never read upside down.
- **src/lib.js — colorMapper (swappable)**: `{category(name, def), note(catName, def, i, n)}` — the only place colours are computed; reassign its properties to swap schemes. A note uses its own authored `noteColors` entry when it has one, else a `shades()` ramp off the family hue. `noteColorOf` is the defensive lookup used at render time, and `ink()` picks dark or light text per fill.
- **src/lib.js — wheel layout**: `ringOrder` seats families by "power" (note count) so the biggest take the slots nearest the vertical, where a portrait screen has headroom. `radialGroups` splits a family with `groups:` into concentric bands. `wheelGeom` returns the radii for one state (`open` bites tier 1 inward and shrinks the hub; `overflow` frees room for a second pill rim; `tiered` widens the note band). `hitWheel` resolves a pointer already reduced to (r, ang), with hysteresis on both rings.
- **src/lib.js — pill orbit**: `layoutPills` places every logged note as a capsule on the hub rim, recomputed from scratch on every render. `layoutWheel` runs it twice — the outer rim only spawns when the inner one genuinely cannot hold everything — and when both rims are full it falls back to an even fixed pitch so a heavy cup crowds rather than losing notes. Past roughly 20 notes the labels reach the 5.8 px floor — still legible, but that is the practical ceiling for one cup. `dragPillAngle` clamps a dragged pill at its neighbour's edge and only jumps past once the cursor clears that neighbour's centre.
- **src/lib.js — fingerprint**: `fingerprintTones` turns the logged notes into one tone each, placed on its own bearing just outside the hub disc; share pulls a tone inward on a logarithmic curve. `mixWeightFor` renormalises the blend when a handle is dragged.
- **src/lib.js — brew store**: `uuid`, `validateBrews`, `newBrewDoc`, `fillBrew`, `mergeBrews`, `loadStore`/`saveStore` (localStorage keys `brews`, `currentBrewId`). Docs are MongoDB-shaped `{_id, name, origin, brewMethod, createdAt, scores{}, remark, notes:[{category, note, ts}]}`, insertable as-is; a future backend swaps only `loadStore`/`saveStore` for fetch calls. `fillBrew` back-fills the cupping fields, so phase-1 docs still load.
- **src/wheel.jsx — `<Wheel>`**: owns the transient interaction state (open family, hot note, hand-placed pill angles, hand-set mix) and turns pointer events into `onAdd`/`onRemove`. Press-drag-release and tap-tap both commit, guarded by an 80 ms dwell so a fast drag-through does not log.
- **src/wheel.jsx — dragging a pill bypasses React on purpose**: sliding a pill along the rim is a pure rotation about the origin, so a move writes one `transform="rotate(...)"` attribute to the pill's wrapper `<g>` and returns. State is committed once, on release (and once more if the pill crosses the 90°/270° line where its label has to re-flip). Drilling only re-renders when the pointer crosses into a new sector, but a drag produces a continuous angle — routing that through state meant a full `layoutPills` + `fingerprintTones` pass per pointer event, and because a tone's bearing follows its pill, every one of those frames also dirtied the hub's blur and `feTurbulence` grain. That re-rasterisation, not the layout maths, is what made dragging feel heavier than selecting.
- Each pill therefore renders as two nested `<g>`: the outer one is the drag rotation (SVG attribute, written imperatively), the inner one carries the CSS transform for the delete and ring-switch animations. They cannot share a node — a CSS `transform` overrides the SVG `transform` attribute outright.
- `at()` caches the SVG's bounding rect for the length of a gesture; measuring it per move forced a layout flush between DOM writes.
- **Saturation is applied per layer, never once around the whole wheel.** A CSS `filter` forces its entire subtree into one offscreen buffer, so a single `saturate()` wrapper welded tier 1, tier 2, the pills and the hub into one raster unit: anything that moved re-rasterised all of it, *through* the hub's blur and `feTurbulence` grain. Tier 1, tier 2, the orbit and the fingerprint now each carry their own `filter: sat`, so they rasterise independently.
- The hub's tone circles are radial gradients that already fade to `stopOpacity 0`, so the `feGaussianBlur` over them bought very little — and its `<animateTransform repeatCount="indefinite">` drift meant that blur re-ran every frame, forever, over a filter region 16× the disc's area. The filter is gone; the softness comes from the gradients.
- **src/wheel.jsx — `<Fingerprint>`**: the hub. One blurred radial gradient per tone over a base coat, clipped to the disc, with a grain wash and vignette on top. Drift uses SVG `<animateTransform>`, not a CSS transform, which would escape the clip in some renderers.
- **src/App.jsx — `<App>`**: state = `flavors` (fetched yaml) and `store` ({brews, currentId}, persisted via effect). `<Wheel>` is keyed by brew id, so switching cups resets the wheel's transient state.

## Data flow
press a family → tier 2 fans out → release on a note → `onAdd` appends to the current brew →
the note leaves the drill and becomes a pill → `saveStore` effect → re-render.

## Conventions
- `flavors.yaml` list order = the order notes fan out within a family. Ring position is *not* this file's order — `ringOrder` computes it from note counts.
- Editing `flavors.yaml` can orphan notes already logged in a brew; they still render, in a neutral fallback colour.
- Vite `base: './'` so the built site works on GitHub Pages subpaths.

## Local dev
```
conda env create -f environment.yml   # once (python + nodejs)
conda run -n ajinokopi npm install    # once
conda run -n ajinokopi npm run dev    # http://localhost:5173, --host exposes LAN for phone testing
conda run -n ajinokopi npm test       # pure-function checks
conda run -n ajinokopi npm run build  # dist/ for GitHub Pages
```
(System-wide node works the same: `npm run dev` etc.)
