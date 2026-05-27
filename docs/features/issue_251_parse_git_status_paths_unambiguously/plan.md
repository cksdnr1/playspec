# Implementation Plan

## Ordered Steps

1. Update workspace status collection in `src/core/git-state.ts`.
   - Change `GitState.getWorkspaceState()` to run `git status --porcelain=v1 -z --untracked-files=all`.
   - Keep `branchStatus` unchanged with `git status --short --branch --untracked-files=all`.

2. Refactor `parsePorcelain()` in `src/core/git-state.ts`.
   - Detect NUL-delimited output with `output.includes('\0')`.
   - Add a NUL parser that walks fields in order and preserves literal paths.
   - For status codes beginning with `R` or `C`, parse the destination from the status record and consume the following field as `originalPath`.
   - For all other status entries, consume exactly one path from the status record.
   - Keep existing text parser support for unit tests and compatibility.

3. Preserve evidence serialization.
   - Leave `statusEntryPathList()` formatting unchanged.
   - Expected normal line: `docs/source -> target.md`.
   - Expected rename line: `src/old-name.ts -> src/new-name.ts`.

4. Add parser unit tests in `tests/unit/git-state.test.ts`.
   - NUL-delimited untracked path containing ` -> ` stays a single literal path.
   - NUL-delimited modified path containing spaces or shell-sensitive characters stays literal.
   - NUL-delimited rename returns `{ originalPath, path }` in the existing evidence order.

5. Add integration coverage in `tests/integration/completion-engine.test.ts`.
   - Create a non-renamed changed file with a path containing ` -> `.
   - Collect manual evidence through `PlaySpecCore.collectEvidence(taskId)`.
   - Assert `phase1_manual_changed_files.txt` contains the exact literal path and does not contain a fabricated rename line.
   - Keep the existing tracked rename evidence test passing.

6. Validate.
   - Run focused parser unit tests.
   - Run focused completion-engine tests.
   - Run `pnpm build`.
   - Run `pnpm test` if focused tests and build pass.

7. Document results.
   - Write `result.md` with changed files, tests run, and risk notes.
   - Write `pr.md` with the required draft PR body.

## Files To Edit

- `src/core/git-state.ts`
- `tests/unit/git-state.test.ts`
- `tests/integration/completion-engine.test.ts`
- `docs/features/issue_251_parse_git_status_paths_unambiguously/result.md`
- `docs/features/issue_251_parse_git_status_paths_unambiguously/pr.md`

## Active Path Trace

`PlaySpecCore.collectEvidence()` / `completePhase()` -> `writeEvidence()` -> `GitState.getWorkspaceState()` -> `parsePorcelain()` -> `statusEntryPathList()` -> `evidence/phase*_changed_files.txt`.

The implementation changes the data collection/parsing step only. The artifact writer and filename conventions remain unchanged.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: text porcelain parsing with delimiter-sensitive path token parsing.
- Bypass risk: changing only `statusEntryPathList()` would still leave `GitStatusEntry` corrupted for desync and rollback consumers.
- Partial migration risk: parsing NUL output for normal paths but not rename/copy status codes would regress the existing rename evidence behavior.
- Compatibility risk: direct `parsePorcelain()` unit tests currently pass text porcelain strings, so text support should remain.

## Tests To Add Or Update

- `tests/unit/git-state.test.ts`
  - Add status-code-aware `-z` parser cases for ordinary delimiter-containing paths and real renames.

- `tests/integration/completion-engine.test.ts`
  - Add manual evidence regression for a non-rename ` -> ` path.
  - Do not remove or weaken the existing rename evidence test.

## Risks

- Git v1 `-z` rename field order is destination in the status record and original path in the next NUL field. The unit and integration rename tests must lock down the public `GitStatusEntry` shape.
- Newline-containing filenames still cannot be represented unambiguously in newline-delimited changed-files evidence. This issue only removes the ` -> ` delimiter ambiguity.
- `GitState.getWorkspaceState()` is shared by evidence, desync, and rollback. The returned entry shape must remain compatible.

## Rollback Notes

If the parser change causes unexpected status interpretation, revert the `getWorkspaceState()` command and `parsePorcelain()` refactor together. The evidence serializer can remain untouched because it is not changing.

## Completion Criteria

- Non-rename changed paths containing ` -> ` appear literally in changed-files evidence.
- Real rename entries still appear as `originalPath -> path`.
- Unit tests cover NUL-delimited normal and rename entries.
- Focused completion-engine coverage and existing rename test pass.
- Build and repository test commands are reported with pass/fail status.
