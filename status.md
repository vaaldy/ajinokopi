# Status

phase 1 = tap-drill flavor wheel, YAML-driven flavor tree, localStorage brew store (Mongo-shaped docs) and copy/export/import (done)
phase 2 = press-drag-release gesture drill, orbiting note pills, live fingerprint hub and the SCA cupping sheet (done — phone UAT pending)
phase 3 = release CI/CD: version-bump auto-tagging, Pages deploy and GitHub Releases (planned — plan approved, nothing built)

## Open
- Phase 2 UAT on a real phone. Watch the 80 ms dwell guard under a thumb, pill drag vs. tap-to-delete at 14 px slop, and the outer pill rim appearing around 6 notes (earlier than the design doc implies).
- Phase 3 prerequisites, all manual: commit `src/wheel.jsx`, settle on `pnpm-lock.yaml` and drop `package-lock.json`, add `version` + `packageManager` to `package.json`, set repo Pages source to "GitHub Actions".
- Re-test on a phone: pill drag, the hub gradient and the tone handles. Confirm (a) all three now run at refresh rate, (b) the hub still looks soft enough without the blur, (c) pill labels still flip correctly across 90°/270°.
- `layoutPills` is superlinear: ~0.06 ms at 4 notes, ~2.1 ms at 20 on a laptop. It no longer runs during a drag, but a very full cup still pays it on every add/delete.
- Design-doc options not built: `1c` (SCA cupping pass — intensity dots + per-quality descriptor drill) and `2d` (radial dial cluster replacing the linear sliders). `1d`'s fingerprint card shipped as the wheel's hub instead of a standalone share card.
- Later, only when needed: PWA/service worker, arbitrary tree depth, backend sync (docs are already Mongo-ready).
