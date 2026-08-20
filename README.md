# ajinokopi

ajinokopi is a somewhat fresh, somewhat stale take on jotting down notes of specialty coffee.
The UI/UX is a combination of SCA flavor wheel, and Arc browser's gradient.

Live: `https://vaaldy.github.io/ajinokopi/`

## Roadmap coming soon!

## Development Flow

```
pnpm install --frozen-lockfile   # once. Same flag CI uses, so a stale lock fails here first
pnpm dev                         # http://localhost:5173  (--host is on: open it on your phone over LAN)
pnpm test                        # pure-function checks, plain Node
pnpm build                       # dist/
```

pnpm, not npm. `npm install` regenerates `package-lock.json` and desyncs from what CI installs.

## Deploying

**Releasing is one act: bump `version` in `package.json`, push to `main`.** No `git tag` by hand, no
committing `dist/`. Everything below happens on its own.

```
edit code ──► push to main ──────────────────────► ci.yml       install, test, build. Green or not.
                    │
                    └──────────────────────────────► tag.yml     is package.json "version" tagged yet?
                                   already tagged ──► stop. Nothing happens. (most pushes)
                                   not yet tagged ──► test, tag v<version>
                                                        └──────► release.yml ──► Pages + GitHub Release
```

### What each workflow does

| File | Fires on | Does |
| --- | --- | --- |
| `ci.yml` | every push to `main`, every PR | install, `pnpm test`, `pnpm build`. Deploys nothing. Your everyday signal. |
| `tag.yml` | every push to `main` | is `version` already tagged? Yes → stop, quietly. No → `pnpm test`, then create and push tag `v<version>`. |
| `release.yml` | `tag.yml` calling it, or any pushed `v*.*.*` tag | build → upload `dist/` → deploy to Pages → cut a GitHub Release with auto-generated notes. |

### Walkthrough: shipping a change

1. Edit code. `pnpm test && pnpm build` locally.
2. Decide the version. Patch (`0.2.0` → `0.2.1`) for a fix, minor (`0.2.0` → `0.3.0`) for new behaviour.
3. Edit `version` in `package.json` to that number.
4. Commit both, push to `main`.
5. Watch the Actions tab. ~2 minutes later: tag `v0.2.1` exists, Pages serves the new build, Release
   `v0.2.1` is listed.

Not ready to release? Just push without touching `version`. It is already tagged, so `tag.yml` stops
and nothing deploys.

### Prereleases: getting a build on your phone before blessing it

Phone UAT is the only way to test the gestures, and Pages is the only way to get a build on a phone.
So iterate with a prerelease suffix instead of spending the real number:

```
0.2.1-dev.1   push, poke it on the phone, gestures feel wrong
0.2.1-dev.2   push, better
0.2.1         push. This is the one.
```

Each of those deploys to Pages normally — one environment, and putting the build in your hand is the
whole point. What changes is the GitHub Release: any tag with a `-` in it is marked **prerelease**, so
the repo's *Latest release* keeps pointing at the last stable version. `0.2.1-dev.2` sorts below
`0.2.1`, so the ordering stays honest.

Use `-rc.N` instead of `-dev.N` if you prefer. Anything after the `-` works.

### Things that will bite you

- **Already-tagged version = no release.** That is the state of most pushes. `tag.yml` logs
  `v0.2.1 already tagged - nothing to release` and stops. Not an error.
- **Red tests create no tag at all.** Tests run *before* tagging, deliberately — a tag is the permanent
  record of a release, so a broken tree never earns one.
- **Retrying a failed release is free.** Red tests left no tag, so fix the code and push again with the
  *same* `version` — you do not need to touch `package.json`, and you do not burn a version number.
  `tag.yml` runs on every push to main precisely so this works.
- **A version number is never reusable once tagged.** Ship `0.2.1`, then want to change it? That is
  `0.2.2`. Tags are permanent; the pipeline will not clobber one.
- **Pages source must be set once, by hand.** Repo Settings → Pages → Source = **GitHub Actions**.
  It cannot be scripted. Without it the deploy job fails at the end of an otherwise perfect run.
- **`dist/` is gitignored and stays that way.** CI builds it. Committing it deploys nothing extra and
  guarantees drift.

### Escape hatch

`release.yml` also listens on pushed tags directly, so if the automation is in your way:

```
git tag v0.2.1 && git push --tags
```

That deploys and releases with no `package.json` diff involved.

## Where the rest is written down

| Want | Read |
| --- | --- |
| How the app is built, why it is shaped that way, what every UI word means | `architecture.md` |
| What is done, what is open | `status.md` |
| What each release intended | `prompts/` |
| Rules an AI agent works under here | `AGENTS.md` |
