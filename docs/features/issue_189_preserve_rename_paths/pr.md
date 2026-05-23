# Draft PR: Preserve Rename Sources in Changed-Files Evidence

Fixes #189

## Summary

- Preserve both sides of Git rename entries in PlaySpec changed-files evidence as `old-path -> new-path`.
- Keep ordinary changed-files entries as plain paths and keep evidence filenames unchanged.
- Add integration coverage that renames a tracked file and asserts manual changed-files evidence includes the original and destination paths.

## Changed Files

- `src/core/git-state.ts`
- `tests/integration/completion-engine.test.ts`
- `docs/features/issue_189_preserve_rename_paths/spec.md`
- `docs/features/issue_189_preserve_rename_paths/plan.md`
- `docs/features/issue_189_preserve_rename_paths/result.md`
- `docs/features/issue_189_preserve_rename_paths/pr.md`

## Tests Run

- `pnpm exec vitest run tests/integration/completion-engine.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `preserve_original_paths_for_renamed_files_in_playspec_changed_files_evidence`

## Risk Notes

- Rename lines now use `old-path -> new-path`. Consumers that assumed every changed-files line is exactly one literal path need to handle this rename format.
- Non-rename lines and evidence artifact filenames are unchanged.

## Reusable Agent Guidance

- No new reusable agent guidance is needed. The issue is a focused serializer/test regression and does not introduce a recurring workflow rule.
