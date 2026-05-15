# MCP Task Lookup Desync Implementation Plan

## Ordered Steps

1. Add MCP task workspace diagnostics.
   - Create `src/mcp/workspace-diagnostics.ts`.
   - Export a `resolveMcpWorkspaceRoot(serverWorkspaceRoot, inputWorkspaceRoot?)` helper.
   - Export a `collectMcpWorkspaceDiagnostics(workspaceRoot)` helper with:
     - `workspaceRoot`
     - `playspecRoot`
     - `headTaskId`
     - `taskSearchPaths.active`
     - `taskSearchPaths.completed`
     - `taskSearchPaths.archived`
     - `cache.enabled = false`
     - `cache.status = "not used; task state is read from disk per request"`
   - Read `.playspec/HEAD` defensively only for diagnostics; do not use it to resolve task context.

2. Update read-only MCP task inventory and lookup tools.
   - In `src/mcp/server.ts`, update `playspec_list_tasks` to accept optional `{ workspaceRoot?: string }`.
   - In `src/mcp/server.ts`, update `playspec_get_task` to accept `{ taskId, workspaceRoot?: string }`.
   - For each call, resolve the effective workspace root and construct a scoped `YamlTaskStore` for that root.
   - Return diagnostics in successful list and get responses.
   - For `playspec_get_task` not-found/error responses, append diagnostics to the MCP error text so a caller can see which task root was searched.

3. Keep other MCP task-context tools unchanged.
   - Do not add workspace overrides to mutation/lifecycle tools in this issue.
   - Do not change `resolveMcpTaskId()`.
   - Do not call `ActiveTaskResolver` or use `.playspec/HEAD` for resolution in MCP.

4. Add regression tests in `tests/integration/mcp-server.test.ts`.
   - Verify a task created in one workspace can be retrieved by `playspec_get_task` when the MCP server was built for another workspace but `workspaceRoot` is provided.
   - Verify `playspec_list_tasks` can list that same explicit workspace and includes diagnostics.
   - Verify a missing task error includes the effective workspace root and active task search path.
   - Verify same-workspace lookup still works without a `workspaceRoot` argument.

5. Run validation.
   - Inspect scripts: `package.json` uses `pnpm build` and `pnpm test`.
   - Run focused MCP tests first.
   - Run full `pnpm build`.
   - Run full `pnpm test` if focused tests/build pass.

## Files To Edit

- `src/mcp/workspace-diagnostics.ts`
- `src/mcp/server.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/github_issue_118_mcp_task_lookup_desync/result.md`
- `docs/features/github_issue_118_mcp_task_lookup_desync/pr.md`

## Entry Point To User-Visible Behavior Trace

- MCP caller invokes `playspec_get_task` or `playspec_list_tasks`.
- Tool validates arguments with zod.
- Tool resolves effective workspace root from the optional input or server startup root.
- Tool constructs a `YamlTaskStore` for that root and reads task YAML from disk.
- Tool collects diagnostics from the same effective root.
- Success response returns task/list data plus diagnostics.
- Failure response includes the original PlaySpec error plus diagnostics showing the searched root/path.

There is no state update, persistence change, reset path, or cache invalidation path in this implementation because the tools remain read-only and `YamlTaskStore` has no cache.

## Old Paths, Bypasses, And Partial Migration Risks

- Old path: MCP task tools always used the startup `workspaceRoot` captured by `buildMcpServer()`.
- Bypass path: users could fall back to CLI or shell to query a different workspace. The explicit read-only `workspaceRoot` option closes this for inventory/lookup.
- Partial migration risk: other MCP mutation tools remain bound to the server workspace. This is intentional for this issue; extending workspace overrides to mutation tools would need a separate safety design.
- HEAD risk: diagnostics read HEAD but task resolution must remain independent of HEAD.

## Tests To Add

- `playspec_get_task retrieves an explicit workspace task when the server workspace differs`
- `playspec_list_tasks lists an explicit workspace and returns diagnostics`
- `playspec_get_task includes workspace diagnostics when a task is missing`
- `playspec_get_task returns diagnostics for same-workspace success`

## Risks

- Absolute paths in diagnostics can expose local paths to the MCP caller. This is acceptable for local developer tooling and is part of the issue acceptance criteria.
- Optional `workspaceRoot` can point outside the server startup workspace. That is needed to support MCP servers launched from a different cwd; the tools are read-only.
- Broadening workspace overrides to mutation tools would require additional authorization/ownership rules and is out of scope.

## Rollback Notes

The change is localized. Reverting `src/mcp/workspace-diagnostics.ts`, the task-tool schema/body edits in `src/mcp/server.ts`, and the added MCP tests restores prior behavior.

## Completion Criteria

- MCP `playspec_get_task({ taskId, workspaceRoot })` can retrieve a CLI-created task from that workspace even if the server was built with a different root.
- MCP `playspec_list_tasks({ workspaceRoot })` returns active/completed inventory for the effective workspace with diagnostics.
- Missing task errors include effective workspace root and task search path.
- Existing no-HEAD-fallback tests still pass.
- Focused MCP tests, build, and full test suite pass or any failure is reported with exact command/output summary.
