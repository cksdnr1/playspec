# Issue 152 Completed Use Guard Result

## Implementation

Files changed:

- `src/cli/commands/use.ts`
- `tests/cli.test.ts`
- `docs/features/issue_152_completed_use_guard/spec.md`
- `docs/features/issue_152_completed_use_guard/plan.md`
- `docs/features/issue_152_completed_use_guard/result.md`

Behavior implemented:

- Explicit `playspec use <taskId>` now loads the task and rejects it before writing `.playspec/HEAD` when `task.status !== 'active'`.
- The rejection uses the existing `TaskNotActiveError`, so the user-visible error says the task is not active and includes the existing active-task recovery hint.
- Missing-task suggestion behavior remains unchanged because the new guard runs only after `store.getTask(taskId)` succeeds.
- No-argument interactive `playspec use` remains unchanged and still uses `store.listActiveTasks()`.

Regression coverage:

- Added a CLI test that creates an active HEAD task, creates a second task, marks the second task completed, runs `playspec use <completedTaskId>`, and asserts:
  - the command exits non-zero.
  - stderr reports the task is not active.
  - stderr includes the active-task recovery hint.
  - `.playspec/HEAD` remains on the original active task.

## Verification

Commands run:

- `pnpm test -- tests/cli.test.ts`
- `pnpm build`
- `pnpm test`

Results:

- Passed: 174 tests in `tests/cli.test.ts`.
- Passed: `pnpm build`.
- Passed: full test suite, 24 test files and 483 tests.

Remaining validation:

- None.

## Remaining Risks

- No known implementation risks. The change is scoped to the explicit `use` HEAD mutation path and does not alter storage, archive, MCP, or workflow routing behavior.

## Safe Refactor Review

Reviewed branch diff against `origin/master` after implementation and tests.

Refactors applied:

- None.

Refactors intentionally skipped:

- No helper extraction or shared lifecycle abstraction was added. The status guard is a single local check in the only explicit HEAD mutation helper for `playspec use`, which is the narrowest implementation for this issue.

Verification after refactor review:

- Existing validation remained current: `pnpm test -- tests/cli.test.ts`, `pnpm build`, and `pnpm test` all passed before this no-op refactor phase.

## PR Preparation

Reusable agent guidance:

- No new reusable guidance is needed. This was a narrow CLI lifecycle safety guard using existing error and test patterns.

PR artifact:

- Draft PR notes written to `docs/features/issue_152_completed_use_guard/pr.md`.

Draft PR:

- https://github.com/cksdnr1/playspec/pull/153
