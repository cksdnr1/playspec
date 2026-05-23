# PR: Completed Source Link Guard

Fixes #157

## Summary

- Add the existing active-task lifecycle guard to core task link and unlink mutations.
- Cover explicit source IDs and HEAD/`--to` shorthand paths with CLI integration regressions.
- Assert completed source task `links` remain unchanged after rejected link/unlink commands.

## Changed Files

- `src/core/playspec-core.ts`
- `tests/integration/task-links.test.ts`
- `docs/issues/issue-157-completed-source-link-guard.md`
- `docs/features/issue_157_completed_source_link_guard/spec.md`
- `docs/features/issue_157_completed_source_link_guard/plan.md`
- `docs/features/issue_157_completed_source_link_guard/result.md`
- `docs/features/issue_157_completed_source_link_guard/pr.md`

## Tests Run

- `pnpm test -- tests/integration/task-links.test.ts`
- `pnpm build`
- `pnpm test`
- `git diff --check`

## PlaySpec Task

- `issue_157_completed_source_link_guard`

## Risk Notes

- Low risk. The change reuses the existing `TaskNotActiveError` guard and keeps target lookup behavior unchanged for active source tasks.
- No reusable agent guidance update is needed; this is a narrow lifecycle guard fix.
