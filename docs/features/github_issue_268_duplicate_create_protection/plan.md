# GitHub Issue 268 Implementation Plan

## Ordered Steps

1. Add regression tests first in `tests/cli.test.ts`.
   - CLI test: initialize workspace, create an initial task with `--stdin` and `--var ORIGINAL=value`, record `task.yaml`, `memory.yaml`, source content, and HEAD.
   - Create a second distinct task so HEAD changes away from the duplicate target.
   - Attempt to create the original title again with `--stdin` and `--var ORIGINAL=replaced`.
   - Assert non-zero exit, duplicate-task error text, original files unchanged, original variables not replaced, and HEAD unchanged.
   - Assert creating a different title still succeeds and selects that new task as HEAD.
   - Storage test: call `YamlTaskStore.createTask` twice with the same `id`, expect the second call to reject, and assert original serialized `task.yaml` and `memory.yaml` are unchanged.

2. Add a typed error in `src/core/errors.ts`.
   - Name: `TaskAlreadyExistsError`.
   - Message should include the duplicate task ID.
   - Hint should tell the user to choose a different title or inspect existing tasks with `playspec list-tasks`.

3. Add the storage guard in `src/storage/yaml-task-store.ts`.
   - Import `TaskAlreadyExistsError`.
   - Before constructing task state or calling any `mkdir`/write helper, compute `absoluteTaskRoot = getActiveTaskRoot(...)`.
   - Check whether `absoluteTaskRoot` exists via `access`.
   - If it exists, throw `TaskAlreadyExistsError`.
   - If it does not exist, continue with current successful creation behavior unchanged.

4. Run focused tests, then full validation.
   - Focused: `pnpm test -- tests/cli.test.ts`.
   - Full: `pnpm build` and `pnpm test`.

## Files To Edit

- `src/core/errors.ts`
- `src/storage/yaml-task-store.ts`
- `tests/cli.test.ts`

## Active Paths And Bypasses Closed

- CLI normal create path is closed because it calls `YamlTaskStore.createTask` before source and HEAD writes.
- Interactive create is closed because it also calls `createNormalTask`.
- Phase-execution create is closed because it calls `YamlTaskStore.createTask` directly.
- Direct storage callers are closed because the guard is in `YamlTaskStore.createTask`.

## Risks

- The check is pre-write protection, not a full concurrent exclusive creation lock. That matches the issue scope.
- Scripts that reused duplicate `playspec create` as a reset mechanism will now fail intentionally.

## Rollback Notes

Rollback is limited to reverting the three code/test files and the PlaySpec docs/task artifacts from this branch. No destructive git operations are needed.

## Completion Criteria

- Duplicate active task creation exits non-zero through the CLI.
- Duplicate attempt does not mutate existing `task.yaml`, `memory.yaml`, source file, variables, lifecycle fields, updated timestamp, or HEAD.
- Direct duplicate `YamlTaskStore.createTask` rejects before storage writes.
- Creating a different title still succeeds and sets HEAD.
- Focused and full repository validation pass.
