# Phase 3 — release CI/CD

## Context

Phases 1 and 2 shipped; deployment is still "build on the laptop and hope". `status.md` has carried
*Deploy to GitHub Pages* in Todo since rev 3. Make releasing a single act: **bump `version` in
`package.json`, push to main — everything else is automatic.** Tag, build, deploy, GitHub Release.

The app is a static Vite bundle with no backend, no env vars and no secrets to inject, so the whole
pipeline is install → test → build → publish a folder. Repo is `vaaldy/ajinokopi`, default branch
`main`, and `vite.config.js` already sets `base: './'` for Pages subpaths.

**Deliberately simple.** No preview environments, no changelog tooling, no release-please. If this
plan needs a diagram, it has failed.

## Decisions (confirmed with user)

- **Trigger is a semver bump on main.** A push to `main` that changes `version` in `package.json`
  creates and pushes the matching `v<semver>` tag, and that release runs. No hand-typed `git tag`.
- **Target is GitHub Pages**, built by Actions (not from a committed `dist/`, which stays gitignored).
- **pnpm**, not npm — see prerequisite 2.

## Prerequisites (none of this works until these land)

1. **Commit the Phase 2 work.** `src/wheel.jsx` is untracked. CI builds what is committed, so today
   it would deploy a different app than the one on the laptop — and `pnpm test` imports
   `layoutPills`/`layoutWheel`, so it would not even build.
2. **One lockfile.** `pnpm-lock.yaml` (lockfileVersion 9, `node_modules/.pnpm` present) is the real
   one and is untracked; `package-lock.json` is from Aug 11 and *is* tracked. Commit the pnpm lock,
   `git rm package-lock.json`. CI installs with `--frozen-lockfile`, which fails loudly rather than
   silently resolving a different tree — that only helps if the committed lock is the true one.
