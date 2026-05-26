# Implementation Result

## Files Changed

- `src/migration/migration-runner.ts`
- `tests/integration/migration.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_217_migrate_rejects_completed_tasks/spec.md`
- `docs/features/issue_217_migrate_rejects_completed_tasks/plan.md`

## Behavior Implemented

- `MigrationRunner.run()` now rejects non-dry-run plans that include task mutation actions when the target task is not active.
- The guarded task mutation actions are `update_task_state`, `add_context_ref`, and `remove_context_ref`.
- The guard runs after migration schema/archive validation and before plan persistence, backups, reports, or action application.
- Rejection uses the existing `TaskNotActiveError`, so CLI output includes the task ID and status.
- Dry-run remains safe for completed tasks and records skipped actions without mutating task YAML.

## Verification Performed

- `pnpm test -- tests/integration/migration.test.ts tests/cli.test.ts`
  - Passed: 2 files, 213 tests.
- `pnpm test -- tests/integration/migration.test.ts`
  - Passed: 1 file, 21 tests after final test cleanup/refactor review.
- `pnpm build`
  - Passed.

## Refactor Review

- Reviewed the working diff against `origin/master`.
- No additional refactor was applied; the implementation is already limited to the runner boundary and focused tests.
- `git diff --check` passed.

## PR Preparation

- Reusable agent guidance: not needed. The implementation follows existing lifecycle errors and migration runner boundaries.
- PR link: https://github.com/cksdnr1/playspec/pull/219

## Remaining Risks

- `playspec migrate` remains deprecated but callable. This change intentionally blocks completed-task task mutations, which may affect users who used migration as after-the-fact annotation.
- File-only migration plans are not blocked by this guard unless they include task mutation actions.
