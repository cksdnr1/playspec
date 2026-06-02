# Issue #303 Implementation Plan

## Ordered Steps

1. Update `playspec_get_task` routing in `src/mcp/server.ts`.
   - Keep the existing `effectiveWorkspaceRoot` and diagnostics collection.
   - Instantiate `YamlTaskStore` for the effective workspace as today.
   - Resolve `args.taskId` with `new TaskIdResolver(scopedTaskStore).resolve(args.taskId)`.
   - Fetch with `scopedTaskStore.getTask(resolved.taskId)`.
   - Preserve the existing success payload shape `{ ...task, diagnostics }` and error formatting.

2. Add MCP integration coverage in `tests/integration/mcp-server.test.ts`.
   - Add a unique-prefix success test near the existing `playspec_get_task` exact and explicit workspace tests.
   - Add an ambiguous-prefix failure test that creates two active tasks with the same prefix and asserts the response is an MCP error containing the ambiguity guidance.
   - Existing exact-ID and explicit `workspaceRoot` tests remain unchanged and continue to cover diagnostics.

3. Validate the focused suite.
   - Inspect `package.json` scripts before final validation.
   - Run `pnpm test -- tests/integration/mcp-server.test.ts` if supported by scripts, otherwise run the equivalent focused Vitest command used by the repository.
   - Run `pnpm build` if the focused tests pass, because the change touches TypeScript production code.

## Files To Edit

- `src/mcp/server.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_303_get_task_prefix_resolution/result.md`
- `docs/features/issue_303_get_task_prefix_resolution/pr.md`

## Tests To Add Or Update

- `playspec_get_task` resolves a unique prefix to the canonical task ID.
- `playspec_get_task` returns the `TaskIdResolver` ambiguous-prefix error guidance for ambiguous prefixes.

Existing tests to preserve:

- Exact same-workspace `playspec_get_task` lookup with diagnostics.
- Explicit `workspaceRoot` lookup with diagnostics.
- Prefix routing for `resolveMcpTaskId` and prompt/session tools.

## Active Entry Point Trace

Unique-prefix lookup:

```text
MCP handler playspec_get_task
  -> resolveMcpWorkspaceRoot(server workspace, args.workspaceRoot)
  -> collectMcpWorkspaceDiagnostics(server workspace, effective workspace)
  -> YamlTaskStore(effective workspace)
  -> TaskIdResolver(scoped store).resolve(args.taskId)
  -> scopedTaskStore.getTask(canonical task ID)
  -> ok({ ...task, diagnostics })
```

Ambiguous-prefix lookup:

```text
MCP handler playspec_get_task
  -> same effective workspace and scoped store
  -> TaskIdResolver.resolve(args.taskId)
  -> AmbiguousTaskIdError
  -> err(error, diagnostics)
```

No persistence or reset/clear behavior changes are required because this is read-only lookup routing.

## Old Paths And Bypass Risks

- Old bypass: `playspec_get_task` called `YamlTaskStore.getTask(args.taskId)` directly.
- Required closure: route the required `taskId` argument through `TaskIdResolver` without adding `sessionId` support or `.playspec/HEAD` fallback.
- Partial migration risk: using a resolver from the wrong workspace would produce incorrect missing-task or ambiguity guidance. The resolver must be built from the same scoped store used for fetch.

## Risks

- Ambiguity message assertions should target stable guidance text rather than the entire formatted response, because MCP errors append diagnostics.
- Missing prefix behavior will now come from `TaskIdResolutionError` instead of `TaskNotFoundError`; this is intended by the issue for prefixes. Existing diagnostics must still be appended.

## Rollback Notes

The implementation is a small routing change and two tests. Rollback is limited to reverting the `server.ts` handler change and the new test cases.

## Completion Criteria

- Unique prefix passed to `playspec_get_task` returns the canonical task.
- Ambiguous prefix passed to `playspec_get_task` returns an MCP error with resolver ambiguity guidance.
- Exact-ID and explicit workspace lookup tests still pass.
- Focused MCP integration suite passes.
- Build passes or any build failure is reported with exact cause.
