# Local Changes

This file lists only behavior this branch carries beyond `upstream`. Keep it short. When upstream ships an equivalent, remove the local implementation and delete the entry.

## Fork maintenance

- `.claude/skills/update-from-upstream/SKILL.md` defines upstream reconciliation, whole-range fork-delta auditing, `CHANGES.md` maintenance, automatic reviewed-branch pushes, and a required quit/rebuild/install/verify cycle for the local Mac Desktop app only. It never deploys a server without a separate explicit request, must stay aligned with updater or deployment-topology changes, and has no runtime deploy surface.

## Active

### Desktop file explorer shows gitignored files

- **Behavior:** The Desktop project file explorer shows ordinary files and directories even when they match a repository `.gitignore`. It continues to hide the fixed VCS, dependency, environment, build, cache, and OS-noise set, including `.git`, `node_modules`, `.venv`, `venv`, `dist`, and `build`.
- **Reason:** Git ignore rules describe version-control intent, not whether a file is useful to inspect or edit from the project explorer.
- **Surface:** Desktop only; local Electron and remote-server directory listings retain their existing fixed-noise filtering, and server behavior is unchanged.
- **Key files:** `apps/desktop/src/app/right-sidebar/files/ipc.ts`, `apps/desktop/src/app/right-sidebar/files/use-project-tree.ts`, and Desktop dependency metadata.
- **Tests:** Focused Desktop file-tree tests prove ordinary dotfiles and generated files remain visible while the fixed exclusion set stays hidden.
- **Upstream status:** Not present in the currently fetched `upstream/main` at `93ed11379b`; upstream still filters listings through `.gitignore` in `apps/desktop/src/app/right-sidebar/files/ipc.ts`.
- **Remove when:** Upstream makes `.gitignore` independent from Desktop project-explorer visibility while preserving fixed-noise exclusions.

### Desktop dictation shortcut and automatic send

- **Behavior:** `Cmd+E` starts or stops desktop voice dictation. After recording stops, Desktop waits for transcription and automatically sends the resulting text through the normal composer flow. The target session is pinned when the microphone opens, so switching tabs at any point in the dictation's life — while still speaking, or while transcription is in flight — still sends from the session where dictation started, merged with that session's own draft.
- **Reason:** Dictation previously required clicking the microphone and left the transcript in the draft instead of sending it.
- **Surface:** Desktop only; the existing server transcription endpoint is unchanged.
- **Key files:** `apps/desktop/src/lib/keybinds/actions.ts`, `apps/desktop/src/app/hooks/use-keybinds.ts`, and `apps/desktop/src/app/chat/composer/`.
- **Tests:** Shortcut routing, tooltip discovery, delayed transcription, mic-open target pinning across a mid-recording session switch, background-session targeting, and cross-session draft restoration are covered by focused desktop tests.
- **Upstream status:** Not present in the currently fetched `upstream/main` at `93ed11379b`; upstream has no `composer.dictation` keybind — only `composer.voice` (`ctrl+b` on macOS) — and its push-to-talk still routes the transcript into the draft via `insertText`.
- **Remove when:** Upstream provides both a desktop dictation shortcut and automatic submission after transcription completes.
