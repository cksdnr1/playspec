# Implementation Plan

## Ordered Steps

1. Add a runner-level active-task preflight in `src/migration/migration-runner.ts`.
   - Import `TaskNotActiveError` from `#core/errors.js`.
   - Add a local helper that identifies task mutation actions: `update_task_state`, `add_context_ref`, `remove_context_ref`.
   - In `MigrationRunner.run()`, after schema validation and archive flag validation, but before saving the plan, call the guard when `plan.mode !== 'dry-run'` and any action mutates the target task.
   - The guard loads `plan.targetTaskId` through `taskStore.getTask()` and throws `TaskNotActiveError(task.id, task.status)` if the status is not `active`.

2. Add migration runner regression tests in `tests/integration/migration.test.ts`.
   - Completed task plus auto `add_context_ref` rejects with `TaskNotActiveError` and leaves `task.yaml` unchanged.
   - Completed task plus auto `update_task_state` rejects with `TaskNotActiveError` and leaves `task.yaml` unchanged.
   - Completed task plus dry-run task mutation plan succeeds as skipped report and leaves `task.yaml` unchanged, documenting dry-run as safe.
   - Active-task auto `add_context_ref` test remains unchanged and should still pass.

3. Add CLI regression coverage in `tests/cli.test.ts`.
   - Create a completed task.
   - Write an external migration plan containing a task mutation action.
   - Run `migrate --task <completedTaskId> --plan <planFile> --mode auto`.
   - Assert non-zero exit, deprecation warning remains, error includes `Task "<id>" is not active (status: completed).`, and `task.yaml` is unchanged.

4. Run focused validation.
   - `pnpm test -- tests/integration/migration.test.ts tests/cli.test.ts`
   - `pnpm build`
   - If focused tests expose unrelated broad-suite failures, narrow to the changed test files and report exactly what ran.

5. Complete PlaySpec result artifacts and PR prep.
   - Update `docs/features/issue_217_migrate_rejects_completed_tasks/result.md`.
   - Update `docs/features/issue_217_migrate_rejects_completed_tasks/pr.md`.
   - Complete remaining mono-spec phases with evidence.

## Files To Edit

- `src/migration/migration-runner.ts`
- `tests/integration/migration.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_217_migrate_rejects_completed_tasks/result.md`
- `docs/features/issue_217_migrate_rejects_completed_tasks/pr.md`

## Entry Point To User-Visible Chain

- CLI user runs `playspec migrate --task <id> --plan <file> --mode auto`.
- `runMigrate()` resolves the task and parses the plan.
- `MigrationRunner.run()` validates the plan and checks the completed-task boundary before plan/report persistence and before action application.
- `TaskNotActiveError` propagates to CLI error handling.
- CLI exits non-zero and prints the task ID/status message.
- `task.yaml` remains unchanged.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: direct runner usage could apply task mutation actions without CLI checks. The runner guard closes this.
- Bypass path: external `--plan` files can carry task mutation actions. The runner guard closes this.
- Generated-plan path: `generatePlan()` emits `add_context_ref`; the runner guard closes this in auto/review modes.
- Partial migration risk: a mixed plan with file actions and task mutation actions should reject before applying any action. Guarding before `savePlan()` and before action loops avoids partial mutation and avoids extra artifacts.

## Risks

- Behavior change is intentional for completed tasks in non-dry-run modes.
- Dry-run remains allowed for completed tasks because no mutation helpers are called; tests must make that explicit.
- The guard must not block file-only migration plans unless they include task mutation actions.

## Rollback Notes

Rollback is a normal git revert of the code and tests. No migration data files are part of the implementation. The guard runs before mutation, so failed attempts should not require task YAML repair.

## Completion Criteria

- Completed target task rejects before task mutation in `auto` mode.
- Completed target task rejects for external task mutation plans.
- Rejection message includes task ID and status.
- Active-task migration behavior remains unchanged.
- Dry-run completed-task behavior is covered and safe.
- Focused migration/CLI tests and build pass.
