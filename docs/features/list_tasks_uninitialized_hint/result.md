# List Tasks Uninitialized Hint Result

## Implemented

- `playspec list-tasks` now checks whether `.playspec` exists before listing active tasks.
- Uninitialized workspaces now fail with the existing `WorkspaceNotInitializedError` and init recovery hint.
- Initialized workspaces with no active tasks still print `No active tasks.` and exit successfully.
- `YamlTaskStore.listActiveTasks()` remains unchanged, so internal tolerant missing-directory behavior is preserved.

## Files Changed

- `src/cli/commands/list-tasks.ts`
- `tests/cli.test.ts`
- `docs/features/list_tasks_uninitialized_hint/spec.md`
- `docs/features/list_tasks_uninitialized_hint/plan.md`
- `docs/features/list_tasks_uninitialized_hint/result.md`
- `docs/features/list_tasks_uninitialized_hint/pr.md`

## Verification

- `pnpm exec vitest run tests/cli.test.ts`: passed, 150 tests.
- `pnpm exec vitest run tests/cli.test.ts -t "list-tasks"`: passed, 6 matching tests.
- `pnpm build`: passed.
- `pnpm test`: passed, 23 files / 388 tests.
- Direct smoke from a fresh temporary directory:
  - Command: `playspec list-tasks`
  - Exit: 1
  - Output includes `Workspace not initialized at:` and `playspec init --preset default`.

## Reviews

- `spec_verifier`: PASS, all acceptance criteria covered.
- `refactor_guard`: allowed, no scope drift.
- `build_validator`: passed `pnpm build` and targeted `list-tasks` tests.

## Quality Gate

Final implementation score: 98/100.

The slice is user-visible, minimal, tested through the actual CLI path, and constrained to the requested behavior.