3. **Add a `version` field.** `package.json` has none, so there is currently nothing to diff. Start
   at `0.3.0` (phases 1–2 are shipped but the phone UAT hasn't happened, so not 1.0.0); the first
   automated release is then whatever the first bump after this is.
4. **Add `"packageManager": "pnpm@11.3.0"`** so `pnpm/action-setup` pins CI to the same pnpm as the
   laptop instead of drifting to whatever is latest.
5. **One-time repo setting:** Settings → Pages → Source = **GitHub Actions**. This is not a file in
   the repo and cannot be scripted here; without it the deploy job fails on an otherwise perfect run.

## The one real design constraint

**A tag pushed using the default `GITHUB_TOKEN` does not trigger another workflow.** That is
GitHub's deliberate guard against recursive runs. So the obvious shape — "`tag.yml` pushes a tag,
`release.yml` listens on `push: tags`" — quietly does nothing at all, and the failure mode is a
green tagging run followed by silence. Three ways out:

- **(a) PAT** — a repo-scoped personal access token in secrets. Works, but adds a credential to
  store, scope and rotate, for a public static site that needs no other secret.
- **(b) Reusable workflow** — `release.yml` declares *both* `workflow_call` and `push: tags:
  ['v*.*.*']`. The tagger invokes it directly via `uses:` after pushing the tag. No credential, and
  a hand-pushed tag still works as an escape hatch. **Chosen.**
- **(c) One monolithic workflow** — simplest to read, but then a manually pushed tag has no entry
  point at all.

## Files

```
.github/workflows/
  ci.yml        — on push to main + PRs: install, test, build. Proves green. Deploys nothing.
  tag.yml       — on push to main touching package.json: detect bump, test, tag, call release
  release.yml   — reusable + tag-triggered: build → deploy Pages → GitHub Release
```

### `ci.yml`
`on: push: branches: [main]` and `pull_request`. One job: checkout, `pnpm/action-setup`,
`actions/setup-node` with `cache: pnpm`, `pnpm install --frozen-lockfile`, `pnpm test`,
`pnpm build`. ~20 lines. This is the everyday signal; it is allowed to be boring.

### `tag.yml`
`on: push: branches: [main], paths: ['package.json']`.

- `actions/checkout` with **`fetch-depth: 2`** — the default depth-1 checkout has no `HEAD~1` to
  diff against, and this is the single easiest thing to get wrong here.
- Read `version` from `package.json` at `HEAD` and from `git show HEAD~1:package.json`. Unchanged →
  exit 0 quietly (a push touching `package.json` for a dependency is not a release).
- Validate the new value against `^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$`. Junk → fail loudly.
- If `git rev-parse v$VERSION` resolves, the tag already exists → fail with "version was already
  released, bump it again" rather than clobbering.
- **Run `pnpm install --frozen-lockfile && pnpm test` before tagging.** Ordering matters: a tag is
  the permanent record of a release, so a red tree must never earn one. Test first, then tag.
- Create an annotated tag (`git tag -a v$V -m "v$V"`) as `github-actions[bot]`, push it, then a
  second job `uses: ./.github/workflows/release.yml` with `permissions` declared on the caller.

### `release.yml`
`on: workflow_call` **and** `on: push: tags: ['v*.*.*']`.

- `permissions: { contents: write, pages: write, id-token: write }`.
- `concurrency: { group: pages, cancel-in-progress: false }` — never let two deploys interleave.
- Job **build**: install, `pnpm test` (cheap, and the tag-triggered path hasn't run it),
  `pnpm build`, `actions/upload-pages-artifact` with `path: dist`.
- Job **deploy**: `environment: github-pages`, `actions/deploy-pages`.
- Job **release**: create the GitHub Release for the tag with auto-generated notes (`gh release
  create --generate-notes`, or `softprops/action-gh-release`). No artifact attached — the deploy
  *is* the artifact.

Pin Node to 22 (Vite 7 needs ≥20.19/22.12; the laptop is on 26, so 22 is the conservative floor
that still builds). Pin every action to a major version tag.

## Implementation order

1. Prerequisites 1–4 (commit wheel.jsx, lockfile swap, `version`, `packageManager`) as one commit.
2. Prerequisite 5 in the repo settings UI.
3. `ci.yml` alone. Push, confirm green. This validates the install/test/build triple in CI before
   anything can deploy.
4. `release.yml`. Test it by hand: `git tag v0.3.0 && git push --tags` → Pages goes live. This
   proves the deploy path in isolation, with no tagging logic in the way.
5. `tag.yml`. Test with a real bump to `0.3.1`.
6. Docs: `prompts/phase_3.md`, and move *Deploy to GitHub Pages* out of `status.md` Todo.

## Acceptance criteria

- Bump `version` 0.3.0 → 0.3.1, push to main. Within ~2 minutes, without touching anything else:
  tag `v0.3.1` exists, Pages serves the new build, Release `v0.3.1` is listed.
- A push to main that does **not** change `version` runs `ci.yml` and nothing else — no tag, no
  deploy.
- A red `pnpm test` means **no tag is created at all**, not a tag whose deploy failed.
- Pushing the same version twice fails with a clear message instead of a duplicate-tag error or a
  silent second deploy.
- `git tag v9.9.9 && git push --tags` by hand still deploys — the escape hatch survives.
- On a phone at `https://vaaldy.github.io/ajinokopi/`: the wheel renders and `flavors.yaml` loads.
  `App.jsx` fetches it as a *relative* `'flavors.yaml'`, so this is the check that `base: './'` and
  the Pages subpath actually agree.

## Verification

- Locally, run CI's exact sequence before writing any YAML:
  `pnpm install --frozen-lockfile && pnpm test && pnpm build && pnpm preview`. If `--frozen-lockfile`
  fails, prerequisite 2 is not done.
- Confirm `dist/index.html` references `./assets/...` — relative paths are what make Pages subpath
  hosting work; an absolute `/assets/...` would 404 there and only there.
- Prototype the version-diff as a plain shell one-liner locally
  (`git show HEAD~1:package.json | node -p "JSON.parse(require('fs').readFileSync(0)).version"`)
  before it goes into YAML, so debugging happens in a terminal and not in the Actions log.
- First real release is watched live in the Actions tab, not fired and forgotten.

## Skipped (add when needed)

- **Publishing to npm** — private app, not a library.
- **Changelog tooling** (release-please, changesets, conventional commits) — GitHub's auto-generated
  notes are enough until there is a second person reading them.
- **Per-PR preview deploys** — one contributor, one environment.
- **Staging environment** — nothing to stage against; there is no backend.
- **Signed tags / build provenance / SBOM** — no supply chain to speak of.
- **Lighthouse, visual regression, Playwright in CI** — the UI is still moving after Phase 2's UAT.
  Add once the gestures settle, and add it to `ci.yml`, not to the release path.
- **Rollback automation** — re-bumping to a fixed version is the rollback.
