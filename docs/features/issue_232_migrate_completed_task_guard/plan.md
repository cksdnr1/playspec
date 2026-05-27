# Implementation Plan

## Ordered Steps

1. Add the migrate lifecycle guard.
   - File: `src/cli/commands/migrate.ts`
   - Import `TaskNotActiveError` alongside `WorkspaceNotInitializedError`.
   - Immediately after `const task = await resolver.resolveTask(options.task);`, throw `new TaskNotActiveError(task.id, task.status)` when `task.status !== 'active'`.
   - This closes both HEAD and explicit `--task` paths before plan loading, source discovery, plan generation, runner execution, artifact persistence, backups, or mutations.

2. Add focused CLI regression tests.
   - File: `tests/cli.test.ts`
   - Add a helper assertion for migration artifact absence if it keeps the tests readable.
   - Add a HEAD-based completed-task test using a dry-run external plan. Assert:
     - non-zero exit
     - deprecation warning remains visible
     - `Task "<id>" is not active (status: completed).`
     - task YAML is unchanged
     - no `.playspec/migrations/plans` or `.playspec/migrations/reports` artifacts are written
   - Add an explicit `--task <completed-task>` dry-run external plan test with the same artifact and task YAML assertions.
   - Keep the existing active-task migrate compatibility test unchanged.

3. Run validation.
   - Targeted: `pnpm test -- tests/cli.test.ts`
   - Full test suite: `pnpm test`
   - Build: `pnpm build`

## Files To Edit

- `src/cli/commands/migrate.ts`
- `tests/cli.test.ts`
- `docs/features/issue_232_migrate_completed_task_guard/result.md`
- `docs/features/issue_232_migrate_completed_task_guard/pr.md`

## Behavior Trace

Entry point:

- `playspec migrate` or `playspec migrate --task <id>`

Validation:

- `ActiveTaskResolver.resolveTask()` resolves the task record.
- New CLI guard rejects any status other than `active`.

State/data update:

- For inactive tasks, no task or project data is updated.
- For active tasks, existing migration behavior continues.

Persistence:

- Inactive rejection happens before migration plan/report persistence.
- Existing runner persistence remains unchanged for active tasks.

User-visible behavior:

- Deprecated warning is still printed first.
- Error uses existing `TaskNotActiveError` message and hint.

## Old Paths, Bypasses, Partial Migration Risks

- HEAD bypass: closed by checking the resolved HEAD task.
- Explicit `--task` bypass: closed by checking the resolved explicit task.
- External plan path: closed before `loadExternalPlan()`.
- Generated plan path: closed before source discovery and `generatePlan()`.
- Runner-only partial guard: retained as a defensive layer, but no longer relied on for CLI lifecycle safety.

## Tests To Add Or Update

- Add HEAD completed-task rejection for `migrate`.
- Add explicit completed-task rejection for `migrate --task`.
- Assert no migration plan/report artifacts exist after rejection.
- Assert task YAML remains unchanged, including context refs and state.
- Preserve existing active migrate coverage.

## Risks

- Low: a completed/inactive task is newly rejected earlier. Active-task behavior should not change.
- The deprecation warning currently prints before workspace/task validation; tests should preserve that existing output contract.

## Rollback Notes

Rollback is a single-command guard removal plus the new tests. No migration data format changes are introduced.

## Completion Criteria

- Completed HEAD and explicit `--task` migrate invocations fail before writing migration artifacts.
- Error language matches `TaskNotActiveError`.
- Active-task migrate behavior remains unchanged.
- Targeted CLI tests, full tests, and build pass.
