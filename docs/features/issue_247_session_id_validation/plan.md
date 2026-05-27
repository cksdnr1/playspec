# Issue #247 Session ID Validation Plan

## Ordered Implementation Steps

1. Update `src/mcp/session-store.ts`.
   - Add `assertValidMcpSessionId(sessionId)` as the first statement in `loadSession()`.
   - Keep validation outside the existing `try/catch` so `McpInvalidSessionIdError` is not converted to `null`.
   - Leave valid missing-session behavior unchanged.

2. Update `tests/integration/mcp-server.test.ts` store coverage.
   - Add a focused `McpSessionStore.loadSession()` test for malformed session IDs.
   - Include representative inputs: `../mcp.codex`, `mcp:codex`, control character, empty string, null byte, backslash, and overlong value.
   - Assert `McpInvalidSessionIdError`.

3. Update `tests/integration/mcp-server.test.ts` registered MCP tool coverage.
   - Add a `playspec_get_session_task` test proving a valid nonexistent session still returns `{ session: null, task: null }`.
   - Add a malformed session ID table for `playspec_get_session_task`, including `../mcp.codex`, `mcp:codex`, and `mcp.codex\nbad`.
   - Assert the result is `isError: true` and contains the existing invalid-session message.

4. Run focused validation.
   - `pnpm test tests/integration/mcp-server.test.ts`

5. Run repository validation.
   - `pnpm build`
   - `pnpm test`

## Files To Edit

- `src/mcp/session-store.ts`
- `tests/integration/mcp-server.test.ts`

## Tests To Add Or Update

- Store-level malformed session load rejection.
- MCP handler-level malformed `playspec_get_session_task` rejection.
- MCP handler-level valid missing-session read behavior.

## Active Entry Point Trace

Malformed read:

`playspec_get_session_task` -> `McpSessionStore.loadSession()` -> `assertValidMcpSessionId()` -> `McpInvalidSessionIdError` -> MCP `err()` response with `isError: true`.

Valid missing read:

`playspec_get_session_task` -> `McpSessionStore.loadSession()` -> validation passes -> `sessionPath()` -> file read misses -> `null` -> `{ session: null, task: null }`.

Existing context resolution:

`resolveMcpTaskId()` already validates session IDs before calling `loadSession()`. Centralizing validation leaves this behavior unchanged except for duplicate validation on valid IDs.

Existing binding:

`playspec_use_session_task` -> `McpSessionStore.setSessionTask()` already validates before calling `loadSession()`. Centralizing validation leaves this behavior unchanged.

## Old Paths, Bypasses, And Partial Migration Risks

- Old bypass: direct `playspec_get_session_task` load path without validation. Closed by validating inside `loadSession()`.
- Partial migration risk: putting validation inside the `try/catch` would preserve the bug by returning `null`. Avoid by validating before `try`.
- Compatibility risk: any direct `loadSession()` caller with malformed input now receives `McpInvalidSessionIdError`. In-tree callers should either already validate or should reject malformed input.

## Rollback Notes

Rollback is limited to removing the new `loadSession()` validation line and related tests. No migration, storage format, or task data changes are introduced.

## Completion Criteria

- Malformed `playspec_get_session_task` session IDs return the existing invalid-session MCP error.
- Valid nonexistent `playspec_get_session_task` session IDs return `{ session: null, task: null }`.
- Existing resolver and session-binding tests still pass.
- Focused MCP test file, full test suite, and build pass.
