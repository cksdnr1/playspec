# Issue 239 result

## Summary

Implemented completed-task rejection for HEAD-based current task commands.

- `playspec current-task` now throws `TaskNotActiveError` when `.playspec/HEAD` resolves to a non-active task.
- Deprecated `playspec current` keeps its deprecation warning and then reports the same non-active-task error.
- Active HEAD task rendering is unchanged.

## Validation

Passed:

- `pnpm exec vitest run tests/cli.test.ts --testNamePattern current`
- `pnpm test -- tests/cli.test.ts`
- `pnpm build`
- `pnpm test`

Skipped:

- None.

## Risk Notes

Users who used `current-task` or `current` to inspect a just-completed HEAD task need to use `get-task <taskId>` or archive inspection instead. This is the intended behavior from issue #239.
