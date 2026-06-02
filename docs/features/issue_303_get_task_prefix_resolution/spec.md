# Issue #303 Technical Spec

## Scope

Update only MCP `playspec_get_task` task lookup routing so `taskId` accepts exact task IDs and unique task ID prefixes in the selected workspace. Preserve existing workspaceRoot scoping, diagnostics, error formatting, and CLI behavior.

Out of scope:

- No `.playspec/HEAD` fallback for MCP.
- No CLI lookup behavior changes.
- No session storage or task ID matching rule changes.
- No unrelated MCP workflow, evolution, migration, or rollback changes.

## Use Case Alignment

MCP callers can already pass unique task ID prefixes to task-context operations such as prompt rendering and session binding. The read-only task inspection tool should accept the same reference form so a caller can inspect a task with the same prefix it used to route prompt/session operations.

## High-Level Current Implementation Summary

Verified behavior:

- `src/mcp/context.ts` resolves explicit `taskId` values by validating the MCP task ID and calling `TaskIdResolver.resolve()`.
- `src/mcp/server.ts` creates a scoped `TaskIdResolver` from the `workspaceRoot`-selected `YamlTaskStore`.
- `playspec_render_next_prompt` and other task-context tools use the shared scoped resolver path.
- `playspec_use_session_task` resolves the input task ID through `TaskIdResolver` before storing the canonical ID.
- `playspec_get_task` is registered separately and currently calls `scopedTaskStore.getTask(args.taskId)` directly.

Inferred behavior:

- Unique prefixes fail only for `playspec_get_task` because `YamlTaskStore.getTask()` requires an exact task folder ID.
- Ambiguous prefixes currently likely surface as missing tasks instead of `TaskIdResolver` ambiguity guidance.

## Relevant Files Reviewed

- `src/mcp/server.ts`: MCP tool registration and `playspec_get_task` implementation.
- `src/mcp/context.ts`: shared MCP task context resolution.
- `src/core/task-id-resolver.ts`: exact/prefix task ID resolution and ambiguity/missing errors.
- `tests/integration/mcp-server.test.ts`: MCP handler integration tests and existing exact/explicit workspace coverage.
- `README.md`: MCP task reference guidance already documents exact IDs and unique prefixes.

## Active Entry Points And Bypasses

Active entry points:

- `playspec_get_task({ taskId, workspaceRoot? })`
- `playspec_render_next_prompt({ taskId?, sessionId?, workspaceRoot? })`
- `playspec_use_session_task({ taskId, sessionId, workspaceRoot? })`

Bypass:

- `playspec_get_task` bypasses `resolveMcpTaskId()` and `TaskIdResolver`, so prefix resolution is inconsistent with the other MCP task-reference paths.

## Current Architecture

`buildMcpServer(workspaceRoot)` resolves an effective workspace per request when `workspaceRoot` is provided. For task-context tools, it builds a scoped `YamlTaskStore`, `McpSessionStore`, and `TaskIdResolver` for that effective workspace. Diagnostics are collected from the server workspace and effective workspace and appended to success or error responses.

## Verified Behavior

- Exact `playspec_get_task` lookup has integration coverage and returns diagnostics.
- Explicit `workspaceRoot` lookup has integration coverage and uses the selected workspace in returned diagnostics.
- `TaskIdResolver.resolve()` returns canonical IDs for exact and unique prefix matches, throws `AmbiguousTaskIdError` for multiple matches, and throws `TaskIdResolutionError` for no matches.
- `README.md` already states MCP task references resolved through task context accept exact task IDs or unique task ID prefixes.

## Problem

`playspec_get_task` is a task inspection operation but does not use the scoped task ID resolver. This makes prefix references accepted by other MCP task operations fail in the read-only lookup path and weakens the README contract.

## Proposed Direction

In `playspec_get_task`, keep the existing effective workspace and diagnostics collection, then:

1. Create the scoped `YamlTaskStore` for the effective workspace.
2. Resolve `args.taskId` through `new TaskIdResolver(scopedTaskStore).resolve(args.taskId)`.
3. Fetch the task with the canonical `resolved.taskId`.
4. Return the existing task payload with diagnostics.

This preserves diagnostics tied to the selected workspace because both resolution and fetch use the same scoped store.

## File-By-File Plan

- `src/mcp/server.ts`: route `playspec_get_task` through the scoped `TaskIdResolver` before `getTask()`.
- `tests/integration/mcp-server.test.ts`: add one test for unique-prefix `playspec_get_task` success and one test for ambiguous-prefix failure guidance.
- `README.md`: no text change expected because the documented guidance remains accurate after the implementation catches up.

## Risks And Open Questions

- Risk: resolving against the server workspace instead of explicit `workspaceRoot` would produce misleading diagnostics. Mitigation: instantiate the resolver from the same `scopedTaskStore` used for fetch.
- Risk: changing `playspec_get_task` to shared `resolveMcpTaskId()` would introduce session semantics that this tool does not advertise. Mitigation: use `TaskIdResolver` directly for the required `taskId` argument only.
- Open question: none for implementation.

## Reader Aids

Verified old flow:

```text
playspec_get_task taskId
  -> resolve effective workspace
  -> collect diagnostics
  -> YamlTaskStore(effective workspace).getTask(input taskId)
```

Proposed flow:

```text
playspec_get_task taskId
  -> resolve effective workspace
  -> collect diagnostics
  -> TaskIdResolver(YamlTaskStore(effective workspace)).resolve(input taskId)
  -> YamlTaskStore(effective workspace).getTask(canonical taskId)
```
