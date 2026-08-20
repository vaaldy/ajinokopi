# Status

Releases, not phases. `package.json` `version` is source of truth. Phase N shipped as v0.N.

v0.1 = tap-drill flavor wheel, YAML flavor tree, localStorage brew store (Mongo-shaped docs), copy/export/import (done — plan at `prompts/phase_1_plan.md`, written before the scheme)
v0.2 = press-drag-release drill, orbiting note pills, live fingerprint hub, SCA cupping sheet, brew-named export files (done)
v0.3 = release CI/CD: version-bump auto-tagging, Pages deploy, GitHub Releases (partial — three workflows written and YAML-valid, none has run yet)

## Open
- v0.2 UAT on real phone, now also covering render rework: 80 ms dwell guard under a thumb, pill drag vs tap-to-delete at 14 px slop, outer pill rim appearing ~6 notes (earlier than design doc implies), and whether pill drag / hub gradient / tone handles hold refresh rate.
- v0.3 prerequisites left, all manual: `git rm package-lock.json` (still tracked, and `npm install` would resurrect it), set repo Settings → Pages → Source = **GitHub Actions** (cannot be scripted; without it the deploy job fails on an otherwise perfect run).
- v0.3 pipeline unproven — no workflow has executed. Test in the plan's order: commit + push, confirm `ci.yml` green; then `git tag v0.2.0 && git push --tags` to exercise `release.yml` alone; then bump `version` to 0.2.1 to exercise `tag.yml` end to end.
- Check acceptance criteria that only a real run can show: red `pnpm test` creates **no** tag, a fix pushed afterwards on the *same* version still tags and deploys, an already-tagged version is a quiet no-op, a `-dev.N` tag lands as a GitHub prerelease, hand-pushed tag still deploys.
- Load `https://vaaldy.github.io/ajinokopi/` on the phone once Pages is live — `App.jsx` fetches `flavors.yaml` relative, so that page is the only check that `base: './'` and the Pages subpath agree.
- Check hub still looks soft enough without the blur, and pill labels still flip correctly across 90°/270°.
- `layoutPills` superlinear: ~0.06 ms at 4 notes, ~2.1 ms at 20 on a laptop. No longer runs during a drag, but a full cup still pays it on every add/delete.
- Design-doc options not built: `1c` (SCA cupping pass — intensity dots + per-quality descriptor drill), `2d` (radial dial cluster replacing linear sliders). `1d` fingerprint card shipped as wheel hub instead of standalone share card.
- Later, only when needed: PWA/service worker, arbitrary tree depth, backend sync (docs already Mongo-ready).
