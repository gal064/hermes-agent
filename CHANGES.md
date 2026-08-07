# Local Changes

This file lists only behavior this branch carries beyond `upstream`. Keep it short. When upstream ships an equivalent, remove the local implementation and delete the entry.

## Fork maintenance

- `.claude/skills/update-from-upstream/SKILL.md` defines upstream reconciliation, whole-range fork-delta auditing, `CHANGES.md` maintenance, managed-checkout setup, and signed local-Mac installation/verification. It must stay aligned with changes to the updater or deployment topology and has no runtime deploy surface.

## Active

### Desktop dictation shortcut and automatic send

- **Behavior:** `Cmd+E` starts or stops desktop voice dictation. After recording stops, Desktop waits for transcription and automatically sends the resulting text through the normal composer flow.
- **Reason:** Dictation previously required clicking the microphone and left the transcript in the draft instead of sending it.
- **Surface:** Desktop only; the existing server transcription endpoint is unchanged.
- **Key files:** `apps/desktop/src/lib/keybinds/actions.ts`, `apps/desktop/src/app/hooks/use-keybinds.ts`, and `apps/desktop/src/app/chat/composer/`.
- **Tests:** Shortcut routing, tooltip discovery, and delayed-transcription behavior are covered by focused desktop tests.
- **Upstream status:** Not present in the currently fetched `upstream/main` at `b3aa561fa`.
- **Remove when:** Upstream provides both a desktop dictation shortcut and automatic submission after transcription completes.
