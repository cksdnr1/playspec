# Implementation Plan

## Ordered Steps

1. Add `UnsafeTaskIdError` to `src/core/errors.ts`.
   - Message: `Unsafe task ID: <taskId>`.
   - Hint: tell users to run `playspec list-tasks` and select an active task with `playspec use <TASK_ID>`.

2. Add `src/utils/task-id.ts`.
   - Export `TASK_ID_PATTERN = /^[a-z0-9_]+$/`.
   - Export `isSafeTaskId(taskId: string): boolean`.
   - Export `assertSafeTaskId(taskId: string): void`, throwing `UnsafeTaskIdError`.

3. Guard active and archived storage path construction in `src/storage/yaml-task-store.ts`.
   - Call `assertSafeTaskId()` at the start of `taskYamlPath()`.
   - Call `assertSafeTaskId()` at the start of `archivedTaskYamlPath()`.
   - Call `assertSafeTaskId()` at the start of `archiveCompletedTask()` before `getTask()`, `getActiveTaskRoot()`, or `getArchivedTaskRoot()`.
   - Leave listing behavior intact; unsafe directory entries remain skipped by existing catch blocks.

4. Guard HEAD and explicit resolver input in `src/core/active-task-resolver.ts`.
   - For explicit `resolveTask(taskId)`, validate before `taskStore.getTask(taskId)`.
   - For HEAD content, trim first, keep existing empty HEAD behavior, then validate before `taskStore.getTask(resolvedId)`.

5. Add CLI tests in `tests/cli.test.ts`.
   - Unsafe HEAD content on a HEAD-based command such as `current-task` fails with `Unsafe task ID` and the recovery hint.
   - `playspec use ../outside` fails with `Unsafe task ID` and does not read the traversal target.
   - Existing valid `use`, `current-task`, and list behavior should remain covered by existing tests.

6. Add storage-level tests in `tests/integration/task-store.test.ts`.
   - `store.getTask('../outside')` rejects with `UnsafeTaskIdError` even if a traversal-shaped file exists outside the active task root.
   - `store.getArchivedTask('../outside')` rejects with `UnsafeTaskIdError` even if a traversal-shaped archived file exists outside the archived task root.

## Files to Edit

- `src/core/errors.ts`
- `src/utils/task-id.ts`
- `src/storage/yaml-task-store.ts`
- `src/core/active-task-resolver.ts`
- `tests/cli.test.ts`
- `tests/integration/task-store.test.ts`

## Tests to Run

- `pnpm test -- tests/integration/task-store.test.ts tests/integration/active-task-resolver.test.ts`
- `pnpm test -- tests/cli.test.ts`
- `pnpm build`
- `pnpm test`

## Old Paths and Bypasses to Close

- HEAD-based `ActiveTaskResolver.resolveTask()` must no longer pass unsafe HEAD content to storage.
- Direct `playspec use <taskId>` must fail through the store guard before any path-like read can occur.
- Active and archived store path helpers must reject unsafe IDs before `path.join()` sees caller input.

## Risks

- Manually created task directories using non-generated IDs such as dashes or dots will become inaccessible through guarded lifecycle APIs. This is accepted by issue scope because generated IDs continue to use lowercase/number/underscore slugs.

## Rollback Notes

The change is small and isolated. Reverting the new utility, error class, call sites, and tests restores prior behavior.

## Completion Criteria

- Unsafe HEAD and explicit `use` inputs produce actionable errors.
- Active and archived store lookups reject traversal-style IDs before constructing storage paths.
- Valid generated task IDs continue passing existing lifecycle tests.
- Build and test commands listed above pass.
