# Architecture

React + Vite mobile web app, no backend. Pure logic lives apart from components so it stays Node-testable.

```
index.html            — Vite entry (just #root + script tag)
src/main.jsx          — mounts <App/>, imports styles.css
src/App.jsx           — all components + state: <Label>, <Wheel>, <App/>
src/lib.js            — ALL pure logic + storage (no React): geometry, colors, brew store
src/styles.css        — the entire stylesheet
public/flavors.yaml   — flavor tree data, user-editable (Category -> {color, notes[]})
test.js               — pure-function checks against src/lib.js (`npm test`, plain Node)
legacy-standalone.html — pre-React single-file version, delete once React port is trusted
```

## Blocks
- **src/lib.js — geometry (pure)**: `polar`, `sectorPath`, `norm`, `splitLabel`, `fanLayout`. Radii/angles in the `R` constant. Two-tier layout: inner pie r 13–30 = categories, outer ring r 31–48 = fan of the tapped category's notes, 15°/child centered on the parent's bearing (SCA-wheel style).
- **src/lib.js — colorMapper (swappable)**: `{category(name, def), note(catName, def, i, n)}` — the only place colors are computed; reassign its properties to swap color schemes. Backed by `hexToHsl`/`shades`.
- **src/lib.js — brew store**: `uuid`, `validateBrews`, `newBrewDoc`, `mergeBrews`, `loadStore`/`saveStore` (localStorage keys `brews`, `currentBrewId`). Docs are MongoDB-shaped `{_id, name, brewMethod, createdAt, notes:[{category, note, ts}]}`, insertable as-is; a future backend swaps only `loadStore`/`saveStore` for fetch calls.
- **src/App.jsx — `<Wheel>`**: renders SVG from cats + optional fan; callbacks `onCat`/`onNote`/`onClose`. Phase 2's gesture layer drives this same component.
- **src/App.jsx — `<App>`**: state = `flavors` (fetched yaml), `view` (open category or null), `store` ({brews, currentId}, persisted via effect). Header (brew select/rename/new via native `prompt`), chips (tap = delete), footer (copy w/ http fallback, export = Blob download, import = validate + `mergeBrews`, imported wins by `_id`).

## Data flow
tap sector → `setView` / append note to current brew → `saveStore` effect → re-render.

## Conventions
- `flavors.yaml` list order = wheel display order (intensity sorting is authored, not computed).
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
