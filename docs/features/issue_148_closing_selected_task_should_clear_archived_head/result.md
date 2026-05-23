# Issue 148 Implementation Result

## Files Changed

- `src/cli/commands/close.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/issue_148_closing_selected_task_should_clear_archived_head/spec.md`
- `docs/features/issue_148_closing_selected_task_should_clear_archived_head/plan.md`
- `docs/features/issue_148_closing_selected_task_should_clear_archived_head/result.md`

## Behavior Implemented

- `playspec close --task <taskId>` now reads the current `.playspec/HEAD` selection before closing.
- After a successful archive, if the closed task was the selected HEAD task, the command clears `.playspec/HEAD`.
- The close output now explains that HEAD was cleared and tells the operator to select another active task with `playspec use <TASK_ID>`.
- Closing a completed task that is not HEAD preserves the existing HEAD selection.
- Close failures still occur before any HEAD clearing, preserving existing behavior for non-completed tasks and archive destination collisions.

## Verification Performed

- `pnpm test -- tests/integration/init-create-next.test.ts`
  - Passed: 44 tests.
- `pnpm test`
  - Passed: 24 test files, 485 tests.
- `pnpm build`
  - Passed.

## Safe Refactor Review

- Reviewed the diff against `origin/master`.
- No refactor was applied. The implementation is already scoped to the close command and the focused integration tests, and additional extraction would not reduce meaningful complexity.
- The storage and core close paths were intentionally left unchanged to preserve existing ownership boundaries.

## PR Preparation

- PR notes were drafted in `docs/features/issue_148_closing_selected_task_should_clear_archived_head/pr.md`.
- Reusable agent guidance decision: no new reusable guidance is needed. This is a narrow CLI lifecycle fix following existing module boundaries.
- PR link: https://github.com/cksdnr1/playspec/pull/167

## Remaining Risks

- Clearing HEAD is a visible lifecycle change for scripts that inspect the HEAD file after closing the selected task. The prior value pointed at archived storage and was not usable by active commands.
- Storage and core close paths still do not mutate HEAD by design; direct programmatic callers that bypass the CLI keep the previous storage-only behavior.
