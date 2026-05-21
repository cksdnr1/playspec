# Draft PR Notes

Fixes #118

## Summary

- Added MCP workspace diagnostics for read-only task inventory and explicit task lookup while preserving top-level task fields in `playspec_get_task`.
- Added optional `workspaceRoot` support to `playspec_list_tasks` and `playspec_get_task` so callers can query the same `.playspec` store used by CLI-created tasks when the MCP server was launched from a different cwd.
- Preserved MCP no-HEAD-fallback behavior; HEAD is reported only as diagnostic context.
- Added integration regression coverage for same-workspace lookup, explicit workspace lookup/listing, and not-found diagnostics.

## Changed Files

- `src/mcp/workspace-diagnostics.ts`
- `src/mcp/server.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/github_issue_118_mcp_task_lookup_desync/spec.md`
- `docs/features/github_issue_118_mcp_task_lookup_desync/plan.md`
- `docs/features/github_issue_118_mcp_task_lookup_desync/result.md`
- `docs/features/github_issue_118_mcp_task_lookup_desync/pr.md`

## Tests Run

- `pnpm install`
- `pnpm vitest run tests/integration/mcp-server.test.ts`
- `pnpm build`
- `pnpm test`

## PlaySpec Task

- `github_issue_118_mcp_task_lookup_desync`

## Risk Notes

- Diagnostics intentionally include absolute local paths to explain workspace/store mismatches.
- The `workspaceRoot` override is limited to read-only MCP list/get task tools; mutation tools remain server-workspace scoped.
- Reusable agent guidance: no new reusable guidance is needed; this is a concrete MCP diagnostics/API parity fix.
