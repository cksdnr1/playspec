# Preserve Rename Paths in Changed-Files Evidence Implementation Plan

## Ordered Steps

1. Update changed-files serialization in `src/core/git-state.ts`.
   - Change `statusEntryPathList()` so entries with `originalPath` emit `originalPath -> path`.
   - Keep non-rename entries as plain `path`.
   - Keep one status entry per output line.

2. Add focused regression coverage in `tests/integration/completion-engine.test.ts`.
   - Use `initWorkspaceWithTask()` to create a tracked Git repository and PlaySpec task.
   - Add and commit `src/old-name.ts`.
   - Rename it with `git mv src/old-name.ts src/new-name.ts`.
   - Collect manual evidence or complete a phase through `PlaySpecCore`.
   - Read `evidence/phase1_manual_changed_files.txt` or the completion equivalent.
   - Assert the artifact contains `src/old-name.ts -> src/new-name.ts`.
   - Assert the artifact does not collapse to only `src/new-name.ts`.

3. Run focused validation.
   - `pnpm exec vitest run tests/integration/completion-engine.test.ts`
   - `pnpm build`
   - Run broader `pnpm test` if focused validation is clean and time permits.

4. Record implementation results.
   - Update `docs/features/issue_189_preserve_rename_paths/result.md` with changed files, tests run, and risk notes.

## Files to Edit

- `src/core/git-state.ts`
- `tests/integration/completion-engine.test.ts`
- `docs/features/issue_189_preserve_rename_paths/result.md`
- `docs/features/issue_189_preserve_rename_paths/pr.md`

## Tests to Add or Update

- Add one integration test in `tests/integration/completion-engine.test.ts` covering changed-files evidence for a tracked rename.
- Existing phase completion/manual evidence tests should keep passing because filenames and artifact arrays remain unchanged.

## Active Entry Point Trace

Manual evidence:

`PlaySpecCore.collectEvidence()` -> `writeEvidence()` -> `GitState.getWorkspaceState()` -> `parsePorcelain()` -> `statusEntryPathList()` -> `evidence/phase*_manual_changed_files.txt`

Phase completion:

`PlaySpecCore.completePhase()` -> `writeEvidence()` -> `GitState.getWorkspaceState()` -> `parsePorcelain()` -> `statusEntryPathList()` -> `evidence/phase*_changed_files.txt`

## Old Paths, Bypasses, and Partial Migration Risks

- Old path-loss point: `statusEntryPathList()` emits only `entry.path`.
- Bypass paths: rollback and desync already handle rename source and destination through separate helpers; do not change them.
- Partial migration risk: adding rename formatting only in a test helper or only in `PlaySpecCore` would miss other callers of `statusEntryPathList()`. Update the shared serializer instead.

## Risks

- Downstream consumers may parse changed-files evidence as one path per line. The implementation keeps one line per status entry and only changes rename lines to `old -> new`.
- Git rename detection in `git status --porcelain` depends on a tracked rename. Using `git mv` with unchanged content should produce a stable rename entry.

## Rollback Notes

Rollback is limited to reverting the serializer change and the new integration test/doc artifacts. Evidence filenames and task history references are not changed.

## Completion Criteria

- Rename entries in `phase*_changed_files.txt` preserve both original and destination paths.
- Non-rename entries remain plain paths.
- Evidence filenames are unchanged.
- Focused integration test and build pass.
