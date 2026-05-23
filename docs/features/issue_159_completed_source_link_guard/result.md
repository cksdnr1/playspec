# Issue 159 Completed Source Link Guard Result

## Files Changed

- `src/core/playspec-core.ts`
- `tests/integration/task-links.test.ts`
- `docs/features/issue_159_completed_source_link_guard/spec.md`
- `docs/features/issue_159_completed_source_link_guard/plan.md`
- `docs/features/issue_159_completed_source_link_guard/result.md`

## Behavior Implemented

- `PlaySpecCore.addTaskLink()` now rejects a completed source task before resolving the target or mutating `source.links`.
- `PlaySpecCore.removeTaskLink()` now rejects a completed source task before resolving the target or mutating `source.links`.
- Because the guard is in core, both explicit CLI source arguments and HEAD-based `--to` shorthand use the same lifecycle check.
- Active source behavior is unchanged, including duplicate-link warnings and missing-link warnings.

## Verification Performed

- `pnpm vitest run tests/integration/task-links.test.ts`
  - Passed: 9 tests.
- `pnpm vitest run tests/cli.test.ts`
  - Passed: 179 tests.
- `pnpm build`
  - Passed.
- `git diff --check`
  - Passed.

## Refactor Review

- Reviewed the implementation diff against `origin/master`.
- No refactor was applied. The production change is two guard calls in the existing core mutation methods, and the test additions are direct coverage for the four requested CLI rejection paths.
- Skipped introducing helper abstractions because the existing `assertTaskIsActive()` helper already provides the shared lifecycle guard.

## Final Notes

- PR URL: https://github.com/cksdnr1/playspec/pull/175
- Reusable agent guidance: no new guidance needed. The change follows existing lifecycle guard patterns and does not introduce a reusable workflow lesson beyond using core-level guards for shared mutation paths.

## Remaining Risks

- Workflows that intentionally edited links on completed source tasks now fail with `TaskNotActiveError`. This is expected and matches the lifecycle safety requirement.
- Target task mutability remains unchanged by scope.
