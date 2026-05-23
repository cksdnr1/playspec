# PR Draft

Fixes #148

## Summary

- Clear `.playspec/HEAD` after `playspec close --task <taskId>` archives the currently selected task.
- Print a deterministic recovery hint telling operators to select another active task with `playspec use <TASK_ID>`.
- Add CLI regressions for selected-task close behavior and non-selected close behavior.

## Changed Files

- `src/cli/commands/close.ts`
- `tests/integration/init-create-next.test.ts`
- `docs/features/issue_148_closing_selected_task_should_clear_archived_head/spec.md`
- `docs/features/issue_148_closing_selected_task_should_clear_archived_head/plan.md`
- `docs/features/issue_148_closing_selected_task_should_clear_archived_head/result.md`
- `docs/features/issue_148_closing_selected_task_should_clear_archived_head/pr.md`

## Tests Run

- `pnpm test -- tests/integration/init-create-next.test.ts`
- `pnpm test`
- `pnpm build`

## PlaySpec Task

- `issue_148_closing_selected_task_should_clear_archived_head`

## Risk Notes

- Clearing HEAD is a visible lifecycle change for scripts that read `.playspec/HEAD` after closing the selected task, but the previous value pointed at archived storage and was not usable by active commands.
- Core and storage archive APIs remain unchanged; direct non-CLI callers still get storage-only behavior.

## Reusable Agent Guidance

- No reusable agent guidance is needed. The fix follows existing CLI/core/storage boundaries and does not introduce a new workflow pattern.
