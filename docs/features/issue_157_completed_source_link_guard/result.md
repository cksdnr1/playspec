# Implementation Result: Completed Source Link Guard

## Files Changed

- `src/core/playspec-core.ts`
- `tests/integration/task-links.test.ts`
- `docs/issues/issue-157-completed-source-link-guard.md`
- `docs/features/issue_157_completed_source_link_guard/spec.md`
- `docs/features/issue_157_completed_source_link_guard/plan.md`
- `docs/features/issue_157_completed_source_link_guard/result.md`

## Behavior Implemented

- `PlaySpecCore.addTaskLink()` now rejects non-active source tasks immediately after loading the source task.
- `PlaySpecCore.removeTaskLink()` now uses the same active-source guard.
- Both explicit CLI source paths and HEAD/`--to` shorthand paths share the core guard.
- Completed source tasks fail with the existing `TaskNotActiveError` message and do not mutate `links`.

## Verification Performed

- `pnpm test -- tests/integration/task-links.test.ts`
  - Passed: 9 tests.
- `pnpm build`
  - Passed.
- `pnpm test`
  - Passed: 24 test files, 496 tests.
- `git diff --check`
  - Passed.

## Safe Refactor Review

- No refactor was applied. The implementation is already limited to two guard calls plus focused regression tests.
- Broader helper extraction was intentionally skipped because it would add churn without reducing meaningful complexity.

## Remaining Risks

- Low. The implementation uses an existing lifecycle guard and does not change target task lookup behavior for active sources.

## PR Preparation

- PR notes written to `docs/features/issue_157_completed_source_link_guard/pr.md`.
- Reusable agent guidance update: not needed. This issue is a narrow lifecycle guard fix and does not reveal a reusable workflow rule beyond existing active-task mutation boundaries.
- PR link: https://github.com/cksdnr1/playspec/pull/173
