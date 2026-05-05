# List Tasks Uninitialized Hint Plan

## Goal

Make `playspec list-tasks` distinguish an uninitialized workspace from an initialized workspace with zero active tasks.

## Ordered Steps

1. Add a workspace initialization check to `runListTasks()`.
   - Import `access` from `node:fs/promises`.
   - Import `WorkspaceNotInitializedError` from `#core/errors.js`.
   - Import `getPlayspecRoot` from `#utils/paths.js`.
   - Before constructing or using task listing behavior, check that `.playspec` exists.
   - If it does not exist, throw `WorkspaceNotInitializedError`.

2. Add CLI regression coverage.
   - In `tests/cli.test.ts`, add a test that runs `list-tasks` from a fresh temporary workspace before initialization.
   - Assert non-zero exit.
   - Assert stderr contains `Workspace not initialized at:`.
   - Assert stderr contains `playspec init --preset default`.

3. Preserve initialized empty-state behavior.
   - Add or reuse coverage proving that after default init, `list-tasks` exits zero and prints `No active tasks.`

4. Validate.
   - Run targeted CLI tests.
   - Run build.
   - Run full test suite if targeted checks pass.
   - Run a direct smoke command from a temporary uninitialized directory.

## Files To Edit

- `src/cli/commands/list-tasks.ts`
- `tests/cli.test.ts`
- `docs/features/list_tasks_uninitialized_hint/result.md`
- `docs/features/list_tasks_uninitialized_hint/pr.md`

## Non-Goals

- Do not modify `YamlTaskStore.listActiveTasks()`, because tolerant list behavior may be useful for internal callers and archive/completed list paths.
- Do not alter deprecated `playspec list` directly; it delegates to `list-tasks` and should inherit the corrected behavior.
- Do not touch task-link commands or task-link tests.

## Quality Gate

Plan score: 97/100.

The plan is localized, user-visible, testable through the CLI, and avoids broad storage behavior changes.

