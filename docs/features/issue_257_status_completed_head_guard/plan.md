# Implementation Plan

## Ordered Steps

1. Update `src/cli/commands/status.ts`.
   - Import `TaskNotActiveError` from `#core/errors.js`.
   - Preserve the existing explicit lookup path for `taskIdOption`.
   - After resolving the task, check `if (!taskIdOption && task.status !== 'active')`.
   - Throw `new TaskNotActiveError(task.id, task.status)` before `loadActiveAndCompletedTasks()` and before any output.

2. Update `tests/cli.test.ts` near the existing status command tests.
   - Add a completed-HEAD regression for `playspec status`.
   - Add a completed-HEAD regression for `playspec status --quiet`.
   - Assert non-zero exit, empty stdout, and the standard non-active-task error/hint.
   - Assert stale task detail such as `ID:` and stale guidance such as `Suggested next:` are absent from stdout.
   - Add an explicit completed-task inspection test if current behavior supports it, documenting that only default HEAD status is active lifecycle context.

3. Run focused tests.
   - `pnpm vitest run tests/cli.test.ts --runInBand` or the closest supported focused Vitest invocation.

4. Run repository validation.
   - `pnpm build`
   - `pnpm test`

## Files To Edit

- `src/cli/commands/status.ts`
- `tests/cli.test.ts`

## Tests To Add Or Update

- Completed HEAD rejected by `playspec status`.
- Completed HEAD rejected by `playspec status --quiet`.
- Explicit completed status inspection remains supported if unchanged by the implementation.
- Existing active status and quiet status tests should continue to pass unchanged.

## Entry Point To User-Visible Chain

Default HEAD status:

`playspec status` -> `runStatus()` -> `ActiveTaskResolver.resolveTask()` -> HEAD task record -> active-status guard -> `TaskNotActiveError` -> CLI error handler prints standard error and hint -> no status detail or suggested-next output.

Explicit inspection:

`playspec status <taskId>` or `playspec status --task <id>` -> `TaskIdResolver`/`store.getTask()` -> existing status rendering.

## Old Paths And Bypasses

- Old path closed: completed HEAD reaching status rendering.
- Bypass preserved: explicit task id inspection.
- Partial migration risk: guard must be placed before `loadActiveAndCompletedTasks()` and all `console.log()` calls so both normal and quiet status reject identically.

## Risks

- Compatibility: bare `status` after completion changes from inspection to rejection. This is intended by issue #257.
- Error wording: use existing `TaskNotActiveError` to avoid introducing a second lifecycle message.

## Rollback Notes

Revert the import, guard, and new tests. No storage format, migration, archive, or workflow metadata changes are required.

## Completion Criteria

- `playspec status` with completed HEAD exits non-zero with `TaskNotActiveError` and no stdout.
- `playspec status --quiet` with completed HEAD behaves the same way.
- Active status output remains unchanged.
- Explicit completed task inspection remains unchanged and documented by test if supported.
- Focused and full validations pass.
