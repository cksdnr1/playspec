# Issue 278 MCP Workspace Root Implementation Plan

## Ordered Steps

1. Add workspace-aware task context in `src/mcp/server.ts`.
   - Add optional `workspaceRoot` to `taskContext`.
   - Add optional `workspaceRoot` to `playspec_use_session_task` and `playspec_get_session_task`.
   - Keep existing callers compatible when `workspaceRoot` is omitted.

2. Add scoped MCP dependency helpers in `buildMcpServer()`.
   - Resolve the effective root with `resolveMcpWorkspaceRoot(serverRoot, args.workspaceRoot)`.
   - Construct scoped `YamlTaskStore`, `PlaySpecCore`, `McpSessionStore`, and `TaskIdResolver`.
   - Add a helper that calls `resolveMcpTaskId(args, scopedSessionStore, scopedTaskIdResolver)` and returns the scoped core plus canonical task id.

3. Update task-scoped handlers to use the scoped helper.
   - `playspec_use_session_task`
   - `playspec_get_session_task`
   - `playspec_link_tasks`
   - `playspec_unlink_tasks`
   - `playspec_render_next_prompt`
   - `playspec_render_phase_prompt`
   - `playspec_complete_phase`
   - `playspec_collect_evidence`
   - `playspec_run_state_desync_check`
   - `playspec_rollback_state`
   - `playspec_add_context`
   - `playspec_set_current_phase`
   - `playspec_create_snapshot`
   - `playspec_plan_rollback`
   - `playspec_execute_git_rollback`
   - `playspec_get_harness_status`
   - `playspec_record_harness_attempt`
   - `playspec_reset_harness`
   - `playspec_generate_evolution_proposal`

4. Preserve required MCP resolution boundaries.
   - Do not introduce `ActiveTaskResolver`.
   - Do not read `.playspec/HEAD` from MCP task resolution.
   - Continue resolving task ids and sessions through `resolveMcpTaskId()`.

5. Add integration regression coverage in `tests/integration/mcp-server.test.ts`.
   - Server root differs from target workspace root.
   - `playspec_use_session_task({ workspaceRoot })` binds a project-local session to the canonical task id.
   - `playspec_render_next_prompt({ workspaceRoot, sessionId })` renders the project-local task.
   - `playspec_complete_phase({ workspaceRoot, taskId })` progresses the project-local task.
   - `playspec_collect_evidence({ workspaceRoot, taskId })` writes evidence under the project-local task root.

## Files To Edit

- `src/mcp/server.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_278_mcp_workspace_root/result.md`
- `docs/features/issue_278_mcp_workspace_root/pr.md`

## Tests To Run

- `pnpm exec vitest run tests/integration/mcp-server.test.ts`
- `pnpm build`
- `pnpm test`

If full `pnpm test` is too slow or hangs, report the partial result and rerun the targeted MCP suite plus build.

## Old Paths And Bypasses To Close

- Server-root `TaskIdResolver` for phase tools.
- Server-root `McpSessionStore` for project-local session binding.
- Server-root `PlaySpecCore` for prompt/completion/evidence operations.
- Link/unlink target task resolution against the wrong workspace.

## Risks

- Session ids are workspace-scoped because session files live under each workspace `.playspec/sessions` directory. Callers must pass `workspaceRoot` when using a session bound outside the server root.
- Instantiating scoped dependencies per call is intentionally simple and consistent with existing lookup tool behavior.
- Existing server-root behavior must remain unchanged for clients that omit `workspaceRoot`.

## Rollback Notes

The implementation is localized to MCP server handler dependency selection and tests. Reverting `src/mcp/server.ts` and the MCP test additions restores previous behavior.

## Completion Criteria

- Task-scoped MCP tools accept `workspaceRoot` where applicable.
- A server rooted in one temp workspace can bind, render, complete, and collect evidence for a task in another temp workspace.
- Existing MCP same-root tests continue to pass.
- No MCP code reads `.playspec/HEAD` or calls `ActiveTaskResolver` for context resolution.
