# Phase 1 — tap-drill flavor wheel

Full plan: [phase_1_plan.md](phase_1_plan.md) (approved 2026-08-07).

## Scope
Tap-tap-tap only. No press-drag gesture, no fancy animation — that is Phase 2.

## Implementation notes
- `renderWheel(cats, fan, hubLabel)` returns an SVG string, 100×100 viewBox. Two tiers: category pie in ring r 13–30 (always visible; single-item wheel uses a 359.99° sector — a true 360° arc degenerates), and when a category is tapped, a fan of its notes in ring r 31–48: 15° per child (shrinks if n×15 > 360), centered on the parent sector's mid bearing. E.g. Floral at 30–60° with 4 notes → fan 15–75°. Non-selected categories dim to opacity 0.35. All radii/angles in the `R` constant.
- Radial labels: rotate by `mid-90°` (right half) or `mid+90°` (left half) so text never reads upside down. Long labels split at the space nearest the middle into two tspan lines + per-label font scaling — no `textLength` glyph squeeze.
- Colors go through the swappable `colorMapper` object; default note shading spreads HSL lightness 30–56% from the category's base hue.
- `uuid()` and clipboard both have http fallbacks (secure-context APIs fail on LAN-IP testing).
- Import merges by `_id` (imported wins) — never replaces wholesale, so no data loss.

## Acceptance criteria
- Phone: tap Citrus, tap bergamot → chip appears. Three notes in ≤10s, no scroll/zoom interference, no mistaps.
- Hub tap while drilled = back, no selection.
- Editing flavors.yaml changes wheel on reload, zero code edits.
- Brews survive reload; exported brews.json inserts into MongoDB unmodified; import restores.
- Copy yields `lemon, bergamot, peach` style text.

## Verify (React + Vite since rev 3)
- `npm test` → all green (pure functions in src/lib.js; replaces the old in-page `?selftest`).
- `npm run dev` → `http://localhost:5173`; `--host` is on, so open `http://<LAN-IP>:5173` on the phone.
- Devtools mobile emulation, then real phone via LAN IP.
