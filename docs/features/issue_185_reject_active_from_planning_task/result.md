# Implementation Result

## Files Changed

- `src/core/errors.ts`
- `src/cli/commands/create.ts`
- `tests/cli.test.ts`
- `docs/features/issue_185_reject_active_from_planning_task/spec.md`
- `docs/features/issue_185_reject_active_from_planning_task/plan.md`
- `docs/features/issue_185_reject_active_from_planning_task/result.md`

## Behavior Implemented

- Added `PlanningTaskNotCompletedError` with phase-execution-specific guidance.
- Updated explicit `create --phase --from <taskId>` handling to load the referenced planning task and reject it unless `status === 'completed'`.
- Kept the automatic no-`--from` path on `store.listCompletedTasks()` with existing candidate and ambiguity handling.
- Kept completed planning task artifact resolution and missing-context behavior unchanged.

## Verification Performed

- `pnpm test -- tests/cli.test.ts -t "rejects --phase --from when the planning task is not completed"`
  - Passed: 1 test, 181 skipped in `tests/cli.test.ts`.
- `pnpm build`
  - Passed.
- `pnpm test`
  - Passed: 24 test files, 508 tests.
- Safe refactor pass:
  - Reviewed the branch diff against `origin/master`.
  - No cleanup changes were made; the implementation is already the smallest local change.
  - Reran the focused regression successfully.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/186
- Reusable agent guidance: no new guidance needed; this is a narrow lifecycle guard.

## Remaining Risks

- Existing scripts that intentionally used active planning tasks as explicit phase-execution sources will now fail. This matches the completed-planning lifecycle boundary required by the issue.
