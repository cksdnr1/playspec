# Implementation Result

## Files Changed

- `src/cli/commands/migrate.ts`
- `tests/cli.test.ts`
- `docs/features/issue_232_migrate_completed_task_guard/spec.md`
- `docs/features/issue_232_migrate_completed_task_guard/plan.md`
- `docs/features/issue_232_migrate_completed_task_guard/result.md`

## Behavior Implemented

- `runMigrate()` now rejects any resolved task whose status is not `active` immediately after `ActiveTaskResolver.resolveTask(options.task)`.
- The rejection uses the existing `TaskNotActiveError` language, including task id and inactive status.
- The guard runs before external plan loading, source discovery, plan generation, runner execution, migration plan/report persistence, backups, or task/project mutations.
- Active-task migrate behavior remains unchanged.

## Tests Added

- HEAD-based completed-task rejection for `playspec migrate`.
- Explicit `--task <completed-task>` rejection for `playspec migrate`.
- Both tests use dry-run migration plans and assert:
  - non-zero exit
  - deprecation warning remains visible
  - `Task "<id>" is not active (status: completed).`
  - task YAML is unchanged
  - no migration plan/report artifacts are written

## Verification Performed

- `pnpm test -- tests/cli.test.ts` passed: 196 tests.
- `pnpm test` passed: 607 tests across 30 files.
- `pnpm build` passed.

## Focused Test Phase Notes

- Focused coverage was added in `tests/cli.test.ts` for both completed-task entry paths required by the issue.
- No test failures remain.
- No validation commands were skipped.

## Safe Refactor Notes

- Reviewed the branch diff against `origin/master`.
- No refactor was applied because the implementation is already a minimal guard plus focused tests.
- Skipped broader cleanup to keep the change limited to migrate lifecycle safety.

## Remaining Risks

- Low. The change rejects inactive migrate targets earlier while preserving the existing runner-level defensive guard and active-task migration behavior.

## PR Preparation Notes

- PR body source written to `docs/features/issue_232_migrate_completed_task_guard/pr.md`.
- Reusable agent guidance: no new guidance needed; this was a narrow lifecycle guard and regression-test change.
- PR link: https://github.com/cksdnr1/playspec/pull/236
