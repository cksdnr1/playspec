# Issue 181 rollback completed task guard result

## Files Changed

- `src/core/playspec-core.ts`
- `tests/cli.test.ts`
- `docs/features/issue_181_rollback_completed_task_guard/spec.md`
- `docs/features/issue_181_rollback_completed_task_guard/spec_validation.md`
- `docs/features/issue_181_rollback_completed_task_guard/plan.md`
- `docs/features/issue_181_rollback_completed_task_guard/plan_validation.md`
- `docs/features/issue_181_rollback_completed_task_guard/result.md`

## Behavior Implemented

- `PlaySpecCore.planRollback()` now rejects non-active tasks before rollback preview generation.
- `PlaySpecCore.rollbackStateOnly()` now rejects non-active tasks before task YAML restore or artifact quarantine.
- `PlaySpecCore.executeGitRollback()` now rejects non-active tasks before rollback planning or Git restore.
- CLI rollback now inherits the same `TaskNotActiveError` behavior for completed HEAD tasks and explicit completed `--task` selection.
- MCP rollback tools also inherit the guard through the shared core methods.

## Tests Added

- Completed HEAD rollback preview rejection.
- Completed HEAD `--state-only` rejection.
- Completed HEAD `--git-only --confirm` rejection.
- Explicit completed `--task` rollback preview rejection.
- State-only non-mutation assertions for raw `task.yaml`, active snapshot location, and rollback quarantine absence.

## Verification Performed

- `pnpm vitest run tests/cli.test.ts --testNamePattern rollback`
- `pnpm build`
- `pnpm test`

Focused test result:

- Rollback-focused CLI tests passed: 10 tests run in `tests/cli.test.ts` with 175 skipped by the test-name filter.
- Full suite passed: 24 test files and 511 tests.

Skipped validation:

- No validation commands were skipped.

## Remaining Risks

- No known implementation risk remains. The change is limited to the shared core lifecycle boundary and focused CLI regression tests.

## Refactor Review

- Reviewed the branch diff against `origin/master`.
- No refactor was applied because the implementation is already limited to three core guard calls and focused CLI test coverage.
- Skipped additional cleanup to avoid broadening scope or changing active rollback behavior.

## PR Preparation

- Draft PR notes written to `docs/features/issue_181_rollback_completed_task_guard/pr.md`.
- Reusable agent guidance: none needed; this issue used existing lifecycle guard patterns.
- PR link: https://github.com/cksdnr1/playspec/pull/182
