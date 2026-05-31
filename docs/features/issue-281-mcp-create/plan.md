# Implementation Plan

## Ordered Steps

1. Add shared normal-task creation support in `src/core/task-creation.ts`.
   - Export input/result types for non-interactive task creation.
   - Validate `.playspec` workspace initialization.
   - Resolve the requested workflow with `WorkflowLoader`.
   - Generate `taskId` from `slugify(title)` unless an explicit `taskId` is provided.
   - Validate explicit `taskId` using the existing task ID rules before any file write.
   - Accept `variables: Record<string, string>` and keep values string-only.
   - Accept exactly one of `sourceProblemText` or `sourceProblemFile`.
   - Read relative source files from the effective workspace root.
   - Store source problem text at `.playspec/tasks/active/<taskId>/sources/source_problem.md`.
   - Add `SOURCE_PROBLEM_FILE` and a `source-problem` context ref when a source is present.
   - Resolve `parentTaskId` and `afterTaskId` through `TaskIdResolver`.
   - Validate first-phase required variables before persisting.
   - Persist through `YamlTaskStore.createTask()` and update `.playspec/HEAD`.
   - Return structured metadata for callers.

2. Refactor `src/cli/commands/create.ts`.
   - Keep interactive creation and phase-execution logic in the CLI command module.
   - Replace the normal non-interactive path with the shared helper.
   - Preserve current CLI output wording, source methods, link output, and HEAD update semantics.
   - Keep `--var` parsing in CLI because MCP will pass structured variables.

3. Add `playspec_create_task` in `src/mcp/server.ts`.
   - Register the tool near existing task lifecycle tools.
   - Use `resolveMcpWorkspaceRoot()` before creating stores or reading source files.
   - Schema fields: `workspaceRoot`, `title`, `workflow`, `taskId`, `variables`, `sourceProblemText`, `sourceProblemFile`, `parentTaskId`, `afterTaskId`, `bindSessionId`, `adapter`.
   - Default `workflow` to `mono-spec`.
   - Call the shared helper with `sourceProblemText` using method `mcp` and file sources using method `create`.
   - If `bindSessionId` is present, bind through `McpSessionStore` in the same effective workspace.
   - Return created task metadata, diagnostics, optional bound session, and a next-step hint.
   - On errors, keep MCP `isError: true`; for required-variable errors, include clear missing-variable text from the shared validator.

4. Add MCP integration tests in `tests/integration/mcp-server.test.ts`.
   - Create a `mono-spec` task with `sourceProblemText` and `FEATURE_SLUG`; assert source file, context ref, variables, list/get visibility.
   - Create a `total-plan` task with required variables; assert success and first phase readiness.
   - Render the first prompt through `playspec_render_next_prompt` immediately after MCP creation.
   - Omit a required variable; assert `isError`, workflow/phase context, missing variable name, and no task persisted.
   - Use a server workspace different from explicit `workspaceRoot`; assert the task, source, HEAD, and optional session are created only under the explicit project workspace.
   - Verify `playspec_create_task` is registered.

## Files to Edit

- `src/core/task-creation.ts`
- `src/cli/commands/create.ts`
- `src/mcp/server.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue-281-mcp-create/result.md`
- `docs/features/issue-281-mcp-create/pr.md`

## Tests to Run

- `pnpm test -- tests/integration/mcp-server.test.ts`
- `pnpm build`
- `pnpm test`

## Old Paths, Bypasses, and Partial Migration Risks

- Old path: CLI-only `runCreate()` owns normal task creation. The refactor must leave CLI behavior intact while moving shared behavior into Core.
- Bypass: MCP tools can use explicit `workspaceRoot`; the create tool must not use the server root after resolving an explicit workspace.
- Bypass: existing MCP follow-up tools must not use HEAD fallback. Returning/updating HEAD for CLI parity must not change `resolveMcpTaskId()` behavior.
- Partial migration risk: leaving any normal creation validation in CLI only could let MCP create tasks that fail prompt rendering later.
- Partial migration risk: source file writes must happen after required-variable validation and `YamlTaskStore` duplicate checks to avoid orphaned source files.

## Risks

- Explicit `taskId` validation must happen early enough to prevent path traversal.
- Required-variable errors should remain readable after moving validation to shared code.
- Test workspaces must initialize workflows before using workflow-specific variables.
- The large existing MCP test file can be slow; run the targeted file first before the full suite.

## Rollback Notes

If the refactor causes broad regressions, revert the shared helper and restore the old normal-task path in `src/cli/commands/create.ts`. MCP can be left unregistered until the shared path is stable; do not ship duplicated MCP-only creation logic.

## Completion Criteria

- `playspec_create_task` appears in MCP registered tools.
- MCP can create source-backed `mono-spec` tasks without CLI fallback.
- MCP can create `total-plan` tasks with required variables.
- Created tasks are visible to MCP list/get tools in the same workspace.
- Created tasks can immediately render the first prompt through MCP.
- Missing required variables produce a clear MCP error and do not persist a task.
- Explicit workspace creation does not write under the server or home workspace.
- Targeted and full validation commands pass.
