# MCP Task Lookup Desync Result

## Files Changed

- `src/mcp/workspace-diagnostics.ts`
- `src/mcp/server.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/github_issue_118_mcp_task_lookup_desync/spec.md`
- `docs/features/github_issue_118_mcp_task_lookup_desync/plan.md`
- `docs/features/github_issue_118_mcp_task_lookup_desync/result.md`

## Behavior Implemented

- Added MCP workspace diagnostics for task inventory and explicit task lookup.
- Added optional `workspaceRoot` argument to read-only MCP task tools:
  - `playspec_list_tasks`
  - `playspec_get_task`
- Resolved relative `workspaceRoot` values against the MCP server startup workspace.
- Scoped `YamlTaskStore` per read-only request so MCP can list/get tasks from an explicitly supplied workspace.
- Included diagnostics in successful list/get responses while preserving `playspec_get_task` task fields at the response top level:
  - server workspace root
  - effective workspace root
  - `.playspec` path
  - active HEAD value, diagnostic-only
  - task search paths
  - cache status
- Included the same diagnostics in `playspec_get_task` error text when lookup fails.

## Boundary Notes

- `resolveMcpTaskId()` was not changed.
- MCP task-context tools still require explicit `taskId` or `sessionId`.
- MCP does not use `.playspec/HEAD` for task resolution; HEAD is read only for diagnostics.
- Mutation/lifecycle tools remain bound to the server workspace and were not given workspace overrides in this issue.

## Verification Performed

- `pnpm install`
- `pnpm vitest run tests/integration/mcp-server.test.ts`
  - Passed: 35 tests
- `pnpm build`
  - Passed
- `pnpm test`
  - Passed: 24 test files, 436 tests
- Safe-refactor phase review:
  - Compared branch diff against `origin/master`.
  - No additional refactor was applied; the implementation is already localized to MCP task tool wiring, diagnostics, and focused tests.
  - Reran `pnpm vitest run tests/integration/mcp-server.test.ts`; passed 35 tests.

## Remaining Risks

- Diagnostics intentionally include absolute local paths to satisfy the issue acceptance criteria.
- Optional `workspaceRoot` is limited to read-only task inventory/lookup. If mutation tools need cross-workspace support later, they should get a separate safety design.

## PR

- Draft PR: https://github.com/cksdnr1/playspec/pull/119
- Branch: `agent/issue-118-mcp-task-lookup`
- Reusable agent guidance: no new reusable guidance is needed; this was a scoped MCP diagnostics/API parity fix.
