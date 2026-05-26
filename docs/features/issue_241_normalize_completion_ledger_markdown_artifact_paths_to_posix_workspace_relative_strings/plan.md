# Issue #241 Implementation Plan

## Ordered Steps

1. Add a failing regression test in `tests/integration/completion-engine.test.ts`.
   - Exercise `PlaySpecCore.completePhase()` with review enabled so evidence, snapshots, and review artifacts are all present.
   - Simulate Windows-style display joining in a host-independent way by forcing `task.paths.taskRoot` to contain backslashes before completion.
   - Assert generated completion markdown contains POSIX workspace-relative artifact paths for evidence and at least one snapshot or review artifact.
   - Assert the generated markdown artifact lines do not contain backslashes.
   - Assert persisted completion event values remain task-root-relative, for example `evidence/phase1_git_status.txt`, `snapshots/phase1_before_complete.yaml`, and `reviews/phase1_review.yaml`.

2. Update `src/core/playspec-core.ts`.
   - Keep `writeCompletionEvent()` event construction unchanged.
   - Replace the platform-specific display join in `renderCompletionMarkdown()` with display-only normalization.
   - Normalize only markdown display strings by converting `\` separators to `/` after joining task root and artifact reference.

3. Run focused validation.
   - `pnpm test -- tests/integration/completion-engine.test.ts`
   - If focused tests pass, run the repository test suite with `pnpm test`.
   - Run `pnpm build` before commit.

4. Record result and PR notes.
   - Update `result.md` with changed behavior and validation commands.
   - Update `pr.md` with PR body content including `Fixes #241`, changed files, tests, PlaySpec task id, and risk notes.

## Files To Edit

- `src/core/playspec-core.ts`
- `tests/integration/completion-engine.test.ts`
- `docs/features/issue_241_normalize_completion_ledger_markdown_artifact_paths_to_posix_workspace_relative_strings/result.md`
- `docs/features/issue_241_normalize_completion_ledger_markdown_artifact_paths_to_posix_workspace_relative_strings/pr.md`

## Tests To Add Or Update

- Add one integration regression test in `tests/integration/completion-engine.test.ts`.
- Keep the existing successful completion markdown test intact unless minor assertions are needed.
- The regression must verify evidence plus snapshot or review display paths.
- The regression must verify stored event paths remain task-root-relative.

## Active Path Trace

`PlaySpecCore.completePhase()` writes artifacts and calls `writeCompletionEvent()`. `writeCompletionEvent()` creates the persisted `CompletionEvent`, then calls `renderCompletionMarkdown()`. The markdown is written by `CompletionLedgerStore.appendEvent()` and is later shown by CLI read paths unchanged.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: `renderCompletionMarkdown()` uses `path.join()` directly for display paths.
- Bypass path: CLI `show-completion` and `log --markdown` only read stored markdown, so generation-time normalization is required.
- Partial migration risk: normalizing event arrays or task history would change the storage contract and must be avoided.

## Risks

- A test that depends on the host OS would miss the Windows separator regression on macOS/Linux.
- Applying separator replacement outside display path rendering could alter unrelated markdown.

## Rollback Notes

The implementation is a display-only helper change plus test coverage. Rollback is limited to reverting the helper change and regression test if needed; no data migration is involved.

## Completion Criteria

- Completion markdown artifact sections render `/` separators for evidence, snapshot, and review paths when the task root contains backslashes.
- Completion event and task history artifact references remain task-root-relative.
- Focused completion-engine tests pass.
- Build and repository test suite results are recorded.
