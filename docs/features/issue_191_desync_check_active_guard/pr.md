# PR: desync-check completed task active guard

Fixes #191

## Summary

- Added the existing active-task assertion to `PlaySpecCore.checkTaskDesync()`.
- Added CLI regressions for completed-task rejection through `.playspec/HEAD` and explicit `--task`.
- Preserved existing active-task desync output behavior.

## Changed Files

- `src/core/playspec-core.ts`
- `tests/cli.test.ts`
- `docs/features/issue_191_desync_check_active_guard/spec.md`
- `docs/features/issue_191_desync_check_active_guard/plan.md`
- `docs/features/issue_191_desync_check_active_guard/result.md`
- `docs/features/issue_191_desync_check_active_guard/pr.md`

## Tests Run

- `pnpm test -- --runInBand tests/cli.test.ts -t "desync-check|desync"` failed before executing tests because Vitest does not support `--runInBand`.
- `pnpm test -- tests/cli.test.ts -t "desync-check|desync"` passed.
- `pnpm build` passed.
- `pnpm test` passed.

## PlaySpec Task

- `issue_191_desync_check_completed_task_active_guard`

## Risk Notes

- Low risk. Completed tasks now fail fast for desync-check, which is the requested lifecycle boundary alignment.
- Core-level guard keeps CLI and MCP behavior consistent.
