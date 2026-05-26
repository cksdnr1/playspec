Fixes #249

## Summary

- Switches rollback/desync Git path collection to NUL-delimited `git status` and `git diff --name-status` formats.
- Preserves exact repository-relative paths containing quotes, tabs, and UTF-8 characters.
- Adds focused parser, desync output, rollback conflict, and `git restore` argv coverage.

## Why This PR

Git quotes and escapes valid path names in human-readable status output. Rollback and desync checks use those parsed paths for user-visible reports, safety comparisons, and `git restore` target arguments, so corrupted path tokens can weaken the exact guard behavior these commands rely on.

## Problem

`GitState.getWorkspaceState()` and `GitState.listNameStatusSince()` collected line-oriented Git output. Porcelain status had a custom decoder, but committed name-status parsing still split text output on tabs and could preserve quoted display tokens instead of exact paths.

## How It Was Fixed

- `src/core/git-state.ts`: changed production status collection to `git status --porcelain -z --untracked-files=all`.
- `src/core/git-state.ts`: changed committed name-status collection to `git diff --name-status -z`.
- `src/core/git-state.ts`: added NUL-delimited parsers for status and name-status records, including Git's different rename field ordering for status versus name-status output.
- `tests/unit/git-state.test.ts`: added exact quoted-character, tab, UTF-8, and rename parser coverage.
- `tests/unit/rollback-manager.test.ts`: verifies confirmed rollback passes an exact quoted-character target path to `git restore`.
- `tests/cli.test.ts`: verifies `desync-check` output and rollback conflict planning use exact `src/quote"file.ts` paths.

## Validation

- Passed: `pnpm test -- tests/unit/git-state.test.ts tests/unit/rollback-manager.test.ts`
- Passed: `pnpm test -- tests/cli.test.ts -t "desync|rollback"`
- Passed: `pnpm build`
- Passed: `pnpm test` (31 files, 613 tests)
- Skipped: none

## PlaySpec

- Task ID: `issue_249_quoted_git_paths`
- Workflow: `mono-spec`

## Risks / Follow-Ups

- The legacy line-oriented parser exports remain for existing compatibility/tests, but production rollback/desync collection now uses NUL-delimited Git output.
- Branch divergence continues to use human-readable branch status text, which is not a file path source.
