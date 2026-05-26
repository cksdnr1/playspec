# Draft PR

Fixes #217

## Summary

- Add a runner-level active-task guard for migration plans that include task mutation actions.
- Reject completed target tasks before migration plan persistence, backups, reports, or task YAML writes.
- Document dry-run behavior as safe for completed targets because it only records skipped actions.

## Changed Files

- `src/migration/migration-runner.ts`
- `tests/integration/migration.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_217_migrate_rejects_completed_tasks/spec.md`
- `docs/features/issue_217_migrate_rejects_completed_tasks/plan.md`
- `docs/features/issue_217_migrate_rejects_completed_tasks/result.md`
- `docs/features/issue_217_migrate_rejects_completed_tasks/pr.md`

## Tests Run

- `pnpm test -- tests/integration/migration.test.ts tests/cli.test.ts`
- `pnpm test -- tests/integration/migration.test.ts`
- `pnpm build`

## PlaySpec Task

- `issue_217_migrate_rejects_completed_tasks`

## Risk Notes

- `playspec migrate` is deprecated but remains callable; this intentionally blocks completed-task task mutations through that path.
- File-only migration plans remain allowed unless bundled with task mutation actions.

## Reusable Guidance

No reusable agent guidance is needed. The fix follows existing lifecycle and migration boundaries without introducing a new workflow pattern.
