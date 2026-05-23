# PR draft: Issue 181 rollback completed task guard

Fixes #181

## Summary

- Add active-task validation to all shared core rollback paths before preview, state-only rollback, or confirmed Git rollback can proceed.
- Add CLI regression tests for completed HEAD rollback and explicit completed `--task` rollback.
- Assert rejected state-only rollback leaves completed task YAML and rollback artifacts unchanged.

## Changed Files

- `src/core/playspec-core.ts`
- `tests/cli.test.ts`
- `docs/features/issue_181_rollback_completed_task_guard/spec.md`
- `docs/features/issue_181_rollback_completed_task_guard/spec_validation.md`
- `docs/features/issue_181_rollback_completed_task_guard/plan.md`
- `docs/features/issue_181_rollback_completed_task_guard/plan_validation.md`
- `docs/features/issue_181_rollback_completed_task_guard/result.md`
- `docs/features/issue_181_rollback_completed_task_guard/pr.md`

## Tests Run

- `pnpm vitest run tests/cli.test.ts --testNamePattern rollback`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `issue_181_rollback_completed_task_guard`

## Risk Notes

- Low risk: the code change is limited to existing lifecycle validation at the core rollback boundary.
- Active-task rollback behavior and rollback manager safety checks are unchanged.

## Reusable Agent Guidance

No reusable agent guidance needs to be documented. This was a narrow lifecycle guard fix using existing repository patterns.
