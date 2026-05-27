# Implementation Result

## Behavior Implemented

- `GitState.getWorkspaceState()` now collects changed-file status with `git status --porcelain=v1 -z --untracked-files=all`.
- `parsePorcelain()` now detects NUL-delimited porcelain output and parses entries by status code instead of guessing from the display delimiter.
- NUL-delimited rename/copy records preserve `originalPath` and destination `path` in the existing `GitStatusEntry` shape.
- Non-rename text parser compatibility remains, and ordinary text paths containing ` -> ` are no longer truncated.
- `statusEntryPathList()` and changed-files evidence filenames were left unchanged.

## Files Changed

- `src/core/git-state.ts`
- `tests/unit/git-state.test.ts`
- `tests/integration/completion-engine.test.ts`
- `docs/features/issue_251_parse_git_status_paths_unambiguously/spec.md`
- `docs/features/issue_251_parse_git_status_paths_unambiguously/plan.md`
- `docs/features/issue_251_parse_git_status_paths_unambiguously/result.md`

## Tests Added

- Unit coverage for an ordinary path containing ` -> `.
- Unit coverage for NUL-delimited ordinary paths containing ` -> `.
- Unit coverage for NUL-delimited paths with spaces and shell-sensitive characters.
- Unit coverage for NUL-delimited rename source/destination parsing.
- Integration coverage proving manual changed-files evidence preserves `docs/source -> target.md` as one literal non-rename path.

## Verification

- `pnpm vitest run tests/unit/git-state.test.ts` passed: 10 tests.
- `pnpm vitest run tests/integration/completion-engine.test.ts` passed: 27 tests.
- `pnpm build` passed.
- `pnpm test` passed: 30 test files, 610 tests.
- Safe-refactor verification reran `pnpm vitest run tests/unit/git-state.test.ts`, which passed: 10 tests.

## Refactor Review

- Reviewed the scoped parser/test diff and did not apply additional refactors.
- Intentionally skipped broader parsing changes to `parseNameStatus()` because workspace changed-files evidence is the issue scope.
- Intentionally left `statusEntryPathList()` unchanged to preserve existing artifact shape.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/252
- Branch: `agent/issue-251-git-status-paths`
- Reusable agent guidance: no update needed; existing repository instructions already cover this workflow and scoped implementation boundary.

## Remaining Risks

- Changed-files evidence remains newline-delimited, so filenames containing literal newlines are still not representable as one unambiguous artifact line. This was out of scope.
- `parseNameStatus()` still parses `git diff --name-status` text output; issue #251 only targeted workspace changed-files evidence from `git status`.
