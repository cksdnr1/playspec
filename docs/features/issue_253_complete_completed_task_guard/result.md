# Issue 253 Implementation Result

## Files Changed

- `src/cli/commands/complete.ts`
- `tests/cli.test.ts`
- `docs/features/issue_253_complete_completed_task_guard/spec.md`
- `docs/features/issue_253_complete_completed_task_guard/plan.md`
- `docs/features/issue_253_complete_completed_task_guard/result.md`

## Behavior Implemented

`runComplete()` now rejects non-active tasks immediately after task resolution by throwing `TaskNotActiveError`. This happens before context header output, gate result selection, interactive prompts, or completion side effects.

The existing `PlaySpecCore.completePhase()` active-task guard remains unchanged as a core-level safety check.

## Verification Performed

- Confirmed the new HEAD-based completed-task regression failed before the guard because stdout contained `Task: Complete Completed Head Guard Task`.
- Added regression coverage for:
  - completed HEAD task rejection through `playspec complete`
  - explicit completed task rejection through `playspec complete --task <id>`
- Ran focused and full validation:
  - `pnpm exec vitest run tests/cli.test.ts -t "complete"`
  - `pnpm build`
  - `pnpm test`

## Test Results

- Focused completion tests: passed, 39 tests run in `tests/cli.test.ts` with the `complete` filter.
- Build: passed.
- Full test suite: passed, 30 test files and 607 tests.

## Gaps

No known test gaps remain for the requested CLI guard ordering.

## Refactor Review

No refactor was applied. The implementation is already limited to the existing `complete` command pattern and adjacent CLI tests. Additional abstraction would make the change broader without reducing complexity.

Focused verification after the refactor review:

- `pnpm exec vitest run tests/cli.test.ts -t "complete"` passed.

## Remaining Risks

Low risk: callers that previously consumed partial stdout from failed completed-task `complete` calls will no longer receive the context header. This is the intended lifecycle-safety behavior from the issue acceptance criteria.
