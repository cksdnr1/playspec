# Implementation Plan: Issue #299

## Ordered Steps

1. Add focused rollback-manager regression tests first.
   - File: `tests/unit/rollback-manager.test.ts`
   - Cover `manager.plan(makeTask())` with a present but invalid `safePoint.gitHead`.
   - Stub `listCommitsAfter()` or `listNameStatusSince()` to throw.
   - Assert `canExecuteGitRollback` is false.
   - Assert `safetyReasons` includes stable wording that the rollback safe-point Git head cannot be resolved or compared.
   - Assert `confirmCommand` is null.

2. Add confirmed rollback regression coverage.
   - File: `tests/unit/rollback-manager.test.ts`
   - Call `manager.executeGitRollback(makeTask())` with the same failing comparison stub.
   - Assert it rejects with `Git rollback is blocked`.
   - Assert the `run(['restore', ...])` path is not called.

3. Update rollback planning.
   - File: `src/core/rollback-manager.ts`
   - Replace `.catch(() => [])` on safe-point comparison calls with explicit try/catch.
   - Preserve empty display arrays when a comparison fails, but add a blocking safety reason.
   - Use a stable reason: `Rollback safe-point Git head cannot be resolved or compared.`
   - Keep dirty entries, untracked conflict, branch divergence, affected commits, changed/deleted/renamed target collection, and confirm-command logic unchanged.

4. Verify no broad behavior changes.
   - Run focused unit tests for rollback manager.
   - Run relevant CLI rollback tests if needed.
   - Run repository build/test commands according to `package.json`.

## Files to Edit

- `src/core/rollback-manager.ts`
- `tests/unit/rollback-manager.test.ts`
- `docs/features/issue_299_block_unresolved_safe_point_git_head/result.md` during implementation/test phases
- `docs/features/issue_299_block_unresolved_safe_point_git_head/pr.md` during PR prep

## Entry Point Trace

Preview:
`playspec rollback` -> `runRollback()` -> `PlaySpecCore.planRollback()` -> `RollbackManager.plan()` -> ineligible plan printed with safety reason.

Confirmed Git rollback:
`playspec rollback --git-only --confirm` -> `runRollback()` -> `PlaySpecCore.executeGitRollback()` -> `RollbackManager.executeGitRollback()` -> plan is unsafe -> `UnsafeGitRollbackBlockedError` -> CLI exits non-zero.

MCP:
`playspec_plan_rollback` and `playspec_execute_git_rollback` share `PlaySpecCore` and receive the same core behavior.

## Old Paths and Bypass Risks

- Current bypass: `.catch(() => [])` erases Git comparison failures.
- The implementation must remove both suppressions for `listCommitsAfter()` and `listNameStatusSince()`.
- Confirmed rollback must continue to call `plan()` and must not run `git restore` when the plan is unsafe.

## Risks

- Workflows with malformed historical `gitHead` values will be newly blocked from Git rollback. This is intended.
- Avoid including raw Git error output in assertions; use stable operator-facing wording.
- Do not add unrelated Git repository health checks.

## Rollback Notes

This change only tightens safety checks. Reverting would restore the previous false-eligible behavior, so any rollback of this code change should be accompanied by manual inspection of rollback safety tests.

## Completion Criteria

- Invalid safe-point `gitHead` preview is ineligible.
- Confirmed Git rollback rejects before restore for invalid safe-point `gitHead`.
- Existing valid rollback, dirty file, new commit, untracked conflict, quoted path, and clean rollback tests still pass.
- Build and test commands run successfully or failures are documented.
