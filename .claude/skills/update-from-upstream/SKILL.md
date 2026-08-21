---
name: update-from-upstream
description: Update the current Hermes fork branch from Nous Research upstream, remove fork changes upstream now provides, maintain CHANGES.md, push the reviewed branch, and rebuild, install, and verify Hermes Desktop locally on this Mac.
---

# Update from upstream

Keep the fork current and as small as possible. Reconcile upstream, `CHANGES.md`, and the local Mac installation as one workflow.

Invoking this skill authorizes its normal end-to-end workflow: commit every reviewed task-owned change, push the current branch to the user's fork, update the managed checkout, quit Hermes when it is running, rebuild and replace its local Desktop bundle, relaunch it, and verify the deployment. If the user explicitly limits the scope, honor that limit. Never discard dirty work, force-push, change remotes, or touch a remote server without separate approval. Stay on the current branch unless asked otherwise.

## Completion contract

Unless the user explicitly opts out of a step, a successful run is not complete until the skill has performed all of the following itself:

1. committed every reviewed task-owned source, test, `CHANGES.md`, and skill update;
2. pushed the resulting current-branch commit to the same-name branch on `origin` without force;
3. fast-forwarded the managed checkout to that exact pushed commit;
4. quit a running Hermes Desktop before rebuilding or replacing its live bundle;
5. rebuilt and installed the local macOS Desktop app from the managed checkout;
6. relaunched the exact installed bundle and verified its process path, clean install stamp, signature, and prior connection mode.

Do not stop after merging, testing, committing, pushing, or building. Do not hand the user commands to finish the normal workflow. Finish the local installation and verification so the user has nothing else to do. A failed required check or an unsafe/ambiguous conflict is a blocker; do not push or deploy through it.

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

Merge the fetched upstream default branch into the current branch by default. Ask before rebasing, force-pushing, or choosing between behaviorally different conflict resolutions. After validation, commit every reviewed task-owned change, including `CHANGES.md` and this skill when either changed, then push the current branch to its same-name branch on `origin`; never force-push.

`CHANGES.md` contains only active differences from upstream. Every entry must concisely state:

- behavior and reason;
- deploy surface: `Desktop`, `Server`, `Both`, or no runtime surface;
- key files and focused tests;
- upstream status and removal condition.

Delete an entry when its local implementation is removed because upstream is equivalent. Add newly discovered fork-only behavior. The final report must say which fork changes landed upstream, including `none found` when applicable.

Whenever source changes alter updating, building, signing, installation paths, backend resolution, or deployment topology, update this skill in the same change. Verify commands against current code rather than copying stale instructions.

## 4. Validate

### Align on validation scope

At the start of a merge, tell the user that validation is **fast and focused by default** and invite them to opt into broader testing. Unless the user explicitly requests otherwise, proceed with the focused scope without blocking on an answer. The available scopes are:

- **Focused (default):** test merge-conflict resolutions, retained fork behavior touched by the incoming range, and the direct integration seams affected by those resolutions.
- **Broader:** add the relevant subsystem suite when the user requests it or focused results reveal credible cross-cutting risk.
- **Full:** run the repository-wide suite only when the user explicitly requests it.

Assume unchanged upstream code was tested upstream. Do not rerun broad renderer, Electron, Python, or repository-wide suites merely because the upstream merge is large. Before escalating from focused validation to a broader suite, explain the concrete risk or failure that justifies it and align with the user.

### Focused merge validation

Choose the smallest checks that can catch mistakes introduced locally by the merge:

1. Run the regression tests named by each retained `CHANGES.md` entry whose behavior or files were touched.
2. Test every conflict resolution at its behavioral boundary, including sibling call paths when the resolution changes shared code.
3. Run the narrow typecheck, lint, build, or packaging command required by the affected surface.
4. Do not test incoming upstream-only files unless a local conflict, fork delta, or observed failure creates a specific integration risk.

Treat failures in changed paths as real until proven otherwise; report unrelated baseline failures separately. A stopped or intentionally skipped full suite is not a merge failure when the agreed focused checks pass.

For Desktop conflicts or touched fork behavior, refresh the locked JavaScript dependencies with `npm ci` at the repository root when dependency manifests changed or before classifying missing-module or missing-export errors as baseline. The packaging command performs the same deterministic install. Do not run the complete renderer or Electron test suite by default; select the affected test files and the narrowest applicable typecheck/build command.

