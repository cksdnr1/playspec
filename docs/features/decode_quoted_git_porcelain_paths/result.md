# Decode Quoted Git Porcelain Paths Result

## Implementation Summary

- Added Git porcelain v1 quoted path decoding in `src/core/git-state.ts`.
- `parsePorcelain()` now stores decoded `GitStatusEntry.path` and `originalPath` values.
- Ordinary unquoted paths still return unchanged.
- Rename entries still serialize as `originalPath -> path`, with both sides decoded when Git emits quoted path tokens.
- Malformed quoted syntax falls back to the raw token instead of throwing during evidence collection.
- Octal byte escapes are decoded as UTF-8 so Git-quoted non-ASCII bytes become usable workspace-relative paths.

## Tests Changed

- Added `tests/unit/git-state.test.ts` with coverage for:
  - ordinary unquoted porcelain paths
  - quoted tab path decoding
  - quoted octal UTF-8 byte decoding
  - ordinary rename parsing
  - quoted rename source and destination decoding
  - malformed quoted path fallback

## Commands Run

- `pnpm install`
- `pnpm test -- tests/unit/git-state.test.ts`
  - Initial run failed before implementation as expected: quoted path and quoted rename cases retained Git quotes/escapes.
- `pnpm test -- tests/unit/git-state.test.ts`
  - Passed after implementation: 6 tests.
- `pnpm test -- tests/integration/completion-engine.test.ts`
  - Passed: 16 tests.
- `pnpm build`
  - Passed.
- `pnpm test`
  - Passed: 25 files, 529 tests.

## Skipped Commands

- None. The focused parser test, relevant completion evidence regression, full suite, and build all ran.

## Remaining Gaps

- No end-to-end filesystem test creates an actual tab-containing filename and reads changed-files evidence. The direct parser test covers the Git porcelain input shape, and the existing completion evidence test covers serialization of parsed entries.

## Risk Notes

- The change remains localized to porcelain parsing. Raw `phase*_git_status.txt` evidence remains raw Git output by design.
- `parseNameStatus()` was not changed because it is not the changed-files evidence path described by the issue.
