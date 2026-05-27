Fixes #232

## Summary

- Rejects `playspec migrate` when the resolved HEAD or explicit `--task` target is completed/inactive.
- Uses the existing `TaskNotActiveError` message so completed-task safety language stays consistent across lifecycle commands.
- Adds CLI regressions proving completed migrate targets do not write migration plan/report artifacts or mutate task YAML.

## Why This PR

`playspec migrate` resolved a task and continued into plan loading or plan generation without first checking that the task was active. Completed tasks can still reside under `.playspec/tasks/active`, so a completed HEAD or explicit task id could enter migration paths that write artifacts or mutate task/project files.

## Problem

The runner had a defensive guard for non-dry-run task mutation actions, but the CLI entry point still accepted inactive tasks long enough to load/generate plans and to run dry-run paths. That left a lifecycle safety gap compared with commands such as `next`, `prompt`, `add-context`, `rewind`, and `use`.

## How It Was Fixed

- `src/cli/commands/migrate.ts`: imports `TaskNotActiveError` and checks `task.status` immediately after `ActiveTaskResolver.resolveTask(options.task)`.
- `tests/cli.test.ts`: adds HEAD-based and explicit `--task` completed-task migrate tests using dry-run plans.
- `tests/cli.test.ts`: asserts task YAML is unchanged and no `.playspec/migrations/plans` or `.playspec/migrations/reports` artifacts are written on rejection.

## Tests Run

- `pnpm test -- tests/cli.test.ts` passed: 196 tests.
- `pnpm test` passed: 607 tests across 30 files.
- `pnpm build` passed.
- Skipped checks: none.

## PlaySpec Task ID

- `issue_232_migrate_completed_task_guard`

## Changed Files

- `src/cli/commands/migrate.ts`
- `tests/cli.test.ts`
- `docs/features/issue_232_migrate_completed_task_guard/spec.md`
- `docs/features/issue_232_migrate_completed_task_guard/plan.md`
- `docs/features/issue_232_migrate_completed_task_guard/result.md`
- `docs/features/issue_232_migrate_completed_task_guard/pr.md`

## Risk Notes

- Risk is low. Active-task migration behavior is unchanged, and the existing runner-level guard remains as defense in depth.
- No follow-up required for this issue.
