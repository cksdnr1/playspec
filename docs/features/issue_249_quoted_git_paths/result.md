# Issue 249 Implementation Result

## Files Changed

- `src/core/git-state.ts`
- `tests/unit/git-state.test.ts`
- `tests/unit/rollback-manager.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_249_quoted_git_paths/spec.md`
- `docs/features/issue_249_quoted_git_paths/plan.md`
- `docs/features/issue_249_quoted_git_paths/result.md`

## Behavior Implemented

- `GitState.getWorkspaceState()` now reads file status with `git status --porcelain -z --untracked-files=all`.
- `GitState.listNameStatusSince()` now reads committed name-status data with `git diff --name-status -z`.
- New NUL-delimited parsers preserve exact repository-relative paths, including paths containing quotes, tabs, and UTF-8 characters.
- Porcelain `-z` rename records are mapped from Git's `destination\0source\0` format into the existing `{ originalPath, path }` entry shape.
- Name-status `-z` rename records are mapped from `source\0destination\0` into the same existing shape.
- Rollback and desync consumers continue to receive exact path strings from `GitState`.

## Verification Performed

- `pnpm test -- tests/unit/git-state.test.ts tests/unit/rollback-manager.test.ts`
- `pnpm test -- tests/cli.test.ts -t "desync|rollback"`
- `pnpm build`
- `pnpm test`

## Remaining Risks

- The old line-oriented parser exports remain for existing unit coverage and compatibility, but production `GitState` methods no longer use them for rollback/desync path collection.
- Branch divergence still uses human-readable `git status --short --branch` text, but that output is not parsed for file paths.

## Safe Refactor Review

- Reviewed the branch diff against `origin/master`.
- No additional refactor was applied; the implementation is already localized to `GitState` parsing and focused tests.
- Intentionally skipped broader cleanup of the legacy line-oriented parser exports to avoid changing unrelated test/public helper surface.
