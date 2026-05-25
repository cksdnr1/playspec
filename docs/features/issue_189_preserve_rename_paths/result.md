# Preserve Rename Paths in Changed-Files Evidence Result

## Behavior Implemented

- Changed `statusEntryPathList()` so rename entries are serialized as `originalPath -> path`.
- Left non-rename entries as plain paths.
- Preserved existing evidence filenames and phase history references.
- Added integration coverage proving manual changed-files evidence includes both sides of a tracked Git rename.

## Files Changed

- `src/core/git-state.ts`
- `tests/integration/completion-engine.test.ts`
- `docs/features/issue_189_preserve_rename_paths/spec.md`
- `docs/features/issue_189_preserve_rename_paths/plan.md`
- `docs/features/issue_189_preserve_rename_paths/result.md`

## Verification Performed

- `pnpm exec vitest run tests/integration/completion-engine.test.ts`
  - Passed: 16 tests.
- `pnpm build`
  - Passed.
- `pnpm test`
  - Passed: 24 test files, 508 tests.

## Remaining Risks

- Consumers that parse changed-files evidence as one literal path per line must treat rename lines as `old -> new`. The artifact remains one status entry per line, and non-rename behavior is unchanged.

## Safe Refactor Review

- Compared the scoped diff against `origin/master`.
- No refactor was applied: the implementation is already localized to the shared serializer and one regression test.
- Skipped broader evidence artifact or parser changes because they are outside the issue scope.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/190

## Skipped Validation

- No repository-relevant validation was intentionally skipped.
