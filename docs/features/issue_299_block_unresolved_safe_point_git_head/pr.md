# Draft PR: Issue #299

Fixes #299

## Summary

- Blocks Git rollback planning when the stored rollback safe-point Git head cannot be resolved or compared by Git.
- Keeps preview and confirmed Git rollback aligned by adding a blocking safety reason in `RollbackManager.plan()`.
- Adds focused rollback-manager regression tests for invalid safe-point comparison and confirms no `git restore` is attempted when the plan is unsafe.

## Changed Files

- `src/core/rollback-manager.ts`
- `tests/unit/rollback-manager.test.ts`
- `docs/features/issue_299_block_unresolved_safe_point_git_head/spec.md`
- `docs/features/issue_299_block_unresolved_safe_point_git_head/plan.md`
- `docs/features/issue_299_block_unresolved_safe_point_git_head/result.md`
- `docs/features/issue_299_block_unresolved_safe_point_git_head/pr.md`

## Tests Run

- `pnpm vitest run tests/unit/rollback-manager.test.ts`
- `pnpm vitest run tests/unit/rollback-manager.test.ts tests/cli.test.ts`
- `pnpm build`
- `pnpm test`
- `git diff --check`

## PlaySpec Task

- `issue_299_block_unresolved_safe_point_git_head`

## Risk Notes

- Workflows with malformed or unreachable rollback safe-point Git metadata will now be blocked from Git rollback and directed toward state-only/manual recovery.
- Valid safe-point rollback behavior and existing dirty-file, new-commit, untracked-conflict, quoted-path, and clean rollback coverage remain passing.

## Reusable Agent Guidance

No reusable guidance update is needed. The change is a local rollback safety guard and does not introduce a new workflow convention.
