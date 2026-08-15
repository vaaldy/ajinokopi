# Status

## Done
- Phase 1 — tap-drill flavor wheel: YAML-driven wheel, tap category → tap note, brew store (localStorage, Mongo-shaped docs), copy/export/import, `?selftest`.
- Phase 1 rev 2 (post-UAT feedback): two-tier layout — category pie stays visible, notes fan out in an outer ring centered on the parent's bearing (15°/child); label rendering fixed (line-split + font scaling instead of glyph squeeze); colors routed through swappable `colorMapper`.
- Phase 1 rev 3: ported to React + Vite (project expected to grow). Pure logic isolated in `src/lib.js` (Node-tested via `npm test`), UI in `src/App.jsx`.
- Phase 2 — gesture UX, built from the "Taste Notes Explorations" design doc (option 2b, the master):
  full-circle wheel with press-drag-release drill, tier 2 fanning radially on the family's own
  bearing, logged notes leaving the drill as draggable pills orbiting the hub, and the hub itself
  as a live taste fingerprint mixed from those notes. Cupping sheet (origin, method, four SCA
  sliders, remarks) added below the wheel; Intensity drives the whole wheel's saturation.
  New pastel palette with per-note colours and a `Tea` family in `flavors.yaml`.

## WIP
- (none)

## Todo
- UAT on a real phone: the whole point of the gesture layer. Watch for (a) the drill's 80 ms dwell guard feeling right under a thumb, (b) pill drag vs. tap-to-delete at 14 px of slop, (c) the outer pill rim appearing around 6 notes — earlier than the design doc implies.
- Deploy to GitHub Pages.
- Design-doc options not built: `1c` (SCA cupping pass — intensity dots + per-quality descriptor drill) and `2d` (radial dial cluster in place of the linear sliders, "Testing" in the doc). `1d`'s fingerprint card shipped as the wheel's hub rather than as a standalone share card.
- Later (only when needed): PWA/service worker, arbitrary tree depth, backend sync (docs already Mongo-ready).

## Known gaps
- `layoutPills` runs on every render, including every pointermove during a drill. Fine on a laptop; measure on a phone with a full cup.
- A very full cup (~20+ notes) crowds pills onto a fixed pitch and their labels shrink to the 5.8 px floor. Legible, but that is the practical ceiling for one cup.
