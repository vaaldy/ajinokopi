# Status

## Done
- Phase 1 — tap-drill flavor wheel: YAML-driven wheel, tap category → tap note, brew store (localStorage, Mongo-shaped docs), copy/export/import, `?selftest`.
- Phase 1 rev 2 (post-UAT feedback): two-tier layout — category pie stays visible, notes fan out in an outer ring centered on the parent's bearing (15°/child); label rendering fixed (line-split + font scaling instead of glyph squeeze); colors routed through swappable `colorMapper`.
- Phase 1 rev 3: ported to React + Vite (project expected to grow). Pure logic isolated in `src/lib.js` (Node-tested via `npm test`, 22/22), UI in `src/App.jsx`. Old single-file app kept as `legacy-standalone.html` until port is trusted.

## WIP
- (none)

## Todo
- Phase 1 UAT: real-phone pass on acceptance criteria (see prompts/phase_1.md), deploy to GitHub Pages.
- Phase 2 — gesture UX: press-and-hold drag drill, origin shift to bottom-left, animated fan-out by intensity. Own plan + heavy UAT.
- Later (only when needed): PWA/service worker, arbitrary tree depth, backend sync (docs already Mongo-ready).
