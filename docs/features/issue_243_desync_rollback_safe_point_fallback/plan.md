# Implementation Plan: Issue 243 desync rollback safe point fallback

## Ordered Steps

1. Update desync baseline resolution.
   - File: `src/core/state-desync-detector.ts`
   - In `StateDesyncDetector.run()`, compute `lastKnownGitHead` from `task.stateSync?.lastKnownGitHead`, falling back to `task.rollback?.lastSafePoint?.gitHead`, then `null`.
   - Leave the existing no-safe-point branch, committed diff collection, reasons, severity classification, and result shape unchanged.

2. Add focused CLI regression coverage.
   - File: `tests/cli.test.ts`
   - Place the test near existing `desync-check` cases.
   - Flow:
     1. Create an active task.
     2. Write `src/app.ts`.
     3. Initialize Git.
     4. Run `complete` to create `stateSync` and `rollback.lastSafePoint`.
     5. Load the task through `YamlTaskStore`, save `rollback.lastSafePoint.gitHead`, and update the task with `stateSync: undefined`.
     6. Modify `src/app.ts`, commit the change, and capture current HEAD.
     7. Run `desync-check`.
     8. Assert exit code 0, `Severity: high`, fallback `Last known Git HEAD: <safePointGitHead>`, `Current Git HEAD: <currentHead>`, and `Git HEAD changed since the last safe point.`.

3. Run targeted validation.
   - Inspect scripts in `package.json`.
   - Run `pnpm test -- tests/cli.test.ts -t "desync-check|desync"`.
   - Run `pnpm build`.
   - Run broader `pnpm test` if targeted tests and build pass and runtime is reasonable.

4. Record implementation result and PR notes.
   - Update `docs/features/issue_243_desync_rollback_safe_point_fallback/result.md` after code/tests.
   - Update `docs/features/issue_243_desync_rollback_safe_point_fallback/pr.md` before PR creation.

## Files To Edit

- `src/core/state-desync-detector.ts`
- `tests/cli.test.ts`
- `docs/features/issue_243_desync_rollback_safe_point_fallback/result.md`
- `docs/features/issue_243_desync_rollback_safe_point_fallback/pr.md`

## Tests To Add Or Update

- Add one CLI regression test for a task with `rollback.lastSafePoint.gitHead` populated and `stateSync` absent.
- Keep existing tests covering normal `stateSync`, untracked files, completed-task guards, and rollback preview behavior unchanged.

## Active Entry Point Trace

`playspec desync-check` -> `runDesyncCheck()` -> active task resolution -> `PlaySpecCore.checkTaskDesync()` -> `StateDesyncDetector.run()` -> fallback baseline included in `DesyncCheckResult.lastKnownGitHead` -> `printDesyncResult()` prints the fallback Git head and high severity reason.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: `StateDesyncDetector.run()` reads only `stateSync.lastKnownGitHead`.
- Bypass path: any core/MCP caller using `PlaySpecCore.checkTaskDesync()` receives the same detector result, so the fallback belongs in core, not CLI formatting.
- Partial migration risk: `stateSync` can be absent while `rollback.lastSafePoint.gitHead` remains present. The fallback closes this without introducing migration writes.

## Risks

- A null rollback safe point Git head must remain null. Use nullish fallback only; do not coerce missing Git HEADs into strings.
- If `stateSync.lastKnownGitHead` is present, it must win over rollback metadata to preserve current behavior.
- Test setup must remove `stateSync` without disturbing rollback metadata, otherwise it will not prove the fallback path.

## Rollback Notes

The implementation changes only detector read logic and tests. If it needs to be reverted, revert the detector initializer change and the added regression test. No destructive Git or PlaySpec rollback behavior is introduced.

## Completion Criteria

- `StateDesyncDetector.run()` prefers `stateSync.lastKnownGitHead`, falls back to `rollback.lastSafePoint.gitHead`, and returns null when both are missing.
- CLI output for the fallback-only task prints the rollback safe point Git head instead of `none`.
- A later commit after that fallback head produces high severity with the existing Git HEAD change reason.
- Targeted test and build validation pass.
