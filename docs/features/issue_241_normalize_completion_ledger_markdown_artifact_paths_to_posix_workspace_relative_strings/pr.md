# PR: Normalize Completion Ledger Markdown Artifact Paths

Fixes #241

## Summary

- Normalizes completion ledger markdown artifact display paths to `/` separators after joining the task root with task-root-relative artifact references.
- Keeps persisted completion event and task history artifact references task-root relative.
- Adds a host-independent regression test that simulates a Windows-style task root and verifies evidence, snapshot, and review markdown display paths.

## Changed Files

- `src/core/playspec-core.ts`
- `tests/integration/completion-engine.test.ts`
- `docs/features/issue_241_normalize_completion_ledger_markdown_artifact_paths_to_posix_workspace_relative_strings/spec.md`
- `docs/features/issue_241_normalize_completion_ledger_markdown_artifact_paths_to_posix_workspace_relative_strings/plan.md`
- `docs/features/issue_241_normalize_completion_ledger_markdown_artifact_paths_to_posix_workspace_relative_strings/result.md`
- `docs/features/issue_241_normalize_completion_ledger_markdown_artifact_paths_to_posix_workspace_relative_strings/pr.md`

## Tests Run

- `pnpm test -- tests/integration/completion-engine.test.ts`
  - Failing before fix on the new regression.
  - Passing after fix: 27 tests.
- `pnpm test -- tests/integration/routing.test.ts`
  - Passing: 25 tests.
- `pnpm test`
  - Passing: 30 files, 606 tests.
- `pnpm build`
  - Passing.

## PlaySpec Task

`issue_241_normalize_completion_ledger_markdown_artifact_paths_to_posix_workspace_relative_strings`

## Risk Notes

- Existing completion markdown files are not rewritten; only newly generated markdown is normalized.
- Storage contracts remain unchanged: completion ledger index and task history artifact references stay task-root relative.
- No reusable agent guidance needs to be documented for this change because it is a narrow display-path rendering fix.
