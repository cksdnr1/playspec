Fixes #278

## Summary

- Adds `workspaceRoot` support to MCP task/session context so project-local tasks can be progressed from a server rooted elsewhere.
- Routes task-scoped MCP handlers through scoped `YamlTaskStore`, `McpSessionStore`, `TaskIdResolver`, and `PlaySpecCore` instances.
- Adds regression coverage for session binding, prompt rendering, phase completion, and evidence collection against an explicit workspace.

## Why This PR

MCP lookup tools already accepted `workspaceRoot`, but phase/progress tools still resolved tasks against the MCP server root. That blocked MCP-only workflow execution when the task lived under a project workspace different from the server process cwd.

## Problem

`playspec_get_task({ taskId, workspaceRoot })` and `playspec_list_tasks({ workspaceRoot })` could find project-local tasks, but `playspec_render_next_prompt`, `playspec_complete_phase`, `playspec_collect_evidence`, and session binding used server-root dependencies. The result was a misleading "No task found matching" error for valid tasks outside the server root.

## How It Was Fixed

- `src/mcp/server.ts`
  - Extends shared task context with optional `workspaceRoot`.
  - Adds `workspaceRoot` to `playspec_use_session_task` and `playspec_get_session_task`.
  - Resolves an effective workspace root per task-scoped request.
  - Constructs scoped task store, session store, task id resolver, and core instances for that request.
  - Keeps `resolveMcpTaskId()` in the task/session resolution path.

- `tests/integration/mcp-server.test.ts`
  - Adds an explicit-workspace regression where the MCP server root differs from the target task workspace.
  - Verifies project-root session binding, session lookup, render, completion, and evidence collection.

## Validation

- `pnpm exec vitest run tests/integration/mcp-server.test.ts` - passed, 63 tests.
- `pnpm build` - passed.
- `pnpm test` - started; visible suites passed through `tests/integration/task-links.test.ts`, then the run hung in a spawned CLI `complete` process and was terminated. Not counted as a pass.
- `git diff --check` - passed.

## Risks / Follow-Ups

- Clients still need to pass `workspaceRoot` for task/session operations when the task is outside the server root; this PR does not infer roots from bare task IDs.
- Full-suite validation did not complete cleanly because of the observed hang, but targeted MCP coverage and build passed.

## PlaySpec Task

- `issue_278_mcp_workspace_root`
