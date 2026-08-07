---
name: update-from-upstream
description: Update the current Hermes fork branch from Nous Research upstream, remove fork changes upstream now provides, maintain CHANGES.md, and optionally build, sign, install, and verify Hermes Desktop on this Mac.
---

# Update from upstream

Keep the fork current and as small as possible. Reconcile upstream, `CHANGES.md`, and the local Mac installation as one workflow.

Never discard dirty work, push, change remotes, quit Hermes, replace an app, or touch a remote server without the user's approval. Stay on the current branch unless asked otherwise.

## 1. Preflight and topology

Read `AGENTS.md`, this skill, `CHANGES.md`, and the relevant nested `AGENTS.md`. Then inspect:

```bash
git status --short --branch
git branch --show-current
git remote -v
git log -1 --oneline
```

- The authoring checkout should use the user's fork as `origin` and `https://github.com/NousResearch/hermes-agent.git` as `upstream`.
- Preserve every dirty file. Ask before rebasing published commits or resolving an ambiguous conflict.
- Read `~/Library/Application Support/Hermes/connection.json` only to identify `local` versus `remote`; do not expose credentials or URLs in the report.
- Discover the running bundle from macOS process/LaunchServices state. Do not assume `/Applications/Hermes.app`.

On this Mac, the normal managed root is `~/.hermes/hermes-agent`, and its packaged app is normally under `apps/desktop/release/mac-arm64/Hermes.app`. It is a separate checkout, not the authoring worktree.

### One-time managed-checkout setup

For durable fork deployments and in-app updates, the managed checkout must also pull the fork as `origin` and Nous as `upstream`. If it still tracks Nous as `origin`, ask before changing it:

```bash
git -C ~/.hermes/hermes-agent remote set-url origin <fork-url>
git -C ~/.hermes/hermes-agent remote add upstream https://github.com/NousResearch/hermes-agent.git
```

If `upstream` already exists, verify or set its URL instead of adding it. Never symlink the managed root to the authoring worktree: `hermes update` mutates the managed checkout.

## 2. Fetch and audit the fork delta

Fetch `upstream` with tags and pruning, resolve its default branch, and inspect the complete incoming range—not only named PRs or release notes.

For every active `CHANGES.md` entry:

1. Read its behavior, reason, surface, files, tests, and removal condition.
2. Inspect incoming upstream code and the full range for an equivalent or differently shaped implementation.
3. Treat PR state as supporting evidence only; shipped code and behavior are authoritative.
4. If equivalence is uncertain, temporarily remove the fork implementation and run its regression tests against upstream behavior.
5. Remove redundant local code and fork-only tests only when upstream fully satisfies the behavior. Record partial coverage and retain only the remaining gap.

## 3. Integrate and maintain `CHANGES.md`

Merge the fetched upstream default branch into the current branch by default. Ask before rebasing, force-pushing, or choosing between behaviorally different conflict resolutions. Never push unless explicitly asked.

`CHANGES.md` contains only active differences from upstream. Every entry must concisely state:

- behavior and reason;
- deploy surface: `Desktop`, `Server`, `Both`, or no runtime surface;
- key files and focused tests;
- upstream status and removal condition.

Delete an entry when its local implementation is removed because upstream is equivalent. Add newly discovered fork-only behavior. The final report must say which fork changes landed upstream, including `none found` when applicable.

Whenever source changes alter updating, building, signing, installation paths, backend resolution, or deployment topology, update this skill in the same change. Verify commands against current code rather than copying stale instructions.

## 4. Validate

Run focused tests for every retained fork change, then the appropriate broader checks. Treat failures in changed paths as real until proven otherwise; report unrelated baseline failures separately.

Do not deploy a build that failed its required checks. Before a durable managed-checkout deployment, the tested branch must be committed and available to that checkout; ask before committing or pushing.

## 5. Decide the deploy surface

- `Desktop`: build and install the Electron app only. Do not update the remote backend.
- `Server`: no desktop rebuild is required. Remote-server deployment is currently out of scope; ask before adding or executing one.
- `Both`: install Desktop locally, then stop and ask for explicit remote-server instructions.

The current Desktop can connect to a remote backend. That does not make a renderer-only change a server deployment.

## 6. Install Hermes Desktop on this Mac

Ask before changing the managed checkout, quitting Hermes, or replacing the running app.

### Preferred durable install

1. Require a clean managed checkout. Fetch the fork, switch to the same branch, and fast-forward it from `origin`:

   ```bash
   git -C ~/.hermes/hermes-agent fetch origin --prune
   git -C ~/.hermes/hermes-agent switch <branch>
   git -C ~/.hermes/hermes-agent pull --ff-only origin <branch>
   ```

2. Quit Hermes before rebuilding its live bundle. If the current agent session is hosted by Hermes, warn that quitting may disconnect the session and agree on the handoff first.
3. Build from the managed root so the app, backend/update root, and future in-app updates all resolve to the fork. Use the managed virtual environment (`.venv` first, then `venv`); do not invoke the root `./hermes` script with an arbitrary system Python:

   ```bash
   ~/.hermes/hermes-agent/.venv/bin/hermes desktop --build-only --force-build
   ```

   If `.venv/bin/hermes` is absent, use `~/.hermes/hermes-agent/venv/bin/hermes`.

4. Resolve the produced host-architecture bundle under `~/.hermes/hermes-agent/apps/desktop/release/`. In this layout the build output is the installed app; do not copy it to `/Applications` unless discovery shows `/Applications/Hermes.app` is the actual launch target.

If the real target is a separate bundle, copy with `/usr/bin/ditto` to a sibling staging bundle, atomically swap it into place, and retain the displaced bundle only until the new app is verified.

### Signing and notification verification

The build command performs Hermes's macOS signing fixup. Do not run a generic `codesign --deep --force` afterward; it can replace nested signatures or entitlements.

Verify before launch:

```bash
codesign --verify --deep --strict <Hermes.app>
codesign -dv --verbose=4 <Hermes.app>
codesign -d -r- <Hermes.app>
codesign -d --entitlements :- <Hermes.app>
plutil -p <Hermes.app>/Contents/Info.plist
```

Require bundle identifier `com.nousresearch.hermes`, a valid strict signature, a stable designated requirement, and the microphone/JIT entitlements. A configured `desktop.macos_signing_identity` must resolve to a valid keychain identity; otherwise Hermes intentionally uses stable identifier-pinned ad-hoc signing for local builds.

Hermes native notifications work while the app is running or backgrounded. Signing preserves their macOS identity, but does not create APNs push while the app is fully quit; that would require Apple push entitlements and server support not currently present.

### Launch and verify

Clear only the quarantine attribute if present, register the final bundle with LaunchServices when its path changed, and open that exact bundle. Verify:

- the running executable path is the intended fork-built bundle;
- `Contents/Resources/install-stamp.json` matches the deployed branch/commit;
- strict code-sign verification still passes after installation;
- the app connects in its prior local/remote mode;
- focused UI behavior and a native test notification work.

Remove any temporary staging or backup bundle only after verification.

## 7. Report

Report: upstream integrated; fork entries removed, reduced, or retained; tests and baseline failures; `CHANGES.md` and skill updates; authoring and managed checkout branch/commit; deployed app path and install stamp; signing identifier/requirement and verification; connection mode; notification test; and anything intentionally not deployed.
