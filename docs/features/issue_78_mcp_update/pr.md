# PR Draft: Issue 78 MCP Update

Fixes #78

## Summary

- Updated the MCP server with current PlaySpec task lifecycle, snapshot, rollback, harness, evolution proposal, and human-edit tools through 7.1.
- Preserved explicit MCP `taskId` / `sessionId` context resolution and kept archive/migration out of MCP scope.
- Added explicit mutation gates for MCP git rollback (`confirm: true`) and evolution apply (`approved: true`).
- Updated MCP integration tests and README tool documentation.

## Changed Files

- `src/mcp/server.ts`
- `tests/integration/mcp-server.test.ts`
- `README.md`
- `docs/features/issue_78_mcp_update/spec.md`
- `docs/features/issue_78_mcp_update/plan.md`
- `docs/features/issue_78_mcp_update/result.md`
- `docs/features/issue_78_mcp_update/pr.md`
- `.playspec/` task evidence and prompt snapshots for `issue_78_mcp_update`

## Tests Run

- `pnpm build`
- `pnpm vitest run tests/integration/mcp-server.test.ts`
- `pnpm test`

## PlaySpec Task

- `issue_78_mcp_update`

## Risk Notes

- MCP now exposes git rollback and evolution apply paths; both require explicit boolean confirmation and route through existing guarded services.
- Proposal generation returns `invokedBy: "mcp"` in the tool response while preserving existing persisted generator metadata.
- Archive and migration remain CLI-only.

## Reusable Agent Guidance

No reusable agent guidance update is needed. The existing project rule that MCP must use `resolveMcpTaskId()` and avoid `.playspec/HEAD` remains sufficient.
