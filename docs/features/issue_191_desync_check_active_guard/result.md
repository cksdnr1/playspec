# Implementation Result: desync-check completed task active guard

## Summary

Implemented the completed-task guard for desync checking at the core boundary.

## Changed Behavior

- `PlaySpecCore.checkTaskDesync()` now calls the existing active-task assertion before running `StateDesyncDetector`.
- `playspec desync-check` fails when `.playspec/HEAD` resolves to a completed task.
- `playspec desync-check --task <completedTaskId>` fails when the explicit task is completed.
- Active-task desync output remains unchanged.

## Changed Files

- `src/core/playspec-core.ts`
- `tests/cli.test.ts`
- `docs/features/issue_191_desync_check_active_guard/spec.md`
- `docs/features/issue_191_desync_check_active_guard/plan.md`
- `docs/features/issue_191_desync_check_active_guard/result.md`

## Tests Run

- `pnpm test -- --runInBand tests/cli.test.ts -t "desync-check|desync"` failed before executing tests because Vitest does not support `--runInBand`.
- `pnpm test -- tests/cli.test.ts -t "desync-check|desync"` passed: 6 tests passed, 177 skipped.
- `pnpm build` passed.
- `pnpm test` passed: 24 files, 509 tests.

## Risks

- Compatibility change is intentional: completed tasks no longer return desync guidance.
- Guard is in core, so CLI and MCP behavior stay aligned.

## Safe Refactor Review

- No additional refactor was applied.
- Cleanup was intentionally skipped because the final diff is already limited to one core assertion and two focused CLI regression tests.
- The behavior chain remains unchanged for active tasks: CLI resolves an active task, core guard passes, and `StateDesyncDetector` produces the existing output.
