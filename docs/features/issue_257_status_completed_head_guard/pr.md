Fixes #257

## Summary

- Add a HEAD-only active-task guard to `playspec status` before any status rendering.
- Make `playspec status --quiet` reject completed HEAD tasks through the same path.
- Document that explicit completed task inspection still works via `playspec status <taskId>`.

## Changed Files

- `src/cli/commands/status.ts`
- `tests/cli.test.ts`
- `docs/features/issue_257_status_completed_head_guard/spec.md`
- `docs/features/issue_257_status_completed_head_guard/plan.md`
- `docs/features/issue_257_status_completed_head_guard/result.md`
- `docs/features/issue_257_status_completed_head_guard/pr.md`

## Tests Run

- `pnpm exec vitest run tests/cli.test.ts -t "status"`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `issue_257_status_completed_head_guard`

## Risk Notes

- Intentional compatibility change: bare `playspec status` now rejects completed HEAD tasks. Users can still inspect a completed task explicitly by passing its task id.
- No storage, migration, archive, MCP, or link semantics were changed.

## Reusable Agent Guidance

- No reusable agent guidance update is needed. This is a narrow command-local lifecycle guard.
