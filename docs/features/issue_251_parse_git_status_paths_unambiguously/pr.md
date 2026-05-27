# Draft PR

Fixes #251

## Summary

- Switch workspace changed-file evidence parsing to `git status --porcelain=v1 -z --untracked-files=all`.
- Parse NUL-delimited status entries by status code so normal paths containing ` -> ` stay literal.
- Preserve existing rename evidence output as `originalPath -> path`.
- Add parser and completion-engine regression coverage for delimiter-containing paths and NUL-delimited rename entries.

## Changed Files

- `src/core/git-state.ts`
- `tests/unit/git-state.test.ts`
- `tests/integration/completion-engine.test.ts`
- `docs/features/issue_251_parse_git_status_paths_unambiguously/spec.md`
- `docs/features/issue_251_parse_git_status_paths_unambiguously/plan.md`
- `docs/features/issue_251_parse_git_status_paths_unambiguously/result.md`
- `docs/features/issue_251_parse_git_status_paths_unambiguously/pr.md`

## Tests Run

- `pnpm vitest run tests/unit/git-state.test.ts`
- `pnpm vitest run tests/integration/completion-engine.test.ts`
- `pnpm build`
- `pnpm test`
- `pnpm vitest run tests/unit/git-state.test.ts` after safe-refactor review

## PlaySpec Task ID

`issue_251_parse_git_status_paths_unambiguously`

## Risk Notes

- Changed-files evidence remains newline-delimited, so filenames containing literal newlines remain outside this fix.
- `parseNameStatus()` still parses `git diff --name-status` text output because issue #251 targets workspace changed-files evidence from `git status`.

## Reusable Agent Guidance

No reusable agent guidance update is needed. The existing repository rules already cover scoped implementation, PlaySpec workflow use, and path/import boundaries.
