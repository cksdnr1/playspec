# Implementation Result: Issue 243 desync rollback safe point fallback

## Behavior Implemented

- `StateDesyncDetector.run()` now resolves the last known Git head from `task.stateSync.lastKnownGitHead` first.
- When `stateSync.lastKnownGitHead` is missing or null, the detector falls back to `task.rollback.lastSafePoint.gitHead`.
- When both values are missing, the detector still keeps `lastKnownGitHead` as null and preserves the existing no-safe-point behavior.
- `playspec desync-check` now prints the fallback rollback safe point Git head because CLI output already uses `DesyncCheckResult.lastKnownGitHead`.

## Files Changed

- `src/core/state-desync-detector.ts`
- `tests/cli.test.ts`
- `docs/features/issue_243_desync_rollback_safe_point_fallback/spec.md`
- `docs/features/issue_243_desync_rollback_safe_point_fallback/plan.md`
- `docs/features/issue_243_desync_rollback_safe_point_fallback/result.md`

## Regression Coverage

- Added a CLI regression that:
  - creates and completes a task,
  - preserves `rollback.lastSafePoint.gitHead`,
  - removes `stateSync`,
  - commits a later tracked-file change,
  - verifies `desync-check` reports high severity,
  - verifies CLI output prints the fallback last known Git head and current Git head,
  - verifies the existing Git HEAD change reason is reported.

## Verification Performed

- `pnpm test -- tests/cli.test.ts -t "desync-check|desync"` passed: 6 tests passed, 189 skipped.
- `pnpm build` passed.
- `pnpm test` passed: 30 test files passed, 606 tests passed.
- Safe-refactor review compared the implementation diff against `origin/master`; no cleanup was applied because the detector change and regression test are already minimal and scope-bound.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/245

## Remaining Risks

- Low risk. The change is read-only detector baseline resolution and does not alter task persistence, rollback execution, migration, or CLI task resolution.
- A null rollback safe point Git head remains null, so repositories without a Git HEAD keep the existing no-baseline behavior.
