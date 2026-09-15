# Status

Releases, not phases. `package.json` `version` is source of truth. Phase N shipped as v0.N.

v0.1 = tap-drill flavor wheel, YAML flavor tree, localStorage brew store (Mongo-shaped docs), copy/export/import (done — plan at `prompts/phase_1_plan.md`, written before the scheme)
v0.2 = press-drag-release drill, orbiting note pills, live fingerprint hub, SCA cupping sheet, brew-named export files (done)
v0.3 = release CI/CD: version-bump auto-tagging, Pages deploy, GitHub Releases (done — v0.3.0-dev.1 tagged, published as prerelease, live at `https://vaaldy.github.io/ajinokopi/`)

v0.3.2 = brew fields process, origin, varietal, brew method; whole screen restyled as terminal —
topbar path with editable name + date-dir, sys menu (import/copy/export/rm), indented file tree
with `+ new file...`, notes window as `func coffee()` source, note-coloured highlights, mono score
bars (done)

v0.3.3 = hub true-blend base coat (`mixColors`, linear sRGB), zen-style tone gradients (oversized,
eased falloff, pre-mixed toward blend, glint removed), wide/landscape grid layout (wheel centred,
terminal full-height right), portrait wheel height cap, topbar `+` new brew, fat-finger padding,
Esc closes menus, auto-growing remarks, Malic family (in progress — push to deploy)
v0.3.4-dev.1 = revised seed flavor taxonomy: Tartaric grapes, Sweet monk fruit/stevia, Herbal / Tea outer band (planned)
v0.3.4-dev.4 = run-to-card view, newest-first brew archive, live fingerprint card rendering (done)
v0.3.4-dev.6 = archive header and iPhone viewport/toolbar fixes (done)

## Open

Next, version not picked yet:
- Swipe left/right between wheel + terminal and card/archive screens; replace button-only navigation.
- Customizable taste notes: user edits tier 1 families and tier 2 notes, not only `flavors.yaml` by hand.
- Camera logging — snap photo as part of brew record.
- Text parsing from coffee bag label — photo or camera text into brew fields (origin, process, varietal).
- Nonlinear gradient wheel rendering — smoother tier colour ramp than today's linear steps.
- Daily brew tracking — file tree groups by date now; still no per-day view or day summary.
- v0.3.2 phone UAT: tree `\u25b8` rows tappable at row height, long names in tree/topbar, score-bar
  `\u2591` glyph render via font fallback, menus over the wheel, `rm` confirm flow.
- Decide whether fake syntax stays readable to non-coders — sheet is what a taster fills in.
- Sharing consolidation: copy + export are one intent (share); `navigator.share` with file + text,
  clipboard fallback; import = receiving end. Sys menu shrinks to share/import/rm.

Design-doc options `1c` (SCA cupping pass) and `2d` (radial dial cluster) dropped — `1d`
shipped as wheel hub instead of standalone share card. PWA, arbitrary tree depth, backend sync
dropped until a real need shows up (docs already Mongo-ready).
