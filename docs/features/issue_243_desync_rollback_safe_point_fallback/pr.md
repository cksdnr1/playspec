# PR: desync-check rollback safe point fallback

Fixes #243

## Summary

- `StateDesyncDetector.run()` now resolves the desync baseline from `stateSync.lastKnownGitHead` first, then falls back to `rollback.lastSafePoint.gitHead`.
- `playspec desync-check` now prints the rollback safe point Git head instead of `none` for active tasks that have rollback metadata but no `stateSync`.
- Added a CLI regression that removes `stateSync`, commits after the rollback safe point, and verifies high severity plus the existing Git HEAD change reason.

## Changed Files

- `src/core/state-desync-detector.ts`
- `tests/cli.test.ts`
- `docs/features/issue_243_desync_rollback_safe_point_fallback/spec.md`
- `docs/features/issue_243_desync_rollback_safe_point_fallback/plan.md`
- `docs/features/issue_243_desync_rollback_safe_point_fallback/result.md`
- `docs/features/issue_243_desync_rollback_safe_point_fallback/pr.md`

## Tests Run

- `pnpm test -- tests/cli.test.ts -t "desync-check|desync"`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `issue_243_desync_rollback_safe_point_fallback`

## Risk Notes

- Low risk. The implementation changes read-only baseline resolution inside the detector and leaves rollback execution, task persistence, migration, and CLI resolution unchanged.
- Null Git heads remain null, so repositories without a safe Git baseline retain the existing no-baseline behavior.

## Reusable Agent Guidance

No reusable agent guidance is needed. This is a narrow detector fallback and regression-test change.
