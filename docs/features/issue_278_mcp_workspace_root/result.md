# Issue 278 MCP Workspace Root Result

## Files Changed

- `src/mcp/server.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_278_mcp_workspace_root/spec.md`
- `docs/features/issue_278_mcp_workspace_root/plan.md`
- `docs/features/issue_278_mcp_workspace_root/result.md`

## Behavior Implemented

- Added optional `workspaceRoot` to the shared MCP task context schema.
- Added `workspaceRoot` support to `playspec_use_session_task` and `playspec_get_session_task`.
- Added scoped MCP task dependencies per request:
  - `YamlTaskStore`
  - `PlaySpecCore`
  - `McpSessionStore`
  - `TaskIdResolver`
- Updated task-scoped MCP handlers to resolve and execute against the effective workspace root instead of always using the MCP server root.
- Preserved `resolveMcpTaskId()` as the task/session resolution boundary for MCP task tools.
- Kept existing behavior unchanged when `workspaceRoot` is omitted.

## Verification Performed

- `pnpm exec vitest run tests/integration/mcp-server.test.ts`
  - Passed: 63 tests.
- `pnpm build`
  - Passed.
- `pnpm test`
  - Started and reported visible suites passing through `tests/integration/task-links.test.ts`.
  - Hung in a spawned CLI `complete` process after visible suite output stopped.
  - Terminated manually and recorded as a full-suite hang rather than a clean pass.

## Regression Coverage

Added `runs task phase tools against an explicit workspace when the server workspace differs` in `tests/integration/mcp-server.test.ts`.

The test verifies:
- Session binding with `workspaceRoot` stores the session in the project workspace, not the server workspace.
- `playspec_get_session_task` reads the project workspace session and task.
- `playspec_render_next_prompt` renders a project-local task by session id and `workspaceRoot`.
- `playspec_complete_phase` progresses a project-local task by `taskId` and `workspaceRoot`.
- `playspec_collect_evidence` writes evidence under the project-local task root.

## Remaining Risks

- MCP clients must still pass `workspaceRoot` for task/session operations when the task is outside the server root. The implementation does not infer workspace roots from bare task ids.
- Full `pnpm test` did not complete cleanly because of the observed post-suite hang. Targeted MCP coverage and build passed.

## Safe Refactor Review

- Compared the implementation scope against `origin/master` and the approved plan.
- No additional refactor was applied. The current helper is local to `buildMcpServer()` and avoids broader abstraction churn.
- Skipped adding a dependency cache for scoped MCP contexts because the current per-request construction matches existing `get/list` behavior and keeps lifetime semantics simple.
