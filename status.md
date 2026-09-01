# Status

Releases, not phases. `package.json` `version` is source of truth. Phase N shipped as v0.N.

v0.1 = tap-drill flavor wheel, YAML flavor tree, localStorage brew store (Mongo-shaped docs), copy/export/import (done — plan at `prompts/phase_1_plan.md`, written before the scheme)
v0.2 = press-drag-release drill, orbiting note pills, live fingerprint hub, SCA cupping sheet, brew-named export files (done)
v0.3 = release CI/CD: version-bump auto-tagging, Pages deploy, GitHub Releases (done — v0.3.0-dev.1 tagged, published as prerelease, live at `https://vaaldy.github.io/ajinokopi/`)

v0.3.1 = brew fields origin, process, varietal, brew method; brew date under the name (in progress)

## Open

Next, version not picked yet:
- Nonlinear gradient wheel rendering — smoother tier colour ramp than today's linear steps.
- Customizable taste notes: user edits tier 1 families and tier 2 notes, not only `flavors.yaml` by hand.
- Daily brew tracking — brews grouped and browsable by date, one cup per day view.

Design-doc options `1c` (SCA cupping pass) and `2d` (radial dial cluster) dropped — `1d`
shipped as wheel hub instead of standalone share card. PWA, arbitrary tree depth, backend sync
dropped until a real need shows up (docs already Mongo-ready).
