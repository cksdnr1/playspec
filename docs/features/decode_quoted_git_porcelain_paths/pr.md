# PR Preparation

## Title

Decode quoted Git porcelain paths in changed-files evidence

## Body

Fixes #213

## Summary

- Decode Git porcelain v1 quoted path tokens before storing `GitStatusEntry.path` and `originalPath`.
- Preserve ordinary unquoted path behavior and existing changed-files evidence formatting.
- Add focused parser coverage for quoted paths, quoted renames, UTF-8 octal escapes, and malformed quoted fallback.

## Changed Files

- `src/core/git-state.ts`
- `tests/unit/git-state.test.ts`
- `docs/features/decode_quoted_git_porcelain_paths/spec.md`
- `docs/features/decode_quoted_git_porcelain_paths/plan.md`
- `docs/features/decode_quoted_git_porcelain_paths/result.md`
- `docs/features/decode_quoted_git_porcelain_paths/pr.md`

## Tests Run

- `pnpm test -- tests/unit/git-state.test.ts`
- `pnpm test -- tests/integration/completion-engine.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task ID

- `decode_quoted_git_porcelain_paths`

## Risk Notes

- Raw Git status evidence remains unchanged; only parsed path values used by simplified changed-files evidence and downstream `GitStatusEntry` consumers are decoded.
- Malformed quoted paths fall back to raw path text instead of failing evidence collection.
