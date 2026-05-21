# Implementation Plan

## Ordered Steps

1. Add MCP validation helpers.
   - Create `src/mcp/validation.ts`.
   - Export `assertValidMcpTaskId(taskId: string)` and `assertValidMcpSessionId(sessionId: string)`.
   - Enforce non-empty string, max 256 characters, no `/`, `\`, `:`, null bytes, or control characters.
   - Keep validation MCP-local and independent from CLI/Core.

2. Update MCP errors.
   - Keep `McpInvalidTaskIdError` and update its hint to mention colons and non-empty strings.
   - Add `McpInvalidSessionIdError` with the same filename-safe rules for sessions.
   - Expand `McpTaskContextRequiredError` hint to document that callers must provide a non-empty, filename-safe `taskId` or `sessionId`.

3. Wire resolver validation.
   - In `src/mcp/context.ts`, import `assertValidMcpTaskId` and `assertValidMcpSessionId`.
   - Preserve task ID precedence: validate and return `taskId` before inspecting `sessionId`.
   - Treat absent or empty-string `sessionId` as missing context when no `taskId` is present, throwing `McpTaskContextRequiredError`.
   - Validate non-empty `sessionId` before calling `sessionStore.loadSession()`.

4. Wire session binding validation.
   - In `src/mcp/session-store.ts`, validate `sessionId` and `taskId` at the start of `setSessionTask()`.
   - Ensure invalid values fail before `loadSession()`, `saveSession()`, or path construction for writes.
   - Leave `loadSession()` and `saveSession()` APIs unchanged.

5. Add tests.
   - In `tests/integration/mcp-server.test.ts`, add required empty-string resolver tests.
   - Add direct task ID colon rejection coverage.
   - Add malformed non-empty session ID resolver coverage for `../etc`, `mcp:codex`, or equivalent.
   - Add `setSessionTask()` validation coverage for invalid `sessionId` and invalid `taskId`.

## Files To Edit

- `src/mcp/validation.ts`: new shared MCP identifier validation helpers.
- `src/mcp/errors.ts`: hints and new invalid session ID error.
- `src/mcp/context.ts`: resolver validation flow.
- `src/mcp/session-store.ts`: session binding validation.
- `tests/integration/mcp-server.test.ts`: resolver/session-store regression tests.

## Tests To Run

- `pnpm test tests/integration/mcp-server.test.ts`
- `pnpm build`
- `pnpm test`

## Active Entry Point Trace

- MCP operation with `taskId`: tool args -> `resolveMcpTaskId()` -> task ID validation -> direct return -> core operation receives explicit task ID.
- MCP operation with `sessionId`: tool args -> `resolveMcpTaskId()` -> session ID validation -> session YAML load -> session current task ID returned -> core operation receives explicit task ID.
- Session binding: `playspec_use_session_task` tool -> `McpSessionStore.setSessionTask()` -> session/task ID validation -> session record persisted under `.playspec/sessions`.

## Old Paths, Bypasses, And Partial Migration Risks

- `loadSession()` remains permissive. This is acceptable because the resolver validates before reading session context; direct low-level reads are unchanged.
- `saveSession()` remains schema-only. This avoids a broader API change, while `setSessionTask()` closes the MCP binding write path.
- MCP tool schemas remain `z.string()`, as required; runtime validation handles malformed strings.
- No CLI/Core task ID behavior changes are planned.

## Risks

- Colon rejection changes direct MCP `taskId` behavior. The risk is low because colons are unsafe for filename-compatible identifiers and the issue requests this guard.
- Adding a new error class may affect exact error-name assertions if any external test expects generic behavior. Existing tests use `McpInvalidTaskIdError` only for task IDs; new session behavior will be explicitly covered.

## Rollback Notes

Rollback is limited to reverting the new helper, error class, resolver/session-store imports, and added tests. No data migration or file format change is involved.

## Completion Criteria

- Empty-string `sessionId` without `taskId` throws `McpTaskContextRequiredError`.
- Valid `taskId` with empty-string `sessionId` resolves to the task ID.
- Malformed non-empty session IDs are rejected before session file lookup.
- `setSessionTask()` rejects malformed `sessionId` and `taskId`.
- Focused MCP integration test, full test suite, and build pass.
