# PR notes

Fixes #239

## Summary

- Reject completed HEAD tasks from `playspec current-task`.
- Keep deprecated `playspec current` aligned with the same non-active-task guard.
- Add CLI regression tests for completed HEAD handling in both commands.

## Changed Files

- `src/cli/commands/current-task.ts`
- `src/cli/commands/current.ts`
- `tests/cli.test.ts`
- `docs/features/issue_239_current_task_rejects_completed_head/spec.md`
- `docs/features/issue_239_current_task_rejects_completed_head/plan.md`
- `docs/features/issue_239_current_task_rejects_completed_head/result.md`
- `docs/features/issue_239_current_task_rejects_completed_head/pr.md`

## Tests Run

- `pnpm exec vitest run tests/cli.test.ts --testNamePattern current`
- `pnpm test -- tests/cli.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `issue_239_current_task_rejects_completed_head`

## Risk Notes

This changes read-only command behavior for completed HEAD tasks. Completed task inspection remains available through explicit task lookup or archive inspection.
