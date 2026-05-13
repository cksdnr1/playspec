# Implementation Plan

## Ordered Steps

1. Update `src/mcp/errors.ts`.
   - Add exported `McpSessionNotFoundError extends PlaySpecError`.
   - Error message: identify that the requested MCP session was not found.
   - Hint: instruct the caller to create or bind a session, e.g. by calling `playspec_use_session_task`.
   - Leave `McpSessionContextEmptyError` unchanged for existing-session null-task behavior.

2. Update `src/mcp/context.ts`.
   - Import `McpSessionNotFoundError`.
   - Keep explicit `taskId` precedence unchanged.
   - After `loadSession(sessionId)`, split the combined guard:
     - `if (!session)` throws `McpSessionNotFoundError`.
     - `if (session.currentTaskId === null)` throws `McpSessionContextEmptyError`.
   - Continue returning `session.currentTaskId` for bound sessions.
   - Do not introduce HEAD lookup or CLI fallback.

3. Update `tests/integration/mcp-server.test.ts`.
   - Import `McpSessionNotFoundError`.
   - Keep the existing null-task test or rename it to make the existing-session condition explicit.
   - Change the missing-session test to expect `McpSessionNotFoundError`.
   - Add or adjust an assertion for the new error hint if the error object exposes `hint`.

4. Validate.
   - Inspect `package.json` and lockfiles before selecting commands.
   - Run the focused MCP integration test.
   - Run the repository's normal build/test commands if practical for this TypeScript CLI repo.

## Files To Edit

- `src/mcp/errors.ts`
- `src/mcp/context.ts`
- `tests/integration/mcp-server.test.ts`
- `docs/features/mcp_differentiate_session_not_found_from_session_has_no_task/result.md` after implementation
- `docs/features/mcp_differentiate_session_not_found_from_session_has_no_task/pr.md` before PR creation

## Tests To Add Or Update

- Missing session file: `resolveMcpTaskId({ sessionId: 'nonexistent.session' }, sessionStore)` rejects with `McpSessionNotFoundError`.
- Existing session with `currentTaskId: null`: rejects with `McpSessionContextEmptyError`.
- New error hint: assert the `McpSessionNotFoundError` hint directs the caller to create or bind a session.

## Old Paths And Bypasses

- Old path: missing sessions currently throw `McpSessionContextEmptyError`; this must be replaced.
- Bypass path: explicit `taskId` must still return directly and avoid session lookup.
- Bypass path: no `taskId` and no `sessionId` must still throw `McpTaskContextRequiredError`.
- Partial migration risk: no server handler should import or special-case the new error; shared MCP error serialization should handle it as another `PlaySpecError`.

## Risks

- `McpSessionStore.loadSession()` returns `null` for all load failures, so the new error will also represent corrupt/unreadable sessions. This is acceptable under the issue's no-API-change constraint.
- Downstream callers catching only `McpSessionContextEmptyError` for missing sessions will need to catch `McpSessionNotFoundError` too.

## Rollback Notes

- Revert the new error class, the split resolver guard, and the test expectation change to restore the previous conflated behavior.
- No data migration or persisted format rollback is needed.

## Completion Criteria

- Missing-session resolver test fails with `McpSessionNotFoundError` before the fix and passes after the fix.
- Null-task resolver test still fails with `McpSessionContextEmptyError`.
- Existing explicit `taskId`, no-context, and bound-session resolver tests still pass.
- Build and test commands run cleanly, or any skipped validation is explicitly reported with reason.
