# Coffee Taste-Note Wheel — mobile web app

## Context

Typing taste notes during brews/cuppings is tedious. Tasters start from a blurry category (Citrus, Stonefruit...) and drill into specifics (bergamot, sicilian orange). Build a mobile-first static web page: a radial wheel you tap to drill from category into leaf notes. No backend; flavor tree is a user-editable YAML file; tasted brews persist locally in MongoDB-document shape for a future backend.

**Phase 1 (this plan) is deliberately tap-tap-tap** — plain taps, minimal animation. The fancy interaction (press-and-hold drag drill, origin shifting to bottom-left, animated fan-out by intensity) is Phase 2, a separate UX/UAT effort on top of a working foundation.

Repo is empty — pure greenfield scaffold.

## Decisions (confirmed with user)

- Static mobile web page, no backend, deployable to GitHub Pages.
- Flavor tree: **two levels** (Category → leaf notes), stored in `flavors.yaml`, hand-editable. List order in YAML = display order (author encodes the "intensity sorting").
- Brews stored as **MongoDB-compliant JSON documents**. Since a static page can't write files: localStorage is the live store; explicit **Export** downloads `brews.json`, **Import** loads one back. Same documents can later be POSTed to a real backend unchanged.

## Files (fewest possible)

```
index.html      — all HTML + CSS + JS in one file
flavors.yaml    — the wheel data, user-editable
status.md       — phase tracker
architecture.md — codebase map
prompts/phase_1.md — this feature's impl notes
```

No build step, no framework, no npm. One CDN script tag: `js-yaml` (parsing YAML by hand is more code than the tag).

## Data

### flavors.yaml
```yaml
Citrus:
  color: "#f5a623"
  notes: [lemon, lime, grapefruit, navel orange, sicilian orange, bergamot]
Stonefruit:
  color: "#e2555f"
  notes: [peach, apricot, nectarine, cherry, plum]
Defects:
  color: "#7a6a5f"
  notes: [phenolic, potato, baggy, over-ferment, mold]
```

### Brew document (localStorage key `brews`, array of these)
```json
{
  "_id": "crypto.randomUUID()",
  "name": "Ethiopia Chelbesa",
  "brewMethod": "V60",
  "createdAt": "2026-08-07T09:00:00.000Z",
  "notes": [
    { "category": "Citrus", "note": "bergamot", "ts": "2026-08-07T09:01:12.000Z" }
  ]
}
```
`_id` as string UUID, ISO-8601 dates — drops straight into MongoDB later.

## UI / interaction

Single screen, portrait:

1. **Header**: current brew name (tap to rename / new brew), brew picker (list from localStorage).
2. **Wheel** (SVG, ~90vw square): N equal pie sectors from YAML categories, each labeled + colored.
3. **Note chips**: selected notes for the current brew, tap a chip to delete it.
4. **Footer buttons**: Copy (comma-separated text to clipboard), Export JSON, Import JSON.

Interaction (Phase 1 — plain taps, `click` events on SVG sectors):
- Tap a category sector → wheel re-renders as that category's leaf notes (full-circle pie of children in shades of the category color, center hub shows category name).
- Tap a leaf → note appended to current brew, wheel returns to categories.
- Tap the center hub (or anywhere outside sectors) → back to categories, no selection.
- Wheel render is one pure function `renderWheel(items) → SVG string`, called with either categories or a category's notes. **This same function and state machine is what Phase 2's gesture layer will drive** — Phase 2 changes input handling and animation, not the data flow.

Labels: radial text, `text-anchor` per side; long names shrink via `textLength`. Defects category renders like any other — no special casing.

### Phase 2 (out of scope now, don't build for it beyond the note above)
Press-and-hold drag drill without breaking the touch; on drill, origin shifts to bottom-left and children fan out sorted by intensity, animated. Its own plan + heavy UAT when Phase 1 is in daily use.

## Implementation order

1. `flavors.yaml` with ~8 realistic SCA-ish categories.
2. `index.html`: fetch + parse YAML, render category pie (pure function: tree → SVG string).
3. Tap navigation state machine (categories ⇄ drilled) via click handlers on sectors.
4. Brew store: load/save localStorage, new/rename/switch brew, chips render, delete note.
5. Copy / Export (Blob + `a[download]`) / Import (`<input type="file">` + JSON.parse + basic shape validation at the trust boundary).
6. Mobile polish: `touch-action: none` on the wheel, `user-select: none`, viewport meta, 100dvh layout.
7. Docs: `status.md`, `architecture.md`, `prompts/phase_1.md`.

One runnable check (ponytail rule): a `?selftest` query param runs asserts on the pure parts — YAML→sector geometry (angles sum to 360, N items → N sectors) and brew-doc round-trip through export/import validation — and reports pass/fail on screen.

## Acceptance criteria (draft — edit freely)

- On a phone browser: tap Citrus, tap bergamot → "bergamot" chip appears. Three notes logged in ≤ 10s, no scroll/zoom interference, no mistaps between adjacent sectors.
- Tapping the center hub while drilled returns to categories without selecting.
- Editing `flavors.yaml` (add category/note, reorder) changes the wheel on reload with no code edits.
- Brews survive page reload; Export produces a `brews.json` whose documents insert into MongoDB unmodified; Import restores them.
- Copy puts `lemon, bergamot, peach` style text on the clipboard.

## Verification

- `python -m http.server` in the repo (fetch of flavors.yaml needs http, not file://), open on desktop with devtools mobile emulation, then on an actual phone via LAN IP.
- Run `?selftest` — all asserts green.
- Manual gesture pass on the acceptance criteria above.
- Deploy: push to GitHub Pages (plain static files, nothing to configure).

## Skipped (add when needed)

- Press-drag gesture + animated fan-out — Phase 2, separate plan + UAT.
- Service worker / PWA offline — add when "installed app" feel is wanted; the page already works offline once cached by the browser.
- Arbitrary tree depth — YAML shape would gain nested dicts; navigation drills per level.
- Backend sync — the document schema is already Mongo-ready; add an API layer later, storage code swaps localStorage for fetch.
