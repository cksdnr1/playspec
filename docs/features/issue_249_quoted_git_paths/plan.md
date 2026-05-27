# Issue 249 Quoted Git Paths Implementation Plan

## Ordered Steps

1. Update `src/core/git-state.ts` command collection:
   - Change workspace file status collection to `git status --porcelain -z --untracked-files=all`.
   - Change committed file status collection to `git diff --name-status -z <base>..HEAD`.
   - Keep `git status --short --branch --untracked-files=all` only for branch divergence display/check text.

2. Add NUL-delimited parser helpers in `src/core/git-state.ts`:
   - Parse status records into existing `GitStatusEntry` shape.
   - Correctly handle rename/copy records where `-z` porcelain emits the destination path followed by the original path.
   - Parse name-status records into existing `GitNameStatusEntry` shape, including rename/copy records with two path fields.
   - Keep exported line parser compatibility only where tests or local helpers still use it; production callers should use the `-z` parser.

3. Keep rollback/desync consumers unchanged unless tests reveal path filtering assumptions:
   - `StateDesyncDetector` should continue consuming exact paths from `GitState`.
   - `RollbackManager` should continue comparing exact untracked paths to exact rollback target paths and passing exact target files to `git restore --`.

4. Add focused tests:
   - Unit parser tests for `parsePorcelainZ` and `parseNameStatusZ` with `src/quote"file.ts`, tab/UTF-8 examples, and rename/name-status records.
   - CLI `desync-check` test proving `Untracked files: src/quote"file.ts` appears exactly.
   - Rollback CLI or core test proving an untracked file with a quote conflicts with the exact committed deletion target.
   - Confirmed rollback test proving a quoted changed target is restored successfully when safety gates pass.

5. Run validation:
   - `pnpm test -- tests/unit/git-state.test.ts`
   - Relevant CLI tests for desync/rollback, using a targeted Vitest file/test-name run if possible.
   - `pnpm build`
   - Full `pnpm test` if targeted tests and build pass within reasonable time.

## Files To Edit

- `src/core/git-state.ts`
- `tests/unit/git-state.test.ts`
- `tests/cli.test.ts`
- `docs/features/issue_249_quoted_git_paths/result.md`
- `docs/features/issue_249_quoted_git_paths/pr.md`

## Tests To Add Or Update

- Existing ordinary path tests stay in place to prevent regression.
- Add machine-format parser tests for quoted path exactness.
- Add at least one name-status rename test because committed change parsing is changing.
- Add end-to-end CLI coverage for desync output and rollback plan/safety behavior.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: line-oriented `git status --porcelain` with C-style path token parsing.
- Old path: line-oriented `git diff --name-status` split by tab.
- Bypass: branch status text remains text output, but it is not a path source.
- Partial migration risk: only changing `parsePorcelain()` would leave committed name-status corrupted.
- Partial migration risk: changing parser helpers without changing `GitState` command arguments would not remove line-format ambiguity from production paths.

## Risks

- Git `status -z` rename field order is not the same as human-readable `old -> new`; tests must prove `originalPath` and `path` are mapped correctly.
- NUL parser code must ignore final empty tokens without dropping valid empty-adjacent records.
- `execa` stdout strings can carry NUL bytes, so no buffer mode change is expected.

## Rollback Notes

The code change is limited to parsing and Git command flags. If issues appear, rollback is a normal revert of the `GitState` parser changes and associated tests; no repository data migration is involved.

## Completion Criteria

- `GitState` production methods use machine-safe path formats.
- Desync output shows exact quoted-character paths.
- Rollback planning and confirmed restore operate on exact paths.
- Targeted tests and build pass, with any skipped commands reported explicitly.
