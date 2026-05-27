# Implementation Result

## Files Changed

- `src/cli/commands/status.ts`
- `tests/cli.test.ts`
- `docs/features/issue_257_status_completed_head_guard/spec.md`
- `docs/features/issue_257_status_completed_head_guard/plan.md`
- `docs/features/issue_257_status_completed_head_guard/result.md`

## Behavior Implemented

- Bare `playspec status` now rejects a HEAD task whose status is not `active` by throwing the existing `TaskNotActiveError`.
- `playspec status --quiet` follows the same HEAD lifecycle rejection because the guard runs before quiet/header rendering.
- The guard runs before loading link context and before any status output, so completed HEAD tasks cannot print task detail or suggested-next guidance.
- Explicit completed task inspection remains available through `playspec status <taskId> --quiet`.

## Verification Performed

- `pnpm exec vitest run tests/cli.test.ts -t "status"`
  - Passed: 10 tests, 187 skipped.
- `pnpm build`
  - Passed.
- `pnpm test`
  - Passed: 608 tests across 30 files.

## Notes

- Initial validation was accidentally run before the patch was transferred into the isolated worktree. After correcting the workspace, focused tests, build, and the full suite were rerun successfully in `/Users/chanwook.lee/PJ/playspec-issue-257`.

## Remaining Risks

- Intentional compatibility change: users who relied on bare `playspec status` immediately after completion must inspect the completed task explicitly or switch HEAD to an active task.

## Refactor Review

- `git diff --check` passed.
- No refactor was applied. The implementation is already a local guard plus focused CLI tests, and adding helpers or broader structure would increase scope without reducing complexity.

## PR Preparation

- PR notes written to `docs/features/issue_257_status_completed_head_guard/pr.md`.
- Reusable agent guidance update: not needed because the change is a narrow command-local lifecycle guard.
- PR link: pending branch push and draft PR creation.

## Final PR Link

- Draft PR: https://github.com/cksdnr1/playspec/pull/258