The current updater records a content hash in `$HERMES_HOME/desktop-build-stamp.json` and skips the Desktop subprocess when the packaged artifact already matches. Use `--force-build` for authoring proof so a stale or accidentally shared stamp cannot turn the required package check into a no-op.

Before pushing a Desktop change, prove the authoring worktree packages successfully:

```bash
uv run --no-sync ./hermes desktop --build-only --force-build
```

This dirty-worktree artifact is build proof only, not the durable install. After tests and packaging pass, commit all and only the reviewed task-owned files and verify that no task-owned change remains uncommitted. Preserve and leave unstaged any unrelated dirty work; report that it prevented a globally clean worktree. Verify that `origin` is the user's fork and the authenticated GitHub viewer has write access, then push the current branch to the same-name branch on `origin` without force. Do not leave the commit or push for the user.

Do not deploy a build that failed its required checks. Before a durable managed-checkout deployment, the tested commit must be available to that checkout.

## 5. Deploy surface

In this skill, **deploy always means the local macOS Desktop app only**: build and install the Electron app on this Mac. Never update a connected remote backend or any server as part of this workflow. Server deployment is out of scope and requires a separate, explicit request.

The current Desktop can connect to a remote backend. Its connection mode does not expand deployment beyond the local app.

## 6. Install Hermes Desktop on this Mac

The skill invocation authorizes changing the managed checkout, quitting Hermes, and replacing the running app as part of the local Desktop deployment. Before quitting, tell the user that the active session may disconnect and state that work will continue through the deployment handoff. Do not leave the old process running while rebuilding or replacing its live bundle.

On macOS, the local-client leg of in-app Update no longer runs inside the app. Desktop spawns the repo-owned hand-off `scripts/desktop-update/posix.sh` detached and quits; the script waits for the Electron process to exit, runs `hermes update --yes --gateway --keep-stash --branch <branch>` from the install root when the installed updater supports `--keep-stash`, transactionally swaps the rebuilt bundle into the running `.app` with `/usr/bin/ditto`, and reopens it. Because the script lives in the checkout, each update refreshes the code driving the next one. The full in-app Update affordance may also fan out to connected remote backends and other registered gateways before updating the local client. This skill does not invoke that multi-target UI flow: its authorized deploy scope remains the reviewed local macOS Desktop app only. The local hand-off automation is safe for this fork only after the managed checkout has the fork as `origin`, Nous as `upstream`, and the intended branch checked out; otherwise use the reviewed manual flow below.

### Preferred durable install

1. Require a clean managed checkout. Fetch the fork, switch to the same branch, and fast-forward it from `origin`:

   ```bash
   git -C ~/.hermes/hermes-agent fetch origin --prune
   git -C ~/.hermes/hermes-agent switch <branch>
   git -C ~/.hermes/hermes-agent pull --ff-only origin <branch>
   ```

2. Quit Hermes before rebuilding its live bundle. If the current agent session is hosted by Hermes, warn that quitting may disconnect the session, state the handoff, and then proceed; invoking this skill already authorizes the quit.
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

Every local Desktop deployment must end by launching the exact rebuilt bundle and proving that it is the current managed-checkout version. A successful build alone is not a completed deployment. If the managed checkout advances after a build—even for documentation or skill-only follow-up commits—and the user asks for the Desktop to be fully up to date, rebuild so the packaged install stamp matches managed `HEAD`.

Clear only the quarantine attribute if present, register the final bundle with LaunchServices when its path changed, and open that exact bundle. Always verify:

- the running executable path is the intended fork-built bundle;
- `Contents/Resources/install-stamp.json` matches the deployed branch and the current managed-checkout `HEAD`;
- strict code-sign verification still passes after installation;
- the app connects in its prior local/remote mode;
- focused UI behavior and a native test notification work.

Do not use Computer Use for QA unless the user explicitly requests Computer Use QA. By default, rely on automated checks and ask the user to confirm live UI behavior or notifications when direct verification would require Computer Use.

Do not request new Accessibility, Screen Recording, Automation, or microphone permission solely to automate verification. Prefer existing tests plus user-confirmed live behavior when UI inspection lacks permission.

Remove any temporary staging or backup bundle only after verification.

## 7. Report

Report: upstream integrated; fork entries removed, reduced, or retained; tests and baseline failures; `CHANGES.md` and skill updates; authoring and managed checkout branch/commit; deployed app path and install stamp; signing identifier/requirement and verification; connection mode; notification test; and anything intentionally not deployed.
