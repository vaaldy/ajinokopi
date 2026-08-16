# Status

phase 1 = tap-drill flavor wheel, YAML flavor tree, localStorage brew store (Mongo-shaped docs), copy/export/import (done)
phase 2 = press-drag-release drill, orbiting note pills, live fingerprint hub, SCA cupping sheet, brew-named export files (done — v0.1.0)
phase 3 = release CI/CD: version-bump auto-tagging, Pages deploy, GitHub Releases (planned — plan approved, nothing built)

## Open
- Phase 2 UAT on real phone, now also covering render rework: 80 ms dwell guard under a thumb, pill drag vs tap-to-delete at 14 px slop, outer pill rim appearing ~6 notes (earlier than design doc implies), and whether pill drag / hub gradient / tone handles hold refresh rate.
- Phase 3 prerequisites, all manual. Done: `src/wheel.jsx` + `pnpm-lock.yaml` committed, `version` set to 0.1.0. Left: `git rm package-lock.json`, add `packageManager` to `package.json`, set repo Pages source to "GitHub Actions".
- Check hub still looks soft enough without the blur, and pill labels still flip correctly across 90°/270°.
- `layoutPills` superlinear: ~0.06 ms at 4 notes, ~2.1 ms at 20 on a laptop. No longer runs during a drag, but a full cup still pays it on every add/delete.
- Design-doc options not built: `1c` (SCA cupping pass — intensity dots + per-quality descriptor drill), `2d` (radial dial cluster replacing linear sliders). `1d` fingerprint card shipped as wheel hub instead of standalone share card.
- Later, only when needed: PWA/service worker, arbitrary tree depth, backend sync (docs already Mongo-ready).
