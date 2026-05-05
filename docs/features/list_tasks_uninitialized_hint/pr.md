# List Tasks Uninitialized Hint PR

## Title

Fix list-tasks init guidance for uninitialized workspaces

## PR

https://github.com/cksdnr1/playspec/pull/87

## Body

## Summary

This continuous-improvement mono-spec fixes a first-run CLI usability bug. When a user runs `playspec list-tasks` before `playspec init`, PlaySpec currently says `No active tasks.`, which is misleading because the workspace is not initialized.

The command now reuses the existing `WorkspaceNotInitializedError`, so the user sees the actionable recovery hint:

```text
Run `playspec init --preset default` to initialize the workspace.
```

## Use Case

A new user checking for existing work in a fresh directory should be guided to initialize PlaySpec, not told that an uninitialized workspace is an empty initialized workspace.

## Changes

- Add a `.playspec` existence check in `runListTasks()`.
- Keep initialized empty-list behavior unchanged.
- Add CLI regression coverage for both the uninitialized and initialized-empty paths.
- Add mono-spec docs under `docs/features/list_tasks_uninitialized_hint/`.

## Validation

- `pnpm exec vitest run tests/cli.test.ts`: passed, 150 tests.
- `pnpm exec vitest run tests/cli.test.ts -t "list-tasks"`: passed, 6 matching tests.
- `pnpm build`: passed.
- `pnpm test`: passed, 23 files / 388 tests.
- Direct smoke from a fresh temporary directory confirms `playspec list-tasks` exits 1 with the init hint.

## Review

- `spec_verifier`: PASS.
- `refactor_guard`: allowed.
- `build_validator`: passed.
