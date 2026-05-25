# Decode Quoted Git Porcelain Paths Implementation Plan

## Ordered Steps

1. Add focused parser tests.
   - Create a direct unit test for `parsePorcelain()` if no existing file owns `src/core/git-state.ts`.
   - Assert ordinary unquoted paths remain unchanged.
   - Assert `?? "docs/name\\twithtab.md"` parses to `docs/name\twithtab.md`.
   - Assert rename entries still expose `originalPath` and destination `path`.
   - Assert quoted rename source and destination paths decode when emitted through the same parser.
   - Assert malformed quoted syntax falls back to the raw token instead of throwing.

2. Implement quoted porcelain path decoding in `src/core/git-state.ts`.
   - Keep `GitStatusEntry` unchanged.
   - Add a small helper that returns unquoted paths unchanged.
   - Decode quoted C-style escapes including tabs, quotes, backslashes, common control escapes, and octal byte escapes.
   - On malformed quoted syntax, return the original raw token.

3. Update rename parsing to use decoded tokens.
   - Preserve existing unquoted `old -> new` behavior.
   - Decode both sides when Git emits quoted source and/or destination paths.
   - Avoid changing evidence serialization names or `statusEntryPathList()` formatting.

4. Run focused validation.
   - Run the new parser test file.
   - Run `tests/integration/completion-engine.test.ts` because it covers changed-files evidence file creation and rename serialization.
   - Run full `pnpm test` if focused tests pass and time permits.
   - Run `pnpm build` before commit.

5. Record results and prepare PR.
   - Update `result.md` with implementation details, tests run, skipped tests, and risks.
   - Prepare `pr.md` with the required PR body fields.

## Files To Edit

- `src/core/git-state.ts`: parser helper and `parsePorcelain()` routing.
- `tests/core/git-state.test.ts` or nearest existing test location: focused parser coverage.
- `docs/features/decode_quoted_git_porcelain_paths/result.md`: implementation/test result.
- `docs/features/decode_quoted_git_porcelain_paths/pr.md`: PR preparation artifact.

## Tests To Add Or Update

- Unit coverage for ordinary unquoted porcelain path parsing.
- Unit coverage for quoted path decoding with a tab.
- Unit coverage for rename parsing preserving `originalPath` and destination.
- Unit coverage for quoted rename source/destination decoding.
- Unit coverage for malformed quoted syntax fallback.

Existing tests to run:

- New focused parser test file.
- `tests/integration/completion-engine.test.ts`.
- `pnpm build`.
- Full `pnpm test` if feasible.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: raw `line.slice(3)` currently flows directly into `GitStatusEntry.path`; the new helper must replace that direct assignment.
- Bypass path: raw `phase*_git_status.txt` evidence intentionally remains raw Git output.
- Partial migration risk: decoding only `entry.path` but not `originalPath` would leave rename evidence inconsistent.
- Partial migration risk: changing only `statusEntryPathList()` would leave desync detection consuming quoted paths, so the decode belongs in `parsePorcelain()`.

## Rollback Notes

The change is localized. Reverting `src/core/git-state.ts` and the focused parser tests restores prior behavior. Evidence artifact filenames and task state format are unchanged.

## Completion Criteria

- `parsePorcelain()` returns decoded workspace-relative paths for quoted Git porcelain paths.
- Ordinary unquoted paths serialize exactly as before.
- Rename entries keep destination `path` and `originalPath`, including decoded quoted path forms.
- Malformed quoted syntax does not throw during parsing.
- Focused parser tests and completion evidence regression tests pass.
