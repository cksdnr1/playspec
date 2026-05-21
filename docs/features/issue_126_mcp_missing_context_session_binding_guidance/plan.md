# Issue #126 Implementation Plan

## Ordered Steps

1. Update `src/mcp/errors.ts`.
   - Change only the `McpTaskContextRequiredError` hint.
   - Mention both recovery paths: provide `taskId`/`sessionId`, or call `playspec_use_session_task` to bind a task to a session before reusing `sessionId`.
   - Do not change the error class name or message.

2. Update resolver-level MCP integration coverage in `tests/integration/mcp-server.test.ts`.
   - Keep the existing assertion that `resolveMcpTaskId({})` throws `McpTaskContextRequiredError`.
   - Add assertions that the thrown error hint includes `taskId`, `sessionId`, and `playspec_use_session_task`.
   - Preserve the existing no-HEAD fallback test.

3. Update one MCP tool-handler assertion in `tests/integration/mcp-server.test.ts`.
   - Use the existing missing-context path for `playspec_link_tasks`.
   - Assert the tool response includes `playspec_use_session_task`.
   - Keep the existing successful link/unlink assertions unchanged.

4. Run validation.
   - Inspect `package.json` scripts and lockfile choice.
   - Because `pnpm-lock.yaml` exists, use pnpm.
   - Run the targeted MCP integration suite: `pnpm test -- tests/integration/mcp-server.test.ts`.
   - Run `pnpm build`.
   - Run broader tests only if targeted tests or build expose a wider risk.

5. Record results and prepare PR materials.
   - Write `result.md` with changed files, commands run, and risk notes.
   - Write `pr.md` with the required PR body content.
   - Commit, push `agent/issue-126-mcp-context-guidance`, create a draft PR, and add `agent-pr-created` if available.

## Files To Edit

- `src/mcp/errors.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/issue_126_mcp_missing_context_session_binding_guidance/spec.md`
- `docs/features/issue_126_mcp_missing_context_session_binding_guidance/plan.md`
- `docs/features/issue_126_mcp_missing_context_session_binding_guidance/result.md`
- `docs/features/issue_126_mcp_missing_context_session_binding_guidance/pr.md`

## Behavior Trace

- Active entry point: MCP tool handler or direct `resolveMcpTaskId()` call.
- Validation: `resolveMcpTaskId()` checks explicit `taskId`, then explicit `sessionId`, then rejects missing context.
- State/data update: none. This change is diagnostic only.
- Propagation: thrown `McpTaskContextRequiredError` is returned through MCP handler error formatting.
- Reset/clear: none needed because no state changes.
- User-visible behavior: missing-context MCP responses now tell callers how to bind a session with `playspec_use_session_task`.

## Old Paths And Bypass Risks

- `.playspec/HEAD` remains intentionally ignored by MCP context resolution.
- `ActiveTaskResolver` remains outside the MCP context path.
- No migration or partial compatibility path is needed.

## Tests

- `resolveMcpTaskId({})` still throws `McpTaskContextRequiredError`.
- Missing-context resolver error hint includes `playspec_use_session_task`.
- Missing-context MCP tool response includes `playspec_use_session_task`.
- Existing no-HEAD fallback coverage remains unchanged.

## Risks

- Low risk because only diagnostics and tests change.
- Main guardrail is preserving explicit MCP context routing and avoiding any HEAD fallback.

## Rollback Notes

- Revert the hint string and related test assertions if the wording needs to be changed.
- No data migration, generated state, or destructive cleanup is involved.

## Completion Criteria

- The code and tests implement the approved spec.
- Targeted MCP integration tests pass.
- Build passes.
- Changes are committed, pushed, and represented in a draft PR that references `Fixes #126`.
